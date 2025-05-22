
"use client";

import type { User } from "@/lib/types";
import { type GameRoom, type Player, Role, type PlayerVote, GameRoomStatus, RoomMode, type MissionCardPlay } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, CheckCircle2 as VotedIcon, CheckCircle2 as SelectedIcon, Target, Trash2, ThumbsUp, ThumbsDown, Users as UsersIcon, Swords, Shield, HelpCircle, XCircle as MissionCardFailIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PlayerListPanelProps = {
  localPlayers: Player[];
  user: User;
  room: GameRoom;
  currentUserRole?: Role;
  votesToDisplay: PlayerVote[];
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

  const getRoleIcon = (role?: Role, iconSizeClass = "h-2 w-2 mr-0.5") => {
    switch (role) {
      case Role.Undercover: return <Swords className={cn(iconSizeClass, "text-destructive")} />;
      case Role.TeamMember: return <Shield className={cn(iconSizeClass, "text-blue-500")} />;
      case Role.Coach: return <HelpCircle className={cn(iconSizeClass, "text-yellow-500")} />;
      default: return null;
    }
  };

  const getRoleBadgeClassName = (role?: Role): string => {
    let baseClass = "flex items-center gap-1 text-[9px] px-1 py-0.5 border";
    if (role === Role.TeamMember) {
      return cn(baseClass, "bg-blue-100 text-blue-700 border-blue-300");
    } else if (role === Role.Coach) {
      return cn(baseClass, "bg-yellow-100 text-yellow-700 border-yellow-300");
    } else if (role === Role.Undercover) {
      return cn(baseClass, "bg-red-100 text-red-700 border-red-300");
    }
    return cn(baseClass, "bg-gray-100 text-gray-700 border-gray-300");
  };

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

  let panelTitleNode: React.ReactNode;
  if (room.status === GameRoomStatus.Waiting) {
    panelTitleNode = (
      <>
        <UsersIcon className="mr-2 h-5 w-5 text-primary" />
        玩家 ({localPlayers.length}/{room.maxPlayers})
      </>
    );
  } else {
    panelTitleNode = <>角色分布</>;
  }

  return (
    <Card className="md:col-span-1 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-sm">
          {panelTitleNode}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-2">
        {localPlayers.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {localPlayers.map((p) => {
              const isCurrentUser = p.id === user.id;
              const playerVoteInfo = votesToDisplay.find(v => v.playerId === p.id);
              const allVotesInForCurrentTeam = (room.currentPhase === 'team_voting' || room.currentPhase === 'mission_reveal') && votesToDisplay.length === room.players.length && room.players.length > 0;

              const isOnMissionTeamForDisplay = (
                room.currentPhase === 'team_selection' ||
                room.currentPhase === 'team_voting' ||
                room.currentPhase === 'mission_execution' ||
                room.currentPhase === 'mission_reveal'
              ) && room.selectedTeamForMission?.includes(p.id);

              const missionCardPlayInfo = (room.status === GameRoomStatus.Finished && room.mode !== RoomMode.ManualInput) &&
                room.missionHistory?.find(mh => mh.round === room.currentRound)?.cardPlays?.find(cp => cp.playerId === p.id);
              const missionCardPlayed = missionCardPlayInfo?.card;

              const isVirtualPlayer = p.id.startsWith("virtual_");
              const isSelectedForMissionByCaptain = isSelectionModeActive && selectedPlayersForMission.includes(p.id);
              const isSelectableForCoachAssassination = isCoachAssassinationModeActive && assassinationTargetOptionsPlayerIds.includes(p.id);
              const isSelectedAsCoachCandidate = isCoachAssassinationModeActive && selectedCoachCandidateId === p.id;

              const canBeClickedForTeamSelection = isSelectionModeActive && user.id === room.currentCaptainId &&
                                               (selectedPlayersForMission.length < selectionLimitForMission || isSelectedForMissionByCaptain);

              const canBeClicked = (isSelectionModeActive && canBeClickedForTeamSelection) || (isCoachAssassinationModeActive && isSelectableForCoachAssassination);

              let cardClassName = "relative flex flex-col items-center justify-start p-1 rounded-lg border-2 bg-card shadow-sm h-auto transition-all text-[10px]";

              if (isOnMissionTeamForDisplay) {
                 cardClassName = cn(cardClassName, "bg-accent/20 border-accent");
              } else if (isCurrentUser) {
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
                      className="absolute top-0 right-0 h-4 w-4 text-destructive hover:bg-destructive/10 z-10 p-0.5"
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
                    <Avatar className="h-8 w-8 border-2 border-primary/30">
                      <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                      <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {room.status === GameRoomStatus.InProgress && p.id === room.currentCaptainId && (
                      <Crown className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500 bg-background rounded-full p-0.5" title="Captain" />
                    )}
                    {isSelectedForMissionByCaptain && (
                      <SelectedIcon className="absolute -bottom-1 -left-1 h-3 w-3 text-green-500 bg-background rounded-full p-0.5" title="Selected for Mission"/>
                    )}
                    {isSelectedAsCoachCandidate && (
                      <Target className="absolute -bottom-1 -left-1 h-3 w-3 text-red-500 bg-background rounded-full p-0.5" title="Targeted Candidate"/>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 mt-0.5">
                    <span className="font-medium text-center truncate w-full text-xs">{p.name}</span>
                  </div>

                  <div className="flex items-center space-x-1 mt-0.5 h-4">
                    {(room.currentPhase === 'team_voting' || room.currentPhase === 'mission_reveal') && playerVoteInfo ? (
                        allVotesInForCurrentTeam ? (
                            playerVoteInfo.vote === 'approve' ? (
                            <Badge variant="default" className="px-1 py-0 text-[9px] bg-green-500 hover:bg-green-600 text-white" title="同意">
                                <ThumbsUp className="h-2 w-2" />
                            </Badge>
                            ) : (
                            <Badge variant="destructive" className="px-1 py-0 text-[9px]" title="反对">
                                <ThumbsDown className="h-2 w-2" />
                            </Badge>
                            )
                        ) : (
                            votesToDisplay.some(v => v.playerId === p.id) && (
                                <Badge variant="default" className="px-1 py-0 text-[9px] bg-blue-500 hover:bg-blue-600 text-white" title="已投票">
                                <VotedIcon className="h-2 w-2" />
                                </Badge>
                            )
                        )
                    ) : null}

                    {room.mode !== RoomMode.ManualInput && p.role && (
                      (isCurrentUser && room.status === GameRoomStatus.InProgress) ||
                      (room.status === GameRoomStatus.Finished) ||
                      (!isCurrentUser && currentUserRole === Role.Coach && knownUndercoversByCoach.some(kuc => kuc.id === p.id) && p.role === Role.Undercover) ||
                      (!isCurrentUser && currentUserRole === Role.Undercover && fellowUndercovers.some(fu => fu.id === p.id) && p.role === Role.Undercover)
                    ) && (
                      <Badge className={cn(getRoleBadgeClassName(p.role), "text-[9px]")}>
                        {getRoleIcon(p.role, "h-2 w-2 mr-0.5")}
                        {p.role}
                      </Badge>
                    )}

                    {room.status === GameRoomStatus.Finished && room.mode !== RoomMode.ManualInput && missionCardPlayed && (
                      <Badge
                        className={cn(
                          "px-1 py-0 text-[9px]",
                          missionCardPlayed === 'success' ? "bg-blue-500 text-white" : "bg-orange-500 text-white"
                        )}
                        title={missionCardPlayed === 'success' ? "成功" : "破坏"}
                      >
                        {missionCardPlayed === 'success' ? <VotedIcon className="h-2 w-2" /> : <MissionCardFailIcon className="h-2 w-2" />}
                      </Badge>
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

    