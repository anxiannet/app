
"use client";

import { Button } from "@/components/ui/button";
import { UsersRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/types";
import { CheckCircle2 as SelectedIcon } from "lucide-react";


type TeamSelectionControlsProps = {
  currentCaptainName?: string;
  isHumanCaptain: boolean;
  // isAiActing: boolean; // AI logic removed
  requiredPlayersForCurrentMission: number;
  selectedMissionTeamLength: number;
  onHumanProposeTeam: () => void;
  // Props below are for when PlayerListPanel is NOT used directly for selection
  // localPlayersForSelection?: Player[];
  // selectedPlayersForMission?: string[];
  // onTogglePlayerForMission?: (playerId: string) => void;
};

export function TeamSelectionControls({
  currentCaptainName,
  isHumanCaptain,
  // isAiActing, // AI logic removed
  requiredPlayersForCurrentMission,
  selectedMissionTeamLength,
  onHumanProposeTeam,
  // localPlayersForSelection = [],
  // selectedPlayersForMission = [],
  // onTogglePlayerForMission,
}: TeamSelectionControlsProps) {
  
  // AI acting message removed as AI decision logic is removed
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
      {/* Selection list removed, selection now happens in PlayerListPanel */}
      
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
