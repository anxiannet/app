
"use client";

import { Button } from "@/components/ui/button";
import { UsersRound } from "lucide-react";
// Imports for player list rendering (Avatar, ScrollArea, cn, SelectedIcon) are removed as selection is now in PlayerListPanel

type TeamSelectionControlsProps = {
  currentCaptainName?: string;
  isHumanCaptain: boolean;
  requiredPlayersForCurrentMission: number;
  selectedMissionTeamLength: number;
  onHumanProposeTeam: () => void;
};

export function TeamSelectionControls({
  currentCaptainName,
  isHumanCaptain,
  requiredPlayersForCurrentMission,
  selectedMissionTeamLength,
  onHumanProposeTeam,
}: TeamSelectionControlsProps) {
  
  if (!isHumanCaptain ) { 
     return (
         <p className="text-center text-muted-foreground py-4">等待队长 <span className="font-semibold text-primary">{currentCaptainName}</span> 选择队员...</p>
       );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-center">组建比赛队伍</h3>
      <p className="text-center text-muted-foreground">
        本回合比赛需要{" "}
        <span className="font-bold text-primary">
          {requiredPlayersForCurrentMission}
        </span>{" "}
        名玩家。
      </p>
      
      {isHumanCaptain && (
        <Button
          onClick={onHumanProposeTeam}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          disabled={selectedMissionTeamLength !== requiredPlayersForCurrentMission}
        >
          <UsersRound className="mr-2 h-5 w-5" /> 提交队伍 (
          {selectedMissionTeamLength}/{requiredPlayersForCurrentMission})
        </Button>
      )}
    </div>
  );
}
