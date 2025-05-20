
"use client";

import type { GameRoom, Player, GameRoomPhase } from "@/lib/types";
import { GameRoomStatus } from "@/lib/types"; 
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; 
import { ListChecks, ShieldCheck, ShieldX, XOctagon } from "lucide-react"; 

type RoomHeaderProps = {
  room: GameRoom;
  localPlayers: Player[];
  getPhaseDescription: (phase?: GameRoomPhase) => string;
  isHost: boolean; 
  onPromptTerminateGame: () => void; 
};

export function RoomHeader({ room, localPlayers, getPhaseDescription, isHost, onPromptTerminateGame }: RoomHeaderProps) {
  if (!room) return null;

  const hostName = localPlayers.find(p => p.id === room.hostId)?.name || '未知';

  const displayStatus = room.status === GameRoomStatus.InProgress ? "游戏中" : room.status === GameRoomStatus.Waiting ? "等待中" : room.status.toUpperCase();

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-3xl text-primary flex items-center">{room.name}</CardTitle>
            <CardDescription>主持人: {hostName}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={room.status === GameRoomStatus.Waiting ? "outline" : "default"} 
              className={`ml-auto ${room.status === GameRoomStatus.Waiting ? "border-yellow-500 text-yellow-500" : room.status === GameRoomStatus.InProgress ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}
            >
              {displayStatus}
            </Badge>
            {isHost && room.status === GameRoomStatus.InProgress && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onPromptTerminateGame} // Changed to trigger dialog
                className="transition-transform hover:scale-105 active:scale-95"
                title="终止游戏"
              >
                <XOctagon className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">终止游戏</span>
              </Button>
            )}
          </div>
        </div>
        {room.status === GameRoomStatus.InProgress && (
          <div className="mt-2 text-sm text-muted-foreground space-y-1">
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
