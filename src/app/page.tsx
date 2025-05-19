
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, LogIn, CheckSquare } from "lucide-react";
import { GameRoomStatus, type GameRoom, type Player } from "@/lib/types"; // Ensure GameRoomStatus is a value import
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Mock function to create a unique room ID
const createRoomId = () => `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

export default function LobbyPage() {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Effect to load/mock rooms (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mockRooms: GameRoom[] = [
        { id: createRoomId(), name: "神秘大厦", players: [{id: "player1", name: "房主"} as Player], maxPlayers: 10, status: GameRoomStatus.Waiting, hostId: "player1" },
        { id: createRoomId(), name: "赛博劫案", players: [], maxPlayers: 10, status: GameRoomStatus.Waiting, hostId: "player2" },
      ];
      
      let currentRooms: GameRoom[] = [];
      const storedRoomsRaw = localStorage.getItem("anxian-rooms");
      if (storedRoomsRaw) {
        try {
            currentRooms = JSON.parse(storedRoomsRaw);
        } catch (e) {
            console.error("Failed to parse rooms from localStorage, using mock.", e);
            currentRooms = mockRooms;
            localStorage.setItem("anxian-rooms", JSON.stringify(currentRooms));
        }
      } else {
        currentRooms = mockRooms;
        localStorage.setItem("anxian-rooms", JSON.stringify(currentRooms));
      }

      // Sorting logic
      const statusPriority: { [key in GameRoomStatus]: number } = {
        [GameRoomStatus.InProgress]: 1,
        [GameRoomStatus.Waiting]: 2,
        [GameRoomStatus.Finished]: 3,
      };

      currentRooms.sort((a, b) => {
        // Sort by status priority
        const statusDiff = statusPriority[a.status] - statusPriority[b.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }
        // If status is the same, sort by number of players (descending)
        return b.players.length - a.players.length;
      });

      setRooms(currentRooms);
    }
  }, []);

  const handleCreateRoom = () => {
    if (!user) {
      toast({ title: "Login Required", description: "请先登录再创建房间。", variant: "destructive" });
      router.push("/login");
      return;
    }
    const newRoomId = createRoomId();
    const newRoomName = `房间 ${rooms.length + 1}`; 
    const newRoom: GameRoom = {
      id: newRoomId,
      name: newRoomName,
      players: [], 
      maxPlayers: 10, 
      status: GameRoomStatus.Waiting,
      hostId: user.id,
    };
    
    const updatedRooms = [newRoom, ...rooms]; // Add new room to the beginning

     // Sorting logic - re-sort after adding a new room
    const statusPriority: { [key in GameRoomStatus]: number } = {
      [GameRoomStatus.InProgress]: 1,
      [GameRoomStatus.Waiting]: 2,
      [GameRoomStatus.Finished]: 3,
    };
    updatedRooms.sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.players.length - a.players.length;
    });

    setRooms(updatedRooms);
    if (typeof window !== "undefined") {
      localStorage.setItem("anxian-rooms", JSON.stringify(updatedRooms));
    }
    router.push(`/rooms/${newRoomId}`);
  };

  if (authLoading) {
    return <div className="text-center py-10">加载认证信息...</div>;
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
              return (
                <Card 
                  key={room.id} 
                  className={cn(
                    "hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1",
                    isUserInRoom && "border-2 border-primary" 
                  )}
                >
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-primary truncate">{room.name}</CardTitle>
                      {isUserInRoom && (
                        <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary border-primary/50">
                          <CheckSquare className="mr-1 h-3 w-3" /> 已加入
                        </Badge>
                      )}
                    </div>
                    <CardDescription>最大玩家数: {room.maxPlayers}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="mr-2 h-4 w-4" />
                      <span>{room.players.length} / {room.maxPlayers} 玩家</span>
                    </div>
                    <div className="flex items-center text-sm">
                      状态: <Badge variant={room.status === GameRoomStatus.Waiting ? "outline" : room.status === GameRoomStatus.InProgress ? "default" : "secondary"} className={cn(
                        "ml-1 font-semibold",
                        room.status === GameRoomStatus.Waiting && "border-yellow-500 text-yellow-600",
                        room.status === GameRoomStatus.InProgress && "bg-green-500 text-white",
                        room.status === GameRoomStatus.Finished && "bg-gray-500 text-white"
                      )}>{room.status.toUpperCase()}</Badge>
                    </div>
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
