
"use client";

import type { User } from "@/lib/types";
import { type GameRoom, type Player, Role, type PlayerVote, GameRoomStatus, type MissionCardPlay } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Users as PlayerIcon, CheckCircle2 as VotedIcon, CheckCircle2 as SelectedIcon, Target, Trash2, ThumbsUp, ThumbsDown, Eye, Users as UsersIcon, Swords, Shield, HelpCircle, XCircle as MissionCardFailIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  isSelectionModeActive?: boolean;
  selectedPlayersForMission?: string[];
  onTogglePlayerForMission?: (playerId: string) => void;
  selectionLimitForMission?: number;
  isCoachAssassinationModeActive?: boolean;
  selectedCoachCandidateId?: string | null;
  onSelectCoachCandidate?: (playerId: string) => void;
  assassinationTargetOptionsPlayerIds?: string[];
  onRemoveVirtualPlayer?: (playerId: string) => void;
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
  onRemoveVirtualPlayer,
}: PlayerListPanelProps) {

  const handlePlayerCardClick = (playerId: string) => {
    if (isSelectionModeActive && onTogglePlayerForMission && user.id === room.currentCaptainId) {
      const canBeSelectedCurrently = selectedPlayersForMission.length < selectionLimitForMission || selectedPlayersForMission.includes(playerId);
      if (canBeSelectedCurrently) {
        onTogglePlayerForMission(playerId);
      }
    } else if (isCoachAssassinationModeActive && onSelectCoachCandidate && assassinationTargetOptionsPlayerIds.includes(playerId) && currentUserRole === Role.Undercover) {
      onSelectCoachCandidate(playerId);
    }
  };

  const isHost = user.id === room.hostId;

  return (
    <Card className="md:col-span-1 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <PlayerIcon className="mr-2 h-6 w-6 text-primary" /> 玩家 ({localPlayers.length}/{room.maxPlayers})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-2">
        {localPlayers.length > 0 ? (
          <div className="grid grid-cols-3 gap-2"> {/* Changed to 3 columns and reduced gap */}
            {localPlayers.map((p) => {
              const isCurrentUser = p.id === user.id;
              const playerVoteInfo = votesToDisplay.find(v => v.playerId === p.id);

              const isOnMissionTeamForDisplay = (
                room.currentPhase === 'team_selection' ||
                room.currentPhase === 'team_voting' ||
                room.currentPhase === 'mission_execution' ||
                room.currentPhase === 'mission_reveal'
              ) && room.selectedTeamForMission?.includes(p.id);

              const missionCardPlayInfo = (room.status === GameRoomStatus.Finished) && room.missionHistory && room.currentRound !== undefined ?
                room.missionHistory.find(mh => mh.round === room.currentRound)?.cardPlays?.find(cp => cp.playerId === p.id) : undefined;
              const missionCardPlayed = missionCardPlayInfo?.card;

              const isVirtualPlayer = p.id.startsWith("virtual_");
              const isSelectedForMissionByCaptain = isSelectionModeActive && selectedPlayersForMission.includes(p.id);
              const isSelectableForCoachAssassination = isCoachAssassinationModeActive && assassinationTargetOptionsPlayerIds.includes(p.id);
              const isSelectedAsCoachCandidate = isCoachAssassinationModeActive && selectedCoachCandidateId === p.id;

              const canBeClickedForTeamSelection = isSelectionModeActive && user.id === room.currentCaptainId &&
                                               (selectedPlayersForMission.length < selectionLimitForMission || isSelectedForMissionByCaptain);

              const canBeClicked = (isSelectionModeActive && canBeClickedForTeamSelection) || (isCoachAssassinationModeActive && isSelectableForCoachAssassination);

              let cardClassName = "relative flex flex-col items-center justify-start p-2 rounded-lg border-2 bg-card shadow-sm h-auto transition-all"; // Reduced padding to p-2

              if (isOnMissionTeamForDisplay && !isSelectionModeActive && !isCoachAssassinationModeActive) {
                cardClassName = cn(cardClassName, "bg-accent/20 border-accent");
              } else if (isCurrentUser && !isSelectionModeActive && !isCoachAssassinationModeActive) {
                cardClassName = cn(cardClassName, "border-primary ring-1 ring-primary");
              } else {
                cardClassName = cn(cardClassName, "border-muted");
              }

              if (isSelectionModeActive && user.id === room.currentCaptainId) {
                if (canBeClickedForTeamSelection) cardClassName = cn(cardClassName, "cursor-pointer hover:border-accent");
                if (isSelectedForMissionByCaptain) cardClassName = cn(cardClassName, "border-primary ring-2 ring-primary bg-primary/10");
                if (!canBeClickedForTeamSelection && !isSelectedForMissionByCaptain) cardClassName = cn(cardClassName, "opacity-50 cursor-not-allowed");
              } else if (isCoachAssassinationModeActive && currentUserRole === Role.Undercover) {
                  if (isSelectableForCoachAssassination) cardClassName = cn(cardClassName, "cursor-pointer hover:border-destructive");
                  if (isSelectedAsCoachCandidate) cardClassName = cn(cardClassName, "border-destructive ring-2 ring-destructive bg-destructive/10");
                  if (!isSelectableForCoachAssassination) cardClassName = cn(cardClassName, "opacity-50 cursor-not-allowed");
              }

              const canRemoveVirtualPlayer = isHost && room.status === GameRoomStatus.Waiting && isVirtualPlayer && onRemoveVirtualPlayer;

              const allVotesInForCurrentTeam = room.currentPhase === 'team_voting' && votesToDisplay.length === room.players.length && room.players.length > 0;

              return (
                <div
                  key={p.id}
                  onClick={canBeClicked ? () => handlePlayerCardClick(p.id) : undefined}
                  className={cardClassName}
                >
                  {canRemoveVirtualPlayer && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-5 w-5 text-destructive hover:bg-destructive/10 z-10 p-0.5" // Smaller remove button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRemoveVirtualPlayer) onRemoveVirtualPlayer(p.id);
                      }}
                      title={`移除 ${p.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-primary/30"> {/* Reduced avatar size */}
                      <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                      <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {room.status === GameRoomStatus.InProgress && p.id === room.currentCaptainId && (
                      <Crown className="absolute -top-1 -right-1 h-5 w-5 text-yellow-500 bg-background rounded-full p-0.5" title="Captain" /> // Adjusted icon position
                    )}
                    {isSelectedForMissionByCaptain && (
                      <SelectedIcon className="absolute -bottom-1 -left-1 h-4 w-4 text-green-500 bg-background rounded-full p-0.5" title="Selected for Mission"/> // Adjusted icon size
                    )}
                    {isSelectedAsCoachCandidate && (
                      <Target className="absolute -bottom-1 -left-1 h-4 w-4 text-red-500 bg-background rounded-full p-0.5" title="Targeted Candidate"/> // Adjusted icon size
                    )}
                  </div>

                  <span className="font-medium text-xs text-center mt-1 truncate w-full">{p.name}</span> {/* Smaller font for name, reduced margin */}

                  <div className="flex items-center space-x-1 mt-1 h-4"> {/* Reduced margin and height */}
                    {(room.currentPhase === 'team_voting' || room.currentPhase === 'mission_reveal') && playerVoteInfo ? (
                      allVotesInForCurrentTeam || room.currentPhase === 'mission_reveal' ? ( // Show specific vote if all voted or in reveal phase
                        playerVoteInfo.vote === 'approve' ? (
                          <Badge variant="default" className="px-1 py-0 text-xs bg-green-500 hover:bg-green-600 text-white" title="同意">
                            <ThumbsUp className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="px-1 py-0 text-xs" title="反对">
                            <ThumbsDown className="h-3 w-3" />
                          </Badge>
                        )
                      ) : ( // Voting in progress, player has voted but not all have
                        <Badge variant="default" className="px-1 py-0 text-xs bg-blue-500 hover:bg-blue-600 text-white" title="已投票">
                          <VotedIcon className="h-3 w-3" />
                        </Badge>
                      )
                    ) : null}


                    {room.status === GameRoomStatus.Finished && missionPlaysToDisplay.find(mp => mp.playerId === p.id) && (
                       <Badge className={cn("px-1 py-0 text-xs", missionPlaysToDisplay.find(mp => mp.playerId === p.id)?.card === 'success' ? "bg-blue-500 text-white" : "bg-orange-500 text-white")}>
                         {missionPlaysToDisplay.find(mp => mp.playerId === p.id)?.card === 'success' ? <VotedIcon className="h-3 w-3" /> : <MissionCardFailIcon className="h-3 w-3" />}
                       </Badge>
                    )}

                    {room.status === GameRoomStatus.InProgress && p.role && (
                      <>
                        {isCurrentUser && (<Badge variant="secondary" className="flex items-center gap-1 text-xs px-1 py-0.5">{getRoleIcon(p.role)} {p.role}</Badge>)}
                        {!isCurrentUser && currentUserRole === Role.Coach && knownUndercoversByCoach.some(kuc => kuc.id === p.id) && (
                           <Badge variant="destructive" className="flex items-center gap-1 text-xs px-1 py-0.5">
                             <Swords className="h-3 w-3 mr-0.5" /> 卧底
                           </Badge>
                        )}
                        {!isCurrentUser && currentUserRole === Role.Undercover && fellowUndercovers.some(fu => fu.id === p.id) && (
                           <Badge variant="destructive" className="flex items-center gap-1 text-xs px-1 py-0.5">
                             <Swords className="h-3 w-3 mr-0.5" /> 卧底
                           </Badge>
                        )}
                      </>
                    )}
                    {room.status === GameRoomStatus.Finished && p.role && (
                      <Badge variant="outline" className="flex items-center gap-1 border-muted-foreground text-muted-foreground text-xs px-1 py-0.5">{getRoleIcon(p.role)} {p.role}</Badge>
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

    