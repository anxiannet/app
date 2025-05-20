
"use client";

import type { Player } from "@/lib/types";
import { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // No longer needed
// import { Label } from "@/components/ui/label"; // No longer needed
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // No longer needed
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

type CoachAssassinationControlsProps = {
  currentUserRole?: Role;
  selectedCoachCandidateId: string | null; // Changed from selectedCoachCandidate
  // onSetSelectedCoachCandidate: (value: string | null) => void; // No longer needed, selection handled by PlayerListPanel
  // assassinationTargetOptions: Player[]; // No longer needed, handled by PlayerListPanel
  onConfirmCoachAssassination: () => void;
};

export function CoachAssassinationControls({
  currentUserRole,
  selectedCoachCandidateId, // Changed
  onConfirmCoachAssassination,
}: CoachAssassinationControlsProps) {
  return (
    <div className="space-y-4 text-center">
      <h3 className="text-xl font-semibold flex items-center justify-center text-destructive"><Target className="mr-2 h-6 w-6" /> 卧底指认教练</h3>
      {currentUserRole === Role.Undercover ? (
        <>
          <p className="text-muted-foreground">请在上方玩家列表中选择你认为是教练的玩家。</p>
          {/* RadioGroup removed */}
          <Button 
            onClick={onConfirmCoachAssassination} 
            disabled={!selectedCoachCandidateId} 
            className="w-full max-w-sm mx-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            确认指认
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground py-4">等待卧底指认教练...</p>
      )}
    </div>
  );
}
