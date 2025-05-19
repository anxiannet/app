
"use client";

import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { UsersRound } from "lucide-react";

type TeamSelectionControlsProps = {
  isVirtualCaptain: boolean;
  currentCaptainName?: string;
  isHumanCaptain: boolean;
  requiredPlayersForCurrentMission: number;
  localPlayers: Player[];
  selectedMissionTeam: string[];
  onPlayerSelectionForMission: (playerId: string, checked: boolean) => void;
  onHumanProposeTeam: () => void;
};

export function TeamSelectionControls({
  isVirtualCaptain,
  currentCaptainName,
  isHumanCaptain,
  requiredPlayersForCurrentMission,
  localPlayers,
  selectedMissionTeam,
  onPlayerSelectionForMission,
  onHumanProposeTeam,
}: TeamSelectionControlsProps) {
  if (isVirtualCaptain) {
    return (
      <div className="text-center p-4">
        <p className="text-lg font-semibold text-blue-500 flex items-center justify-center">{currentCaptainName} 正在选择队伍...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-center">组建比赛队伍</h3>
      <p className="text-center text-muted-foreground">
        本回合比赛需要 <span className="font-bold text-primary">{requiredPlayersForCurrentMission}</span> 名玩家。
        {isHumanCaptain ? "请选择队员：" : "等待队长选择队员..."}
      </p>
      {isHumanCaptain && (
        <div className="space-y-2 max-h-60 overflow-y-auto p-2 border rounded-md">
          {localPlayers.map(p => (
            <div key={p.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded">
              <Checkbox 
                id={`player-select-${p.id}`} 
                checked={selectedMissionTeam.includes(p.id)} 
                onCheckedChange={(checked) => onPlayerSelectionForMission(p.id, !!checked)} 
                disabled={selectedMissionTeam.length >= requiredPlayersForCurrentMission && !selectedMissionTeam.includes(p.id)}
              />
              <Label htmlFor={`player-select-${p.id}`} className="flex-grow cursor-pointer">{p.name}</Label>
            </div>
          ))}
        </div>
      )}
      {isHumanCaptain && (
        <Button 
          onClick={onHumanProposeTeam} 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
          disabled={selectedMissionTeam.length !== requiredPlayersForCurrentMission}
        >
          <UsersRound className="mr-2 h-5 w-5" /> 提交队伍 ({selectedMissionTeam.length}/{requiredPlayersForCurrentMission})
        </Button>
      )}
    </div>
  );
}
