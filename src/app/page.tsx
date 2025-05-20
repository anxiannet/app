
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, LogIn, CheckSquare } from "lucide-react";
import { GameRoomStatus, type GameRoom, type Player } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase"; // Firebase client SDK
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, Timestamp, doc, deleteDoc } from "firebase/firestore";

export default function LobbyPage() {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;

    setIsLoadingRooms(true);
    const roomsCollection = collection(db, "rooms");
    const q = query(roomsCollection, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let fetchedRooms: GameRoom[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        players: doc.data().players || [],
      } as GameRoom));

      const roomsToDelete: string[] = [];
      fetchedRooms = fetchedRooms.filter(room => {
        if ((!room.players || room.players.length === 0) && room.status === GameRoomStatus.Waiting) {
          roomsToDelete.push(room.id);
          console.log(`Room ${room.id} marked for deletion as it is empty and waiting.`);
          return false;
        }
        return true;
      });

      for (const roomIdToDelete of roomsToDelete) {
        try {
          await deleteDoc(doc(db, "rooms", roomIdToDelete));
          console.log(`Room ${roomIdToDelete} deleted because it was empty.`);
        } catch (error) {
          console.error(`Error deleting empty room ${roomIdToDelete}:`, error);
        }
      }
      
      fetchedRooms = fetchedRooms.filter(room => {
        if (room.status === GameRoomStatus.Finished) {
          return false; 
        }
        if (room.status === GameRoomStatus.InProgress) {
          if (!user) return false; 
          return room.players.some(p => p.id === user.id); 
        }
        return true; 
      });


      const statusPriority: { [key in GameRoomStatus]: number } = {
        [GameRoomStatus.InProgress]: 1,
        [GameRoomStatus.Waiting]: 2,
        [GameRoomStatus.Finished]: 3, 
      };

      fetchedRooms.sort((a, b) => {
        const statusDiff = statusPriority[a.status] - statusPriority[b.status];
        if (statusDiff !== 0) return statusDiff;
        return (b.players?.length || 0) - (a.players?.length || 0);
      });

      setRooms(fetchedRooms);
      setIsLoadingRooms(false);
    }, (error) => {
      console.error("Error fetching rooms from Firestore:", error);
      toast({ title: "获取房间失败", description: "无法从服务器加载房间列表。", variant: "destructive" });
      setIsLoadingRooms(false);
    });

    return () => unsubscribe(); 
  }, [authLoading, user, toast]); 

  const handleCreateRoom = async () => {
    if (!user) {
      toast({ title: "需要登录", description: "请先登录再创建房间。", variant: "destructive" });
      router.push("/login?redirect=/");
      return;
    }

    const newRoomName = `房间 ${Math.floor(Math.random() * 1000) + 1}`; 
    const newRoomData: Omit<GameRoom, "id"> = { 
      name: newRoomName,
      players: [{ id: user.id, name: user.name, avatarUrl: user.avatarUrl || undefined }], 
      maxPlayers: 10,
      status: GameRoomStatus.Waiting,
      hostId: user.id,
      createdAt: serverTimestamp() as Timestamp, 
      teamScores: { teamMemberWins: 0, undercoverWins: 0 },
      missionHistory: [],
      fullVoteHistory: [],
      missionPlayerCounts: [], 
      totalRounds: 5,
      maxCaptainChangesPerRound: 5,
    };

    try {
      const docRef = await addDoc(collection(db, "rooms"), newRoomData);
      toast({ title: "房间已创建", description: `房间 "${newRoomName}" 创建成功！` });
      router.push(`/rooms/${docRef.id}`);
    } catch (error) {
      console.error("Error creating room in Firestore:", error);
      toast({ title: "创建房间失败", description: "无法在服务器上创建房间。", variant: "destructive" });
    }
  };

  if (authLoading || isLoadingRooms) {
    return <div className="text-center py-10">加载房间列表...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="text-center py-10 bg-card shadow-lg rounded-lg">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary">
          欢迎来到 暗线
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          解开谜团，揭露隐藏，赢取胜利。
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            onClick={handleCreateRoom}
            className="bg-accent hover:bg-accent/90 text-accent-foreground transition-transform hover:scale-105 active:scale-95 shadow-md"
          >
            <PlusCircle className="mr-2 h-6 w-6" /> 创建新房间
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">可用房间</h2>
        {rooms.length === 0 ? (
          <p className="text-center text-muted-foreground">暂无可用房间。创建一个吧？</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const isUserInRoom = user && room.players.some(p => p.id === user.id);
              
              let displayStatusText = room.status.toUpperCase();
              let displayStatusVariant: "outline" | "default" = "default";
              let displayStatusClass = "";

              if (room.status === GameRoomStatus.InProgress) {
                displayStatusText = "游戏中";
                displayStatusClass = "bg-green-500 text-white";
              } else if (room.status === GameRoomStatus.Waiting) {
                displayStatusText = "等待中";
                displayStatusVariant = "outline";
                displayStatusClass = "border-yellow-500 text-yellow-600";
              } else if (room.status === GameRoomStatus.Finished) { 
                displayStatusText = "游戏结束";
                displayStatusClass = "bg-gray-500 text-white";
              }


              return (
                <Card
                  key={room.id}
                  className={cn(
                    "hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1",
                    isUserInRoom && "border-2 border-primary"
                  )}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-primary truncate">{room.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant={displayStatusVariant} className={cn("text-xs", displayStatusClass)}>
                          {displayStatusText}
                        </Badge>
                        {isUserInRoom && (
                          <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/50">
                            <CheckSquare className="mr-1 h-3 w-3" /> 已加入
                          </Badge>
                        )}
                      </div>
                    </div>
                     <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
                        <Users className="mr-2 h-4 w-4" /> {room.players?.length || 0} / {room.maxPlayers} 玩家
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Image
                      src={`https://placehold.co/600x400.png?text=${encodeURIComponent(room.name)}`}
                      alt={room.name}
                      width={600}
                      height={400}
                      className="rounded-md mt-2 aspect-video object-cover"
                      data-ai-hint="game concept art"
                    />
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95">
                      <Link href={`/rooms/${room.id}`}>
                        <LogIn className="mr-2 h-4 w-4" />
                        {isUserInRoom ? "返回房间" : "加入房间"}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
