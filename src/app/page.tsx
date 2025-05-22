
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, CheckSquare } from "lucide-react";
import { GameRoomStatus, type GameRoom, type Player, RoomMode } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MIN_PLAYERS_TO_START, TOTAL_ROUNDS_PER_GAME, MAX_CAPTAIN_CHANGES_PER_ROUND, MISSIONS_CONFIG } from "@/lib/game-config";

const ROOMS_LOCAL_STORAGE_KEY = "anxian-rooms";

export default function LobbyPage() {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isCreateRoomDialogOpen, setIsCreateRoomDialogOpen] = useState(false);
  const [newRoomNameInput, setNewRoomNameInput] = useState("");
  const [selectedRoomMode, setSelectedRoomMode] = useState<RoomMode>(RoomMode.Online);


  const loadRoomsFromLocalStorage = useCallback(() => {
    setIsLoadingRooms(true);
    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      let fetchedRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];

      fetchedRooms = fetchedRooms.filter(room => {
        if (room.players.length === 0) {
          console.log(`Room ${room.name} (${room.id}) is empty and will be removed.`);
          return false; // Filter out empty rooms
        }
        if (room.status === GameRoomStatus.Finished) return false;
        if (room.status === GameRoomStatus.InProgress) {
          return user ? room.players.some(p => p.id === user.id) : false;
        }
        return true;
      });

      // Update localStorage if any empty rooms were filtered out
      const currentRoomIds = fetchedRooms.map(r => r.id);
      const originalRooms = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      const updatedOriginalRooms = originalRooms.filter((r: GameRoom) => currentRoomIds.includes(r.id));
      if (originalRooms.length !== updatedOriginalRooms.length) {
        localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(updatedOriginalRooms));
      }

      const statusPriority: { [key in GameRoomStatus]: number } = {
        [GameRoomStatus.InProgress]: 1,
        [GameRoomStatus.Waiting]: 2,
        [GameRoomStatus.Finished]: 3,
      };

      fetchedRooms.sort((a, b) => {
        const isUserInA = user && a.players.some(p => p.id === user.id);
        const isUserInB = user && b.players.some(p => p.id === user.id);

        if (isUserInA && !isUserInB) return -1;
        if (!isUserInA && isUserInB) return 1;

        const statusDiff = statusPriority[a.status] - statusPriority[b.status];
        if (statusDiff !== 0) return statusDiff;

        return (b.players?.length || 0) - (a.players?.length || 0);
      });

      setRooms(fetchedRooms);
    } catch (e) {
      console.error("Error loading rooms from localStorage:", e);
      setRooms([]);
    }
    setIsLoadingRooms(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    loadRoomsFromLocalStorage();
  }, [authLoading, user, loadRoomsFromLocalStorage]);

  const handleCreateRoom = async (roomName: string, roomMode: RoomMode) => {
    if (!user) {
      toast({ title: "需要登录", description: "请先登录再创建房间。", variant: "destructive" });
      router.push("/login?redirect=/");
      return;
    }

    const finalRoomName = roomName.trim() || `${user.name}的房间`;
    const defaultPlayerCountForMissions = MIN_PLAYERS_TO_START;
    const missionPlayerCountsForNewRoom = MISSIONS_CONFIG[defaultPlayerCountForMissions] || MISSIONS_CONFIG[5];

    const newRoomData: GameRoom = {
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: finalRoomName,
      players: [{ id: user.id, name: user.name, avatarUrl: user.avatarUrl || undefined }],
      maxPlayers: 10,
      status: GameRoomStatus.Waiting,
      hostId: user.id,
      createdAt: new Date().toISOString(),
      mode: roomMode, // Set room mode
      teamScores: { teamMemberWins: 0, undercoverWins: 0 },
      missionHistory: [],
      fullVoteHistory: [],
      missionPlayerCounts: missionPlayerCountsForNewRoom,
      totalRounds: TOTAL_ROUNDS_PER_GAME,
      maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND,
    };

    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      const currentRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      currentRooms.push(newRoomData);
      localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(currentRooms));
      loadRoomsFromLocalStorage();
      toast({ title: "房间已创建", description: `房间 "${finalRoomName}" 创建成功！模式: ${roomMode === RoomMode.Online ? '在线' : '手动输入'}` });
      setIsCreateRoomDialogOpen(false);
      setNewRoomNameInput(""); // Reset input
      setSelectedRoomMode(RoomMode.Online); // Reset mode
      router.push(`/rooms/${newRoomData.id}`);
    } catch (error) {
      console.error("Error creating room in localStorage:", error);
      toast({ title: "创建房间失败", description: "无法创建房间。", variant: "destructive" });
    }
  };

  const handleConfirmCreateRoom = () => {
    handleCreateRoom(newRoomNameInput, selectedRoomMode);
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
        {user && (
          <div className="mt-8">
            <Dialog open={isCreateRoomDialogOpen} onOpenChange={setIsCreateRoomDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  onClick={() => setIsCreateRoomDialogOpen(true)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground transition-transform hover:scale-105 active:scale-95 shadow-md"
                >
                  <PlusCircle className="mr-2 h-6 w-6" /> 创建新房间
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>创建新房间</DialogTitle>
                  <DialogDescription>
                    输入房间名称并选择房间模式。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="room-name" className="text-right">
                      房间名称
                    </Label>
                    <Input
                      id="room-name"
                      value={newRoomNameInput}
                      onChange={(e) => setNewRoomNameInput(e.target.value)}
                      placeholder={`${user?.name || '玩家'}的房间`}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="room-mode" className="text-right">
                      房间模式
                    </Label>
                    <Select
                      value={selectedRoomMode}
                      onValueChange={(value) => setSelectedRoomMode(value as RoomMode)}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="选择模式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RoomMode.Online}>在线模式</SelectItem>
                        <SelectItem value={RoomMode.ManualInput}>手动输入模式</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                     <Button variant="outline">取消</Button>
                  </DialogClose>
                  <Button onClick={handleConfirmCreateRoom}>确认创建</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">可用房间</h2>
        {rooms.length === 0 ? (
          <p className="text-center text-muted-foreground">暂无可用房间。{user ? "创建一个吧？" : ""}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const isUserInRoom = user && room.players.some(p => p.id === user.id);

              let displayStatusText = "";
              let displayStatusVariant: "outline" | "default" = "default";
              let displayStatusClass = "";

              if (room.status === GameRoomStatus.InProgress) {
                displayStatusText = "游戏中";
                displayStatusClass = "bg-green-500 text-white";
              } else if (room.status === GameRoomStatus.Waiting) {
                displayStatusText = "等待中";
                displayStatusVariant = "outline";
                displayStatusClass = "border-yellow-500 text-yellow-600";
              }

              return (
                <Link key={room.id} href={`/rooms/${room.id}`} passHref legacyBehavior>
                  <a className="block group">
                    <Card
                      className={cn(
                        "hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer",
                        isUserInRoom && "border-2 border-primary"
                      )}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-primary truncate group-hover:text-primary/90 transition-colors">{room.name}</CardTitle>
                          <div className="flex items-center space-x-2">
                            {displayStatusText && (
                              <Badge variant={displayStatusVariant} className={cn("text-xs", displayStatusClass)}>
                                {displayStatusText}
                              </Badge>
                            )}
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
                    </Card>
                  </a>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
