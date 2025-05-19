
"use client";

import type { GameRoom, Player, GameRoomPhase } from "@/lib/types";
import { GameRoomStatus } from "@/lib/types"; // Added import
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // Added import
import { ListChecks, ShieldCheck, ShieldX, XOctagon } from "lucide-react"; // Added XOctagon

type RoomHeaderProps = {
  room: GameRoom;
  localPlayers: Player[];
  getPhaseDescription: (phase?: GameRoomPhase) => string;
  isHost: boolean; // Added prop
  onForceEndGame: () => void; // Added prop
};

export function RoomHeader({ room, localPlayers, getPhaseDescription, isHost, onForceEndGame }: RoomHeaderProps) {
  if (!room) return null;

  const hostName = localPlayers.find(p => p.id === room.hostId)?.name || '未知';

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-3xl text-primary flex items-center">{room.name}</CardTitle>
            <CardDescription>房间 ID: {room.id} | 主持人: {hostName}</CardDescription>
          </div>
          <div className="flex items-center gap-2"> {/* Wrapper for badge and button */}
            <Badge 
              variant={room.status === GameRoomStatus.Waiting ? "outline" : "default"} 
              className={`ml-auto ${room.status === GameRoomStatus.Waiting ? "border-yellow-500 text-yellow-500" : room.status === GameRoomStatus.InProgress ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}
            >
              {room.status.toUpperCase()}
            </Badge>
            {isHost && room.status === GameRoomStatus.InProgress && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onForceEndGame}
                className="transition-transform hover:scale-105 active:scale-95"
                title="强制结束游戏"
              >
                <XOctagon className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">强制结束</span>
              </Button>
            )}
          </div>
        </div>
        {room.status === GameRoomStatus.InProgress && (
          <div className="mt-2 text-sm text-muted-foreground space-y-1">
             <p>第 {room.currentRound} 场比赛，第 {(room.captainChangesThisRound || 0) + 1} 次组队</p>
            {room.currentPhase && <div className="flex items-center"><ListChecks className="mr-2 h-4 w-4 text-purple-500" /> 当前阶段: {getPhaseDescription(room.currentPhase)}</div>}
            {room.teamScores && (
              <div className="flex items-center gap-4">
                <span className="flex items-center"><ShieldCheck className="mr-1 h-4 w-4 text-green-500" /> 战队胜场: {room.teamScores.teamMemberWins}</span>
                <span className="flex items-center"><ShieldX className="mr-1 h-4 w-4 text-destructive" /> 卧底胜场: {room.teamScores.undercoverWins}</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>
    </Card>
  );
}

