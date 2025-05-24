
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
import { Users, PlusCircle, CheckSquare, KeyRound as KeyRoundIcon } from "lucide-react";
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
import { MISSIONS_CONFIG, TOTAL_ROUNDS_PER_GAME, MAX_CAPTAIN_CHANGES_PER_ROUND, PRE_GENERATED_AVATARS, OFFLINE_KEYWORD_PRESET_TEMPLATES } from "@/lib/game-config";

const ROOMS_LOCAL_STORAGE_KEY = "anxian-rooms";

export default function LobbyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [localStorageRooms, setLocalStorageRooms] = useState<GameRoom[]>([]);

  const combinedPresetTemplates = [
    ...OFFLINE_KEYWORD_PRESET_TEMPLATES.map(template => ({
      id: template.id,
      name: template.name,
      maxPlayers: template.playerCount,
      mode: template.mode,
      players: [], // For display purposes, actual players are defined in template or added on join
      status: GameRoomStatus.Waiting, // Presets are always waiting initially
    }))
  ];

  const loadRoomsFromLocalStorage = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
        let allRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
        
        allRooms = allRooms.filter(room => 
          room.status !== GameRoomStatus.Finished &&
          room.players && 
          room.players.length > 0 &&
          room.mode !== RoomMode.ManualInput // Do not display manual input mode rooms from local storage
        );
        
        localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(allRooms));
        setLocalStorageRooms(allRooms);
      } catch (e) {
        console.error("Error loading or filtering rooms from localStorage:", e);
        setLocalStorageRooms([]);
      }
    }
  }, []);

  useEffect(() => {
    loadRoomsFromLocalStorage();
  }, [loadRoomsFromLocalStorage]);

  const handleCreateRoom = useCallback(
    (mode: RoomMode.Online | RoomMode.ManualInput) => {
      if (!user) {
        toast({
          title: "需要登录",
          description: "请先登录再创建房间。",
          variant: "destructive",
        });
        router.push("/login?redirect=/");
        return;
      }

      const baseName = `${user.name}的`;
      const roomName = mode === RoomMode.Online ? `${baseName}模拟游戏` : `${baseName}线下游戏`;
      
      const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const playerCountForConfig = 5; 
      const missionPlayerCounts = MISSIONS_CONFIG[playerCountForConfig] || MISSIONS_CONFIG[Math.min(...Object.keys(MISSIONS_CONFIG).map(Number))];

      const newRoom: GameRoom = {
        id: newRoomId,
        name: roomName,
        players: [{ id: user.id, name: user.name, avatarUrl: user.avatarUrl || PRE_GENERATED_AVATARS[0] }],
        maxPlayers: 10,
        status: GameRoomStatus.Waiting,
        hostId: user.id,
        createdAt: new Date().toISOString(),
        mode: mode,
        teamScores: { teamMemberWins: 0, undercoverWins: 0 },
        missionHistory: [],
        fullVoteHistory: [],
        missionPlayerCounts: missionPlayerCounts,
        totalRounds: TOTAL_ROUNDS_PER_GAME,
        maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND,
        selectedTeamForMission: [],
        teamVotes: [],
        missionCardPlaysForCurrentMission: [],
      };

      const currentRooms = [...localStorageRooms]; 
      currentRooms.push(newRoom);
      localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(currentRooms));
      setLocalStorageRooms(currentRooms); 

      toast({
        title: "房间已创建",
        description: `房间 "${newRoom.name}" 已创建。正在进入...`,
      });
      router.push(`/rooms/${newRoom.id}`);
    },
    [user, router, toast, localStorageRooms] 
  );

  if (authLoading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  // Filter dynamically created rooms to display
  const dynamicallyCreatedRoomsToDisplay = localStorageRooms.filter(room => {
    const isPlayerInRoom = user && room.players.some(p => p.id === user.id);
    if (room.mode === RoomMode.ManualInput) return false; // Never show manual input rooms from localStorage here

    if (room.status === GameRoomStatus.InProgress) {
      return isPlayerInRoom; // Only show in-progress rooms if user is part of them
    }
    return room.status === GameRoomStatus.Waiting; // Shows all other waiting rooms
  }).sort((a, b) => {
    // Prioritize rooms the user is in
    const aIsJoined = user && a.players.some(p => p.id === user.id);
    const bIsJoined = user && b.players.some(p => p.id === user.id);
    if (aIsJoined && !bIsJoined) return -1;
    if (!aIsJoined && bIsJoined) return 1;

    // Then sort by status: In-Progress > Waiting
    const statusOrder = { [GameRoomStatus.InProgress]: 1, [GameRoomStatus.Waiting]: 2, [GameRoomStatus.Finished]: 3 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    // Finally, sort by number of players (descending)
    return b.players.length - a.players.length;
  });


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
      
      <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
        <Button
          size="lg"
          onClick={() => handleCreateRoom(RoomMode.Online)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
        >
          <PlusCircle className="mr-2 h-6 w-6" /> 模拟游戏
        </Button>
        <Button
            size="lg"
            onClick={() => handleCreateRoom(RoomMode.ManualInput)}
            className="bg-purple-600 hover:bg-purple-700 text-white transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
          >
            <KeyRoundIcon className="mr-2 h-6 w-6" /> 线下游戏
        </Button>
      </div>

      <section>
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">
          或选择预设房间模板
        </h2>
        {(combinedPresetTemplates.length === 0 && dynamicallyCreatedRoomsToDisplay.length === 0) ? (
          <p className="text-center text-muted-foreground">暂无预设房间或可加入的房间。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combinedPresetTemplates.filter(template => template.mode === RoomMode.OfflineKeyword).map((roomTemplate) => {
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
                          <CardTitle className="text-primary truncate group-hover:text-primary/90 transition-colors">
                            {roomTemplate.name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="text-xs border-yellow-500 text-yellow-600"
                          >
                            {roomModeName}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
                          {roomIcon}
                          {roomTemplate.maxPlayers} 人
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
                          data-ai-hint="game concept art"
                        />
                      </CardContent>
                    </Card>
                  </a>
                </Link>
              );
            })}

            {dynamicallyCreatedRoomsToDisplay.map((room) => {
               const isUserInRoom = user && room.players.some(p => p.id === user.id);
               const roomIcon = <Users className="mr-2 h-4 w-4" />;
               const roomModeName = getRoomModeDisplayName(room.mode);
               if (!roomModeName) return null; // Should not happen if mode is set
               
               return (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  passHref
                  legacyBehavior
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
                          <CardTitle className="text-primary truncate group-hover:text-primary/90 transition-colors">
                            {room.name}
                          </CardTitle>
                           <Badge
                            variant={room.status === GameRoomStatus.Waiting ? "outline" : "default"}
                            className={cn("ml-auto text-xs", 
                                room.status === GameRoomStatus.InProgress ? "bg-green-500 text-white" :
                                room.status === GameRoomStatus.Waiting ? "border-yellow-500 text-yellow-600" :
                                "bg-gray-500 text-white"
                            )}
                          >
                            {room.status === GameRoomStatus.InProgress ? "游戏中" :
                             room.status === GameRoomStatus.Waiting ? "等待中" :
                             "游戏结束"}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
                          {roomIcon}
                          {room.players.length} / {room.maxPlayers} 玩家
                          <Badge variant="outline" className="ml-2 text-xs border-blue-500 text-blue-600">
                            {roomModeName}
                          </Badge>
                          {isUserInRoom && (
                            <Badge variant="secondary" className="ml-auto text-green-700 bg-green-100 border-green-300">
                              <CheckSquare className="mr-1 h-3 w-3"/> 已加入
                            </Badge>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Image
                         src={room.players.find(p => p.id === room.hostId)?.avatarUrl || `https://placehold.co/600x400.png?text=${encodeURIComponent((room.name || "房").substring(0,2))}`}
                          alt={room.name}
                          width={600}
                          height={400}
                          className="rounded-md mt-2 aspect-video object-cover"
                          data-ai-hint="game party"
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
