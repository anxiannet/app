
"use client";

import { Button } from "@/components/ui/button";
import { UsersRound } from "lucide-react";
import { RoomMode } from "@/lib/types";

type TeamSelectionControlsProps = {
  roomMode: RoomMode;
  isHostCurrentUser: boolean;
  isDesignatedCaptainTheCurrentUser: boolean;
  showActiveControls: boolean; // New prop to determine if active UI is shown
  currentCaptainName?: string;
  requiredPlayersForCurrentMission: number;
  selectedMissionTeamLength: number;
  onHumanProposeTeam: () => void;
};

export function TeamSelectionControls({
  roomMode,
  isHostCurrentUser,
  isDesignatedCaptainTheCurrentUser,
  showActiveControls,
  currentCaptainName,
  requiredPlayersForCurrentMission,
  selectedMissionTeamLength,
  onHumanProposeTeam,
}: TeamSelectionControlsProps) {

  if (!showActiveControls) {
    // This covers:
    // - Online mode: Current user is not the captain.
    // - Manual mode: Current user is not the host.
    let message = `等待队长 ${currentCaptainName || '未知'} 选择队员...`;
    if (roomMode === RoomMode.ManualInput && !isHostCurrentUser) {
      message = `等待主持人为队长 ${currentCaptainName || '未知'} 输入队伍选择...`;
    }
    return (
      <p className="text-center text-muted-foreground py-4">{message}</p>
    );
  }

  // Active controls are shown if:
  // - Online mode: Current user IS the captain.
  // - Manual mode: Current user IS the host (acting for the captain).
  let instructionText = `本回合比赛需要 ${requiredPlayersForCurrentMission} 名玩家。`;
  if (roomMode === RoomMode.ManualInput) {
    instructionText = `主持人请为队长 ${currentCaptainName || '未知'} 选择队伍。${instructionText}`;
  }


  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-center">组建比赛队伍</h3>
      <p className="text-center text-muted-foreground">
        {instructionText}
      </p>

      <Button
        onClick={onHumanProposeTeam}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
        disabled={selectedMissionTeamLength !== requiredPlayersForCurrentMission}
      >
        <UsersRound className="mr-2 h-5 w-5" /> 提交队伍 (
        {selectedMissionTeamLength}/{requiredPlayersForCurrentMission})
      </Button>
    </div>
  );
}
