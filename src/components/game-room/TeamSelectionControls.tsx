
"use client";

import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

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
        <p className="text-lg font-semibold text-primary flex items-center justify-center">
          {currentCaptainName} 正在选择队伍...
        </p>
      </div>
    );
  }

  const handleTogglePlayerSelection = (playerId: string) => {
    const isSelected = selectedMissionTeam.includes(playerId);
    if (isSelected) {
      onPlayerSelectionForMission(playerId, false);
    } else {
      if (selectedMissionTeam.length < requiredPlayersForCurrentMission) {
        onPlayerSelectionForMission(playerId, true);
      }
      // Optionally, add a toast if trying to select more than required
      // else { toast({ title: "Team selection full", description: `You can only select ${requiredPlayersForCurrentMission} players.`})}
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-center">组建比赛队伍</h3>
      <p className="text-center text-muted-foreground">
        本回合比赛需要{" "}
        <span className="font-bold text-primary">
          {requiredPlayersForCurrentMission}
        </span>{" "}
        名玩家。
        {isHumanCaptain ? "请选择队员：" : "等待队长选择队员..."}
      </p>
      {isHumanCaptain && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
          {localPlayers.map((p) => (
            <div
              key={p.id}
              onClick={() => handleTogglePlayerSelection(p.id)}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 p-3 cursor-pointer transition-all duration-150 ease-in-out hover:shadow-md",
                selectedMissionTeam.includes(p.id)
                  ? "border-primary ring-2 ring-primary bg-primary/10 shadow-lg"
                  : "border-muted bg-card hover:border-primary/50",
                selectedMissionTeam.length >= requiredPlayersForCurrentMission && !selectedMissionTeam.includes(p.id)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              )}
            >
              <Avatar className="mb-2 h-14 w-14 border">
                <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person" />
                <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm text-center truncate w-full">
                {p.name}
              </span>
            </div>
          ))}
        </div>
      )}
      {isHumanCaptain && (
        <Button
          onClick={onHumanProposeTeam}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          disabled={selectedMissionTeam.length !== requiredPlayersForCurrentMission}
        >
          <UsersRound className="mr-2 h-5 w-5" /> 提交队伍 (
          {selectedMissionTeam.length}/{requiredPlayersForCurrentMission})
        </Button>
      )}
    </div>
  );
}
