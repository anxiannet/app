
"use client";

import type { User } from "@/lib/types";
import { type GameRoom, type Player, Role, type PlayerVote, type MissionCardPlay, GameRoomStatus } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Users, Eye, ThumbsUp, ThumbsDown, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type PlayerListPanelProps = {
  localPlayers: Player[];
  user: User;
  room: GameRoom;
  currentUserRole?: Role;
  votesToDisplay: PlayerVote[];
  missionPlaysToDisplay: MissionCardPlay[];
  getRoleIcon: (role?: Role) => JSX.Element | null;
  fellowUndercovers: Player[];
  knownUndercoversByCoach: Player[];
};

export function PlayerListPanel({ 
  localPlayers, 
  user, 
  room, 
  currentUserRole, 
  votesToDisplay,
  missionPlaysToDisplay,
  getRoleIcon,
  fellowUndercovers,
  knownUndercoversByCoach
}: PlayerListPanelProps) {

  return (
    <Card className="md:col-span-1">
      <CardHeader><CardTitle className="flex items-center"><Users className="mr-2 h-6 w-6 text-primary" /> 玩家 ({localPlayers.length}/{room.maxPlayers})</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {localPlayers.map((p) => {
            const isCurrentUser = p.id === user.id;
            
            const playerVoteInfo = votesToDisplay.find(v => v.playerId === p.id);
            const playerVote = playerVoteInfo?.vote;
            
            const missionCardPlayInfo = (room.currentPhase === 'mission_reveal' || room.status === GameRoomStatus.Finished) && missionPlaysToDisplay.find(cp => cp.playerId === p.id);
            const missionCardPlayed = missionCardPlayInfo?.card;

            return (
              <li key={p.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md shadow-sm">
                <div className="flex items-center">
                  <Avatar className="h-10 w-10 mr-3 border-2 border-primary/50">
                    <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                    <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{p.name} {isCurrentUser && "(你)"} {p.id.startsWith("virtual_") && <span className="text-xs text-blue-400">(虚拟)</span>}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {playerVote && (room.currentPhase === 'team_voting' || room.currentPhase === 'mission_execution' || room.currentPhase === 'mission_reveal' || room.currentPhase === 'coach_assassination' || room.status === GameRoomStatus.Finished) && (
                    <Badge className={cn("px-1.5 py-0.5 text-xs", playerVote === 'approve' ? "bg-green-500 hover:bg-green-600 text-white" : "bg-red-500 hover:bg-red-600 text-white")}>
                      {playerVote === 'approve' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                    </Badge>
                  )}
                  {missionCardPlayed && (
                    <Badge className={cn("px-1.5 py-0.5 text-xs", missionCardPlayed === 'success' ? "bg-blue-500 text-white" : "bg-orange-500 text-white")}>
                       {missionCardPlayed === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    </Badge>
                  )}
                  
                  {room.status === GameRoomStatus.InProgress && p.role && (
                    <>
                      {isCurrentUser && (<Badge variant="secondary" className="flex items-center gap-1">{getRoleIcon(p.role)} {p.role}</Badge>)}
                      {!isCurrentUser && currentUserRole === Role.Coach && knownUndercoversByCoach.some(kuc => kuc.id === p.id) && (<Badge variant="destructive" className="flex items-center gap-1"><Eye className="h-4 w-4" /> 卧底</Badge>)}
                      {!isCurrentUser && currentUserRole === Role.Undercover && fellowUndercovers.some(fu => fu.id === p.id) && (<Badge variant="outline" className="flex items-center gap-1 border-destructive text-destructive"><Users className="h-4 w-4" /> 卧底队友</Badge>)}
                    </>
                  )}
                  {room.status === GameRoomStatus.Finished && p.role && (
                    <Badge variant="outline" className="flex items-center gap-1 border-muted-foreground text-muted-foreground">{getRoleIcon(p.role)} {p.role}</Badge>
                  )}

                  {room.status === GameRoomStatus.InProgress && p.id === room.currentCaptainId && <Crown className="h-5 w-5 text-yellow-500" title="Captain" />}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
