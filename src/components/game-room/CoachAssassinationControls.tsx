
"use client";

import type { Player, Role as RoleEnum, RoomMode } from "@/lib/types"; // Renamed Role to RoleEnum
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

type CoachAssassinationControlsProps = {
  roomMode: RoomMode;
  isHostCurrentUser: boolean;
  currentUserRole?: RoleEnum;
  selectedCoachCandidateId: string | null;
  onConfirmCoachAssassination: () => void;
};

export function CoachAssassinationControls({
  roomMode,
  isHostCurrentUser,
  currentUserRole,
  selectedCoachCandidateId,
  onConfirmCoachAssassination,
}: CoachAssassinationControlsProps) {

  let showActiveControls = false;
  let instructionText = "等待指认教练...";

  if (roomMode === RoomMode.ManualInput) {
    if (isHostCurrentUser) {
      showActiveControls = true;
      instructionText = "主持人请为卧底选择要指认的教练。请在上方玩家列表中选择目标。";
    } else {
      instructionText = "等待主持人为卧底指认教练...";
    }
  } else { // Online Mode
    if (currentUserRole === RoleEnum.Undercover) {
      showActiveControls = true;
      instructionText = "请在上方玩家列表中选择你认为是教练的玩家。";
    } else {
      instructionText = "等待卧底指认教练...";
    }
  }

  return (
    <div className="space-y-4 text-center">
      <h3 className="text-xl font-semibold flex items-center justify-center text-destructive">
        <Target className="mr-2 h-6 w-6" /> 卧底指认教练
      </h3>
      
      {showActiveControls ? (
        <>
          <p className="text-muted-foreground">{instructionText}</p>
          <Button 
            onClick={onConfirmCoachAssassination} 
            disabled={!selectedCoachCandidateId} 
            className="w-full max-w-sm mx-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            确认指认
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground py-4">{instructionText}</p>
      )}
    </div>
  );
}
