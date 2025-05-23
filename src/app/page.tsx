
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, PlusCircle, Eye, CheckSquare } from "lucide-react";
import { GameRoomStatus, type GameRoom, type Player, RoomMode } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PRESET_ROOM_TEMPLATES, MISSIONS_CONFIG, TOTAL_ROUNDS_PER_GAME, MAX_CAPTAIN_CHANGES_PER_ROUND } from "@/lib/game-config";

const ROOMS_LOCAL_STORAGE_KEY = "anxian-rooms";

export default function LobbyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Preset rooms are now the primary display
  const displayedRooms = PRESET_ROOM_TEMPLATES;

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

      <section>
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">选择游戏模式</h2>
        {displayedRooms.length === 0 ? (
          <p className="text-center text-muted-foreground">暂无预设房间。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedRooms.map((roomTemplate) => (
              <Link key={roomTemplate.id} href={`/rooms/${roomTemplate.id}`} passHref legacyBehavior>
                <a className="block group">
                  <Card
                    className={cn(
                      "hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer"
                    )}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-primary truncate group-hover:text-primary/90 transition-colors">{roomTemplate.name}</CardTitle>
                          <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">
                            手动模式
                          </Badge>
                      </div>
                       <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
                          <Users className="mr-2 h-4 w-4" /> {roomTemplate.maxPlayers} 玩家
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                       <Image
                        src={`https://placehold.co/600x400.png?text=${encodeURIComponent(roomTemplate.name.substring(0,2))}`}
                        alt={roomTemplate.name}
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
