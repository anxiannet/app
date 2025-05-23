
"use client";

import type { User } from "@/lib/types";
import { type GameRoom, type Player, Role, type PlayerVote, GameRoomStatus, RoomMode } from "@/lib/types";
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
  isInSelectionMode?: boolean;
  selectedPlayersForMission?: string[];
  onTogglePlayerForMission?: (playerId: string) => void;
  selectionLimitForMission?: number;
  isCoachAssassinationModeActive?: boolean;
  selectedCoachCandidateId?: string | null;
  onSelectCoachCandidate?: (playerId: string) => void;
  assassinationTargetOptionsPlayerIds?: string[];
  onRemovePlayer?: (playerId: string) => void; // Renamed from onRemoveVirtualPlayer
  isHostCurrentUser?: boolean; // New prop
};

export function PlayerListPanel({
  localPlayers,
  user,
  room,
  currentUserRole,
  votesToDisplay,
  fellowUndercovers,
  knownUndercoversByCoach,
  isInSelectionMode = false,
  selectedPlayersForMission = [],
  onTogglePlayerForMission,
  selectionLimitForMission = 0,
  isCoachAssassinationModeActive = false,
  selectedCoachCandidateId,
  onSelectCoachCandidate,
  assassinationTargetOptionsPlayerIds = [],
  onRemovePlayer,
  isHostCurrentUser,
}: PlayerListPanelProps) {

  const getRoleIcon = (role?: Role, iconSizeClass = "h-3.5 w-3.5 mr-1") => { // Adjusted icon size
    switch (role) {
      case Role.Undercover: return <Swords className={cn(iconSizeClass, "text-destructive")} />;
      case Role.TeamMember: return <Shield className={cn(iconSizeClass, "text-blue-500")} />;
      case Role.Coach: return <HelpCircle className={cn(iconSizeClass, "text-yellow-500")} />;
      default: return null;
    }
  };

  const getRoleBadgeClassName = (role?: Role): string => {
    let baseClass = "flex items-center gap-1 text-xs px-1.5 py-0.5 border rounded-full"; // Adjusted padding and rounded
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
    if (isInSelectionMode && onTogglePlayerForMission) {
      const canBeSelectedCurrently = selectedPlayersForMission.length < selectionLimitForMission || selectedPlayersForMission.includes(playerId);
      if (canBeSelectedCurrently) {
        onTogglePlayerForMission(playerId);
      }
    } else if (isCoachAssassinationModeActive && onSelectCoachCandidate && assassinationTargetOptionsPlayerIds.includes(playerId)) {
      const isUndercoverOnline = room.mode === RoomMode.Online && currentUserRole === Role.Undercover;
      const isHostManual = room.mode === RoomMode.ManualInput && user.id === room.hostId;

      if (isUndercoverOnline || isHostManual) {
        onSelectCoachCandidate(playerId);
      }
    }
  };

  let panelTitleNode: React.ReactNode;
  if (room.status === GameRoomStatus.Waiting) {
    panelTitleNode = (
      <>
        <UsersIcon className="mr-2 h-5 w-5 text-primary" />
        玩家 ({localPlayers.length}/{room.maxPlayers})
      </>
    );
  } else {
    const roleCounts = localPlayers.reduce((acc, player) => {
      if (player.role) {
        acc[player.role] = (acc[player.role] || 0) + 1;
      }
      return acc;
    }, {} as Record<Role, number>);

    panelTitleNode = (
       <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm">
        <span>角色分布:</span>
        {Object.entries(roleCounts).map(([role, count]) => (
          <span key={role} className="flex items-center">
            {getRoleIcon(role as Role, "h-4 w-4 mr-1")} {role as Role}: {count}
          </span>
        ))}
      </div>
    );
  }


  return (
    <Card className="md:col-span-1 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-base">
          {panelTitleNode}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-2">
        {localPlayers.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {localPlayers.map((p) => {
              const isCurrentUser = p.id === user.id;
              const playerVoteInfo = votesToDisplay.find(v => v.playerId === p.id);
              const allVotesInForCurrentTeam = votesToDisplay.length === room.players.length && room.players.length > 0;


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
              const isSelectedForMissionByCaptain = isInSelectionMode && selectedPlayersForMission.includes(p.id);
              const isSelectableForCoachAssassination = isCoachAssassinationModeActive && assassinationTargetOptionsPlayerIds.includes(p.id);
              const isSelectedAsCoachCandidate = isCoachAssassinationModeActive && selectedCoachCandidateId === p.id;

              const canBeClickedForTeamSelection = isInSelectionMode && (selectedPlayersForMission.length < selectionLimitForMission || isSelectedForMissionByCaptain);
              const canBeClicked = (isInSelectionMode && canBeClickedForTeamSelection) || (isCoachAssassinationModeActive && isSelectableForCoachAssassination);

              let cardClassName = "relative flex flex-col items-center justify-start p-1 rounded-lg border-2 bg-card shadow-sm h-auto transition-all text-xs"; // Reduced padding

              if (isOnMissionTeamForDisplay) {
                 cardClassName = cn(cardClassName, "bg-accent/20 border-accent");
              } else if (isCurrentUser) {
                cardClassName = cn(cardClassName, "border-primary ring-1 ring-primary");
              } else {
                cardClassName = cn(cardClassName, "border-muted");
              }

              if (isInSelectionMode) {
                if (canBeClickedForTeamSelection) cardClassName = cn(cardClassName, "cursor-pointer hover:border-accent");
                if (isSelectedForMissionByCaptain) cardClassName = cn(cardClassName, "border-primary ring-2 ring-primary bg-primary/10");
                if (!canBeClickedForTeamSelection && !isSelectedForMissionByCaptain) cardClassName = cn(cardClassName, "opacity-50 cursor-not-allowed");
              } else if (isCoachAssassinationModeActive) {
                  if (isSelectableForCoachAssassination) cardClassName = cn(cardClassName, "cursor-pointer hover:border-destructive");
                  if (isSelectedAsCoachCandidate) cardClassName = cn(cardClassName, "border-destructive ring-2 ring-destructive bg-destructive/10");
                  if (!isSelectableForCoachAssassination) cardClassName = cn(cardClassName, "opacity-50 cursor-not-allowed");
              }

              const canRemoveThisPlayer = 
                isHostCurrentUser && 
                room.status === GameRoomStatus.Waiting && 
                p.id !== user.id && // Host cannot remove themselves
                (
                  (room.mode === RoomMode.Online && isVirtualPlayer) || // Online mode: only virtual players
                  (room.mode === RoomMode.ManualInput) // Manual mode: any player (except host)
                ) &&
                onRemovePlayer;


              return (
                <div
                  key={p.id}
                  onClick={canBeClicked ? () => handlePlayerCardClick(p.id) : undefined}
                  className={cardClassName}
                >
                  {canRemoveThisPlayer && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-5 w-5 text-destructive hover:bg-destructive/10 z-10 p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRemovePlayer) onRemovePlayer(p.id);
                      }}
                      title={`移除 ${p.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                   <div className="flex items-center space-x-1.5 w-full"> {/* Name next to avatar */}
                    <div className="relative flex-shrink-0">
                        <Avatar className="h-8 w-8 border-2 border-primary/30"> {/* Reduced avatar size */}
                        <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                        <AvatarFallback className="text-sm">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {room.status === GameRoomStatus.InProgress && p.id === room.currentCaptainId && (
                        <Crown className="absolute -top-1 -right-1 h-3.5 w-3.5 text-yellow-500 bg-background rounded-full p-0.5" title="队长" />
                        )}
                        {isSelectedForMissionByCaptain && (
                        <SelectedIcon className="absolute -bottom-1 -left-1 h-3.5 w-3.5 text-green-500 bg-background rounded-full p-0.5" title="已选择出战"/>
                        )}
                        {isSelectedAsCoachCandidate && (
                        <Target className="absolute -bottom-1 -left-1 h-3.5 w-3.5 text-red-500 bg-background rounded-full p-0.5" title="指认目标"/>
                        )}
                    </div>
                    <span className="font-medium text-center truncate text-xs flex-grow">{p.name}</span> {/* Reduced name font size */}
                  </div>

                  <div className="flex items-center justify-center space-x-1 mt-1 h-auto min-h-[1rem]">
                     {(room.currentPhase === 'team_voting' || room.currentPhase === 'mission_reveal') && playerVoteInfo ? (
                        (allVotesInForCurrentTeam || room.currentPhase === 'mission_reveal') ? (
                            playerVoteInfo.vote === 'approve' ? (
                            <Badge variant="default" className="px-1 py-0.5 text-xs bg-green-500 hover:bg-green-600 text-white" title="同意">
                                <ThumbsUp className="h-2.5 w-2.5" />
                            </Badge>
                            ) : (
                            <Badge variant="destructive" className="px-1 py-0.5 text-xs" title="反对">
                                <ThumbsDown className="h-2.5 w-2.5" />
                            </Badge>
                            )
                        ) : (
                            votesToDisplay.some(v => v.playerId === p.id) && (
                                <Badge variant="default" className="px-1 py-0.5 text-xs bg-blue-500 hover:bg-blue-600 text-white" title="已投票">
                                <VotedIcon className="h-2.5 w-2.5" />
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
                      <Badge className={cn(getRoleBadgeClassName(p.role))}>
                        {getRoleIcon(p.role)}
                        {p.role}
                      </Badge>
                    )}

                    {room.status === GameRoomStatus.Finished && room.mode !== RoomMode.ManualInput && missionCardPlayed && (
                      <Badge
                        className={cn(
                          "px-1 py-0.5 text-xs",
                          missionCardPlayed === 'success' ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                        )}
                        title={missionCardPlayed === 'success' ? "成功" : "破坏"}
                      >
                        {missionCardPlayed === 'success' ? <VotedIcon className="h-2.5 w-2.5" /> : <MissionCardFailIcon className="h-2.5 w-2.5" />}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">等待玩家加入...</p>
        )}
      </CardContent>
    </Card>
  );
}

    