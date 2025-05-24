
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, PlusCircle, CheckSquare, KeyRound as KeyRoundIcon, Gamepad2 } from "lucide-react";
import {
  type GameRoom,
  GameRoomStatus,
  RoomMode,
  type Player,
} from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { 
  MISSIONS_CONFIG, 
  TOTAL_ROUNDS_PER_GAME, 
  MAX_CAPTAIN_CHANGES_PER_ROUND, 
  PRE_GENERATED_AVATARS,
  OFFLINE_KEYWORD_PRESET_TEMPLATES,
  MIN_PLAYERS_TO_START
} from "@/lib/game-config";

const ROOMS_LOCAL_STORAGE_KEY = "anxian-rooms";

export default function LobbyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [localStorageRooms, setLocalStorageRooms] = useState<GameRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  const loadRoomsFromLocalStorage = useCallback(() => {
    setIsLoadingRooms(true);
    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      let fetchedRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      
      // Filter out finished rooms and empty rooms
      fetchedRooms = fetchedRooms.filter(room => room.status !== GameRoomStatus.Finished && room.players && room.players.length > 0);

      // Sort rooms: 
      // 1. User's joined rooms first
      // 2. Then by status (In Progress > Waiting)
      // 3. Then by player count (descending)
      fetchedRooms.sort((a, b) => {
        const aIsJoined = user && a.players.some(p => p.id === user.id);
        const bIsJoined = user && b.players.some(p => p.id === user.id);

        if (aIsJoined && !bIsJoined) return -1;
        if (!aIsJoined && bIsJoined) return 1;
        
        const statusOrder = { [GameRoomStatus.InProgress]: 1, [GameRoomStatus.Waiting]: 2 };
        const statusDiff = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
        if (statusDiff !== 0) return statusDiff;
        
        return (b.players?.length || 0) - (a.players?.length || 0);
      });

      setLocalStorageRooms(fetchedRooms);
    } catch (e) {
      console.error("Error loading rooms from localStorage:", e);
      setLocalStorageRooms([]);
    }
    setIsLoadingRooms(false);
  }, [user]);

  useEffect(() => {
    loadRoomsFromLocalStorage();
  }, [loadRoomsFromLocalStorage]);


  const handleCreateRoom = async (mode: RoomMode) => {
    if (!user) {
      toast({ title: "需要登录", description: "请先登录再创建房间。", variant: "destructive" });
      router.push("/login?redirect=/");
      return;
    }

    let newRoomName = "";
    if (mode === RoomMode.Online) {
      newRoomName = `${user.name}的模拟游戏`;
    } else if (mode === RoomMode.ManualInput) {
      newRoomName = `${user.name}的线下游戏`;
    } else {
      toast({ title: "错误", description: "未知的房间模式。", variant: "destructive" });
      return;
    }

    const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newPlayer: Player = { id: user.id, name: user.name, avatarUrl: user.avatarUrl || PRE_GENERATED_AVATARS[0] };
    
    const newRoom: GameRoom = {
      id: newRoomId,
      name: newRoomName,
      players: [newPlayer],
      maxPlayers: 10, // Default max players for these types
      status: GameRoomStatus.Waiting,
      hostId: user.id,
      createdAt: new Date().toISOString(),
      mode: mode,
      teamScores: { teamMemberWins: 0, undercoverWins: 0 },
      missionHistory: [],
      fullVoteHistory: [],
      missionPlayerCounts: MISSIONS_CONFIG[10], // Default to 10 player mission config
      totalRounds: TOTAL_ROUNDS_PER_GAME,
      maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND,
      selectedTeamForMission: [],
      teamVotes: [],
      missionCardPlaysForCurrentMission: [],
      currentGameInstanceId: `gameinst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      const allRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      allRooms.push(newRoom);
      localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(allRooms));
      loadRoomsFromLocalStorage(); // Refresh list
      router.push(`/rooms/${newRoomId}`);
    } catch (e) {
      console.error("Error saving new room to localStorage:", e);
      toast({ title: "创建房间失败", description: "无法将房间保存到本地存储。", variant: "destructive" });
    }
  };

  if (authLoading || isLoadingRooms) {
    return <div className="text-center py-10">加载中...</div>;
  }

  const getRoomStatusDisplayName = (status: GameRoomStatus) => {
    switch (status) {
      case GameRoomStatus.Waiting: return "等待中";
      case GameRoomStatus.InProgress: return "游戏中";
      case GameRoomStatus.Finished: return "游戏结束";
      default: return status.toUpperCase();
    }
  };
  
  const getRoomModeDisplayName = (mode?: RoomMode) => {
    switch (mode) {
      case RoomMode.Online: return "在线模式";
      case RoomMode.ManualInput: return "手动模式";
      case RoomMode.OfflineKeyword: return "暗语模式";
      default: return "";
    }
  };

  return (
    <div className="space-y-8">
      <section className="text-center py-10 bg-card shadow-lg rounded-lg">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary">
          欢迎来到 暗线
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          解开谜团，揭露隐藏，赢取胜利。
        </p>
      </section>

      {user && (
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button
            size="lg"
            onClick={() => handleCreateRoom(RoomMode.Online)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
          >
            <Gamepad2 className="mr-2 h-6 w-6" /> 模拟游戏
          </Button>
          <Button
            size="lg"
            onClick={() => handleCreateRoom(RoomMode.ManualInput)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
          >
            <KeyRoundIcon className="mr-2 h-6 w-6" /> 线下游戏
          </Button>
        </div>
      )}
      
      {localStorageRooms.length > 0 && (
        <section>
          <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">
            进行中的房间
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {localStorageRooms.map((room) => {
              if (room.mode === RoomMode.OfflineKeyword) return null; // Don't display offline keyword rooms here

              const isUserInRoom = user && room.players.some(p => p.id === user.id);
              const canViewRoom = room.status === GameRoomStatus.Waiting || (room.status === GameRoomStatus.InProgress && isUserInRoom);
              
              if (!canViewRoom) return null;

              const roomModeName = getRoomModeDisplayName(room.mode);
              let roomIcon = <Gamepad2 className="mr-2 h-4 w-4 text-primary" />;
              if (room.mode === RoomMode.ManualInput) {
                roomIcon = <KeyRoundIcon className="mr-2 h-4 w-4 text-yellow-600" />;
              }

              return (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  passHref
                  legacyBehavior // Required for non-<a> child of Link
                >
                  <a className="block group">
                    <Card
                      className={cn(
                        "hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer",
                        isUserInRoom && "border-primary ring-2 ring-primary/50"
                      )}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-xl text-primary truncate group-hover:text-primary/90 transition-colors">
                            {room.name}
                          </CardTitle>
                          {isUserInRoom && <Badge variant="secondary" className="border-primary text-primary"><CheckSquare className="mr-1 h-3 w-3" /> 已加入</Badge>}
                        </div>
                        <CardDescription className="flex items-center text-xs text-muted-foreground pt-1">
                          {roomIcon} {roomModeName}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-1">
                         <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center"><Users className="mr-1 h-3 w-3" /> {room.players.length} / {room.maxPlayers} 玩家</span>
                            <Badge
                                variant={room.status === GameRoomStatus.Waiting ? "outline" : "default"}
                                className={cn(
                                "text-xs",
                                room.status === GameRoomStatus.Waiting && "border-yellow-500 text-yellow-600",
                                room.status === GameRoomStatus.InProgress && "bg-green-500 text-white"
                                )}
                            >
                                {getRoomStatusDisplayName(room.status)}
                            </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">
          暗语局模板 (线下专用)
        </h2>
        {OFFLINE_KEYWORD_PRESET_TEMPLATES.length === 0 ? (
          <p className="text-center text-muted-foreground">暂无预设暗语局房间模板。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {OFFLINE_KEYWORD_PRESET_TEMPLATES.map((roomTemplate) => {
               const roomModeName = getRoomModeDisplayName(roomTemplate.mode);
               if (!roomModeName) return null; 

               const roomIcon = <KeyRoundIcon className="mr-2 h-4 w-4 text-yellow-600" />;

              return (
                <Link
                  key={roomTemplate.id}
                  href={`/rooms/${roomTemplate.id}`}
                  passHref
                  legacyBehavior
                >
                  <a className="block group">
                    <Card
                      className={cn(
                        "hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer"
                      )}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-xl text-primary truncate group-hover:text-primary/90 transition-colors">
                            {roomTemplate.name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="text-xs border-yellow-500 text-yellow-600"
                          >
                            {roomModeName}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center text-xs text-muted-foreground pt-1">
                          {roomIcon}
                          {roomTemplate.playerCount} 人
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Image
                          src={`https://placehold.co/600x400.png?text=${encodeURIComponent(
                            (roomTemplate.name || "游戏").substring(0, 2)
                          )}`}
                          alt={roomTemplate.name || "Game"}
                          width={600}
                          height={400}
                          className="rounded-md mt-2 aspect-video object-cover"
                          data-ai-hint="game concept board"
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
