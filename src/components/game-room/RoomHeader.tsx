
"use client";

import type { GameRoom, Player, GameRoomPhase } from "@/lib/types";
import { GameRoomStatus, Role } from "@/lib/types"; 
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; 
import { ListChecks, ShieldCheck, ShieldX, XOctagon, Shield, HelpCircle, Swords } from "lucide-react"; 
import { cn } from "@/lib/utils";

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

  let displayStatus = room.status.toUpperCase();
  let statusClass = "bg-gray-500 text-white";
  if (room.status === GameRoomStatus.InProgress) {
    displayStatus = "游戏中";
    statusClass = "bg-green-500 text-white";
  } else if (room.status === GameRoomStatus.Waiting) {
    displayStatus = "等待中";
    statusClass = "border-yellow-500 text-yellow-600";
  } else if (room.status === GameRoomStatus.Finished) {
    displayStatus = "游戏结束";
  }

  let teamMemberCount = 0;
  let coachCount = 0;
  let undercoverCount = 0;

  if (room.status === GameRoomStatus.InProgress || room.status === GameRoomStatus.Finished) {
    localPlayers.forEach(player => {
      if (player.role === Role.TeamMember) teamMemberCount++;
      else if (player.role === Role.Coach) coachCount++;
      else if (player.role === Role.Undercover) undercoverCount++;
    });
  }

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
              className={cn("ml-auto", statusClass)}
            >
              {displayStatus}
            </Badge>
            {isHost && room.status === GameRoomStatus.InProgress && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onPromptTerminateGame} 
                className="transition-transform hover:scale-105 active:scale-95"
                title="终止游戏"
              >
                <XOctagon className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">终止游戏</span>
                <span className="sm:hidden">终止</span>
              </Button>
            )}
          </div>
        </div>
        {(room.status === GameRoomStatus.InProgress || room.status === GameRoomStatus.Finished) && (
          <div className="mt-2 text-sm text-muted-foreground space-y-1">
            {room.teamScores && (
              <div className="flex items-center gap-4">
                <span className="flex items-center text-sm"> 
                  <ShieldCheck className="mr-1 h-4 w-4 text-green-500" /> 战队胜场: {room.teamScores.teamMemberWins}
                </span>
                <span className="flex items-center text-sm"> 
                  <ShieldX className="mr-1 h-4 w-4 text-destructive" /> 卧底胜场: {room.teamScores.undercoverWins}
                </span>
              </div>
            )}
            {(teamMemberCount > 0 || coachCount > 0 || undercoverCount > 0) && (
              <div className="pt-1 text-sm">
                <span className="font-medium">角色分布:</span>
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pl-1"> {/* Added pl-1 for slight indent */}
                  <span className="flex items-center" title="队员">
                    <Shield className="mr-1 h-4 w-4 text-green-500" /> 队员: {teamMemberCount}
                  </span>
                  {coachCount > 0 && (
                    <span className="flex items-center" title="教练">
                      <HelpCircle className="mr-1 h-4 w-4 text-yellow-500" /> 教练: {coachCount}
                    </span>
                  )}
                  <span className="flex items-center" title="卧底">
                    <Swords className="mr-1 h-4 w-4 text-destructive" /> 卧底: {undercoverCount}
                  </span>
                </div>
              </div>
            )}
             {room.currentPhase && room.status === GameRoomStatus.InProgress && (
                 <div className="flex items-center"><ListChecks className="mr-2 h-4 w-4 text-purple-500" /> 当前阶段: {getPhaseDescription(room.currentPhase)}</div>
            )}
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
