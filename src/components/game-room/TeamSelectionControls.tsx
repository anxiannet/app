
"use client";

import { Button } from "@/components/ui/button";
import { UsersRound, Brain } from "lucide-react"; // Added Brain icon

type TeamSelectionControlsProps = {
  currentCaptainName?: string;
  isHumanCaptain: boolean;
  isAiActing: boolean; // New prop
  requiredPlayersForCurrentMission: number;
  selectedMissionTeamLength: number;
  onHumanProposeTeam: () => void;
};

export function TeamSelectionControls({
  currentCaptainName,
  isHumanCaptain,
  isAiActing, // New prop
  requiredPlayersForCurrentMission,
  selectedMissionTeamLength,
  onHumanProposeTeam,
}: TeamSelectionControlsProps) {
  if (!isHumanCaptain && isAiActing) { // Show AI acting message if it's AI captain's turn
    return (
      <div className="text-center p-4">
        <p className="text-lg font-semibold text-primary flex items-center justify-center">
          <Brain className="mr-2 h-5 w-5 animate-pulse" /> {currentCaptainName} (AI) 正在选择队伍...
        </p>
      </div>
    );
  }
  
  if (!isHumanCaptain && !isAiActing) { // Show waiting message if it's AI captain but AI is not yet acting (should be brief)
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
          disabled={selectedMissionTeamLength !== requiredPlayersForCurrentMission || isAiActing}
        >
          <UsersRound className="mr-2 h-5 w-5" /> 提交队伍 (
          {selectedMissionTeamLength}/{requiredPlayersForCurrentMission})
        </Button>
      )}
    </div>
  );
}
