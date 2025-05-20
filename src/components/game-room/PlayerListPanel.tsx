
"use client";

import type { User } from "@/lib/types";
import { type GameRoom, type Player, Role, type PlayerVote, type MissionCardPlay, GameRoomStatus } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Users, Eye, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Brain, Zap } from "lucide-react";
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
    <Card className="md:col-span-1 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="mr-2 h-6 w-6 text-primary" /> 玩家 ({localPlayers.length}/{room.maxPlayers})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-2">
        {localPlayers.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-2 gap-3">
            {localPlayers.map((p) => {
              const isCurrentUser = p.id === user.id;
              
              const playerVoteInfo = votesToDisplay.find(v => v.playerId === p.id);
              const playerVote = playerVoteInfo?.vote;
              
              const missionCardPlayed = (room.status === GameRoomStatus.Finished) ? 
                missionPlaysToDisplay.find(cp => cp.playerId === p.id)?.card : undefined;

              const isVirtualPlayer = p.id.startsWith("virtual_");
              
              const isOnMissionTeam = room.selectedTeamForMission?.includes(p.id) && 
                                      (room.currentPhase === 'team_selection' || 
                                       room.currentPhase === 'team_voting' || 
                                       room.currentPhase === 'mission_execution');

              return (
                <div 
                  key={p.id} 
                  className={cn(
                    "flex flex-col items-center justify-start p-3 rounded-lg border-2 bg-card shadow-sm h-auto min-h-[120px]",
                    isCurrentUser ? "border-primary ring-1 ring-primary" : "border-muted"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-2 border-primary/30">
                      <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                      <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {room.status === GameRoomStatus.InProgress && p.id === room.currentCaptainId && (
                      <Crown className="absolute -top-2 -right-2 h-6 w-6 text-yellow-500 bg-background rounded-full p-0.5" title="Captain" />
                    )}
                    {isVirtualPlayer && (
                      <Brain className="absolute -bottom-1 -right-1 h-4 w-4 text-blue-400 bg-background rounded-full p-0.5" title="Virtual Player"/>
                    )}
                    {isOnMissionTeam && (
                       <Zap className="absolute -top-2 -left-2 h-5 w-5 text-orange-400 bg-background rounded-full p-0.5" title="On Mission Team" />
                    )}
                  </div>

                  <span className="font-medium text-sm text-center mt-2 truncate w-full">{p.name}</span>
                  {isCurrentUser && <span className="text-xs text-muted-foreground">(You)</span>}

                  <div className="flex items-center space-x-1 mt-1.5 h-5"> {/* Fixed height for badges container */}
                    {playerVote && (room.currentPhase === 'team_voting' || room.currentPhase === 'mission_execution' || room.currentPhase === 'coach_assassination' || room.currentPhase === 'game_over' || room.currentPhase === 'mission_reveal') && (
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
                        {isCurrentUser && (<Badge variant="secondary" className="flex items-center gap-1 text-xs px-1.5 py-0.5">{getRoleIcon(p.role)} {p.role}</Badge>)}
                        {!isCurrentUser && currentUserRole === Role.Coach && knownUndercoversByCoach.some(kuc => kuc.id === p.id) && (<Badge variant="destructive" className="flex items-center gap-1 text-xs px-1.5 py-0.5"><Eye className="h-3 w-3" /> 卧底</Badge>)}
                        {!isCurrentUser && currentUserRole === Role.Undercover && fellowUndercovers.some(fu => fu.id === p.id) && (<Badge variant="outline" className="flex items-center gap-1 border-destructive text-destructive text-xs px-1.5 py-0.5"><Users className="h-3 w-3" /> 卧底</Badge>)}
                      </>
                    )}
                    {room.status === GameRoomStatus.Finished && p.role && (
                      <Badge variant="outline" className="flex items-center gap-1 border-muted-foreground text-muted-foreground text-xs px-1.5 py-0.5">{getRoleIcon(p.role)} {p.role}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">Waiting for players to join...</p>
        )}
      </CardContent>
    </Card>
  );
}
