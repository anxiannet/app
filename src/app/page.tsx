
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

  // Removed localStorageRooms state and related loading logic as dynamic rooms are no longer displayed.

  // The handleCreateRoom function is removed as direct room creation buttons are removed.
  // Users will now only interact with preset keyword game templates from the lobby.

  if (authLoading) {
    return <div className="text-center py-10">加载中...</div>;
  }

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

      {/* Buttons for creating Online/Manual rooms are removed */}

      <section>
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">
          选择一个暗语局模板开始
        </h2>
        {OFFLINE_KEYWORD_PRESET_TEMPLATES.length === 0 ? (
          <p className="text-center text-muted-foreground">暂无预设暗语局房间模板。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {OFFLINE_KEYWORD_PRESET_TEMPLATES.map((roomTemplate) => {
               const roomModeName = getRoomModeDisplayName(roomTemplate.mode);
               if (!roomModeName) return null; // Should not happen for defined templates

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
