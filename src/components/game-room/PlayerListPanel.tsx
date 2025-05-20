
"use client";

import type { User } from "@/lib/types";
import { type GameRoom, type Player, Role, type PlayerVote, type MissionCardPlay, GameRoomStatus } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Users, Eye, ThumbsUp, ThumbsDown, CheckCircle2 as MissionCardSuccessIcon, XCircle as MissionCardFailIcon, Brain, Zap, CheckCircle2 as SelectedIcon, CheckCircle2 as VotedIcon, Target } from "lucide-react";
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
  // Props for team selection mode
  isSelectionModeActive?: boolean;
  selectedPlayersForMission?: string[];
  onTogglePlayerForMission?: (playerId: string) => void;
  selectionLimitForMission?: number;
  // Props for coach assassination mode
  isCoachAssassinationModeActive?: boolean;
  selectedCoachCandidateId?: string | null;
  onSelectCoachCandidate?: (playerId: string) => void;
  assassinationTargetOptionsPlayerIds?: string[];
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
  knownUndercoversByCoach,
  isSelectionModeActive = false,
  selectedPlayersForMission = [],
  onTogglePlayerForMission,
  selectionLimitForMission = 0,
  isCoachAssassinationModeActive = false,
  selectedCoachCandidateId,
  onSelectCoachCandidate,
  assassinationTargetOptionsPlayerIds = [],
}: PlayerListPanelProps) {

  const handlePlayerCardClick = (playerId: string) => {
    if (isSelectionModeActive && onTogglePlayerForMission && user.id === room.currentCaptainId) {
      const canBeSelectedCurrently = selectedPlayersForMission.length < selectionLimitForMission || selectedPlayersForMission.includes(playerId);
      if (canBeSelectedCurrently) {
        onTogglePlayerForMission(playerId);
      }
    } else if (isCoachAssassinationModeActive && onSelectCoachCandidate && assassinationTargetOptionsPlayerIds.includes(playerId)) {
      onSelectCoachCandidate(playerId);
    }
  };

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
              const playerHasVoted = !!playerVoteInfo;
              
              const missionCardPlayInfo = (room.currentPhase === 'mission_reveal' || room.status === GameRoomStatus.Finished) ? 
                room.missionHistory?.find(mh => mh.round === room.currentRound)?.cardPlays?.find(cp => cp.playerId === p.id) : undefined;
              const missionCardPlayed = missionCardPlayInfo?.card;

              const isVirtualPlayer = p.id.startsWith("virtual_");
              
              const isOnMissionTeamForDisplay = room.selectedTeamForMission?.includes(p.id) && 
                                      (room.currentPhase === 'team_voting' || 
                                       room.currentPhase === 'mission_execution' ||
                                       room.currentPhase === 'mission_reveal'); 
              
              const isSelectedForMissionByCaptain = isSelectionModeActive && selectedPlayersForMission.includes(p.id);
              
              const isSelectableForCoachAssassination = isCoachAssassinationModeActive && assassinationTargetOptionsPlayerIds.includes(p.id);
              const isSelectedAsCoachCandidate = isCoachAssassinationModeActive && selectedCoachCandidateId === p.id;

              const canBeClickedForTeamSelection = isSelectionModeActive && user.id === room.currentCaptainId && 
                                               (selectedPlayersForMission.length < selectionLimitForMission || isSelectedForMissionByCaptain);
              
              const canBeClicked = (isSelectionModeActive && canBeClickedForTeamSelection) || (isCoachAssassinationModeActive && isSelectableForCoachAssassination);
              
              let cardClassName = "flex flex-col items-center justify-start p-3 rounded-lg border-2 bg-card shadow-sm h-auto min-h-[120px] transition-all";
              if (isCurrentUser && !isSelectionModeActive && !isCoachAssassinationModeActive) cardClassName = cn(cardClassName, "border-primary ring-1 ring-primary");
              else cardClassName = cn(cardClassName, "border-muted");

              if (isSelectionModeActive) {
                if (canBeClickedForTeamSelection) cardClassName = cn(cardClassName, "cursor-pointer hover:border-accent");
                if (isSelectedForMissionByCaptain) cardClassName = cn(cardClassName, "border-primary ring-2 ring-primary bg-primary/10");
                if (user.id === room.currentCaptainId && !canBeClickedForTeamSelection && !isSelectedForMissionByCaptain) cardClassName = cn(cardClassName, "opacity-50 cursor-not-allowed");
              } else if (isCoachAssassinationModeActive) {
                if (isSelectableForCoachAssassination) cardClassName = cn(cardClassName, "cursor-pointer hover:border-destructive");
                if (isSelectedAsCoachCandidate) cardClassName = cn(cardClassName, "border-destructive ring-2 ring-destructive bg-destructive/10");
                if (!isSelectableForCoachAssassination) cardClassName = cn(cardClassName, "opacity-50 cursor-not-allowed");
              }


              return (
                <div 
                  key={p.id} 
                  onClick={canBeClicked ? () => handlePlayerCardClick(p.id) : undefined}
                  className={cardClassName}
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
                    {isOnMissionTeamForDisplay && (
                       <Zap className="absolute -top-2 -left-2 h-5 w-5 text-orange-400 bg-background rounded-full p-0.5" title="On Mission Team" />
                    )}
                    {isSelectedForMissionByCaptain && (
                      <SelectedIcon className="absolute -bottom-1 -left-1 h-5 w-5 text-green-500 bg-background rounded-full p-0.5" title="Selected for Mission"/>
                    )}
                    {isSelectedAsCoachCandidate && (
                      <Target className="absolute -bottom-1 -left-1 h-5 w-5 text-red-500 bg-background rounded-full p-0.5" title="Targeted Candidate"/>
                    )}
                  </div>

                  <span className="font-medium text-sm text-center mt-2 truncate w-full">{p.name}</span>
                  
                  <div className="flex items-center space-x-1 mt-1.5 h-5">
                    {playerHasVoted && room.currentPhase === 'team_voting' && (
                       <Badge variant="outline" className="px-1.5 py-0.5 text-xs border-blue-500 text-blue-600">
                         <VotedIcon className="h-3 w-3" />
                       </Badge>
                    )}
                    {missionCardPlayed && room.status === GameRoomStatus.Finished && (
                      <Badge className={cn("px-1.5 py-0.5 text-xs", missionCardPlayed === 'success' ? "bg-blue-500 text-white" : "bg-orange-500 text-white")}>
                         {missionCardPlayed === 'success' ? <MissionCardSuccessIcon className="h-3 w-3" /> : <MissionCardFailIcon className="h-3 w-3" />}
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
