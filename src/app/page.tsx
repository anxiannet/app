
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
import { Users, PlusCircle, Eye, CheckSquare } from "lucide-react";
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
import { PRESET_ROOM_TEMPLATES, MISSIONS_CONFIG, TOTAL_ROUNDS_PER_GAME, MAX_CAPTAIN_CHANGES_PER_ROUND, PRE_GENERATED_AVATARS } from "@/lib/game-config";


const ROOMS_LOCAL_STORAGE_KEY = "anxian-rooms";

export default function LobbyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // For dynamically created rooms (if any were to be listed, not currently implemented beyond presets)
  const [localStorageRooms, setLocalStorageRooms] = useState<GameRoom[]>([]);

  // Displayed rooms will be the preset templates
  const displayedRooms = PRESET_ROOM_TEMPLATES;

  // Load existing rooms from localStorage - useful for direct navigation or future dynamic room listings
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
        if (storedRoomsRaw) {
          setLocalStorageRooms(JSON.parse(storedRoomsRaw));
        }
      } catch (e) {
        console.error("Error loading rooms from localStorage:", e);
        setLocalStorageRooms([]);
      }
    }
  }, []);

  const updateLocalStorageRooms = useCallback((updatedRooms: GameRoom[]) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(updatedRooms));
        setLocalStorageRooms(updatedRooms);
      } catch (e) {
        console.error("Error saving rooms to localStorage:", e);
      }
    }
  }, []);


  const handleCreateRoom = useCallback(
    async (mode: RoomMode) => {
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
      const playerCountForConfig = 5; // Default to 5 players for mission config, adjust if needed
      const missionPlayerCounts = MISSIONS_CONFIG[playerCountForConfig] || MISSIONS_CONFIG[Math.min(...Object.keys(MISSIONS_CONFIG).map(Number))];


      const newRoom: GameRoom = {
        id: newRoomId,
        name: roomName,
        players: [{ id: user.id, name: user.name, avatarUrl: user.avatarUrl || PRE_GENERATED_AVATARS[0] }],
        maxPlayers: 10, // Default max players
        status: GameRoomStatus.Waiting,
        hostId: user.id,
        createdAt: new Date().toISOString(),
        mode: mode,
        // Initialize game state fields
        teamScores: { teamMemberWins: 0, undercoverWins: 0 },
        missionHistory: [],
        fullVoteHistory: [],
        missionPlayerCounts: missionPlayerCounts, // Default for 5 players or smallest config
        totalRounds: TOTAL_ROUNDS_PER_GAME,
        maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND,
        selectedTeamForMission: [],
        teamVotes: [],
        missionCardPlaysForCurrentMission: [],
      };

      const currentRooms = [...localStorageRooms];
      currentRooms.push(newRoom);
      updateLocalStorageRooms(currentRooms);

      toast({
        title: "房间已创建",
        description: `房间 "${newRoom.name}" 已创建。正在进入...`,
      });
      router.push(`/rooms/${newRoom.id}`);
    },
    [user, router, toast, localStorageRooms, updateLocalStorageRooms]
  );


  if (authLoading) {
    return <div className="text-center py-10">加载中...</div>;
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
      </section>

      {user && (
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button
            size="lg"
            onClick={() => handleCreateRoom(RoomMode.Online)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
          >
            <PlusCircle className="mr-2 h-6 w-6" /> 创建模拟游戏
          </Button>
          <Button
            size="lg"
            onClick={() => handleCreateRoom(RoomMode.ManualInput)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
          >
            <PlusCircle className="mr-2 h-6 w-6" /> 创建线下游戏
          </Button>
        </div>
      )}
       {!user && (
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button
            size="lg"
            onClick={() => handleCreateRoom(RoomMode.Online)} // Will trigger login prompt
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
          >
            <PlusCircle className="mr-2 h-6 w-6" /> 创建模拟游戏
          </Button>
          <Button
            size="lg"
            onClick={() => handleCreateRoom(RoomMode.ManualInput)} // Will trigger login prompt
            className="bg-accent hover:bg-accent/90 text-accent-foreground transition-transform hover:scale-105 active:scale-95 shadow-md w-full sm:w-auto"
          >
            <PlusCircle className="mr-2 h-6 w-6" /> 创建线下游戏
          </Button>
        </div>
      )}


      <section>
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">
          或选择预设房间模板
        </h2>
        {displayedRooms.length === 0 ? (
          <p className="text-center text-muted-foreground">暂无预设房间。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedRooms.map((roomTemplate) => (
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
                          className="text-xs border-blue-500 text-blue-600"
                        >
                          {roomTemplate.mode === RoomMode.ManualInput ? "手动模式" : "在线模式"}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
                        <Users className="mr-2 h-4 w-4" />{" "}
                        {roomTemplate.maxPlayers} 玩家
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
