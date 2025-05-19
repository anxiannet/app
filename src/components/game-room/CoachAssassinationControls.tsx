
"use client";

import type { Player } from "@/lib/types";
import { Role } from "@/lib/types"; // Changed: Role is now a value import
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

type CoachAssassinationControlsProps = {
  currentUserRole?: Role;
  selectedCoachCandidate: string | null;
  onSetSelectedCoachCandidate: (value: string | null) => void;
  assassinationTargetOptions: Player[];
  onConfirmCoachAssassination: () => void;
};

export function CoachAssassinationControls({
  currentUserRole,
  selectedCoachCandidate,
  onSetSelectedCoachCandidate,
  assassinationTargetOptions,
  onConfirmCoachAssassination,
}: CoachAssassinationControlsProps) {
  return (
    <div className="space-y-4 text-center">
      <h3 className="text-xl font-semibold flex items-center justify-center text-destructive"><Target className="mr-2 h-6 w-6" /> 卧底指认教练</h3>
      {currentUserRole === Role.Undercover ? (
        <>
          <p className="text-muted-foreground">选择你认为是教练的玩家:</p>
          <RadioGroup
            value={selectedCoachCandidate || undefined}
            onValueChange={onSetSelectedCoachCandidate}
            className="grid grid-cols-2 gap-2 mx-auto max-w-sm"
          >
            {assassinationTargetOptions.map(player => (
              <Label
                key={player.id}
                htmlFor={`coach-candidate-${player.id}`}
                className={cn(
                  "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  selectedCoachCandidate === player.id && "border-primary ring-2 ring-primary"
                )}
              >
                <RadioGroupItem value={player.id} id={`coach-candidate-${player.id}`} className="sr-only" />
                <Avatar className="mb-2 h-12 w-12">
                  <AvatarImage src={player.avatarUrl} alt={player.name} data-ai-hint="avatar person" />
                  <AvatarFallback>{player.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{player.name}</span>
              </Label>
            ))}
          </RadioGroup>
          <Button 
            onClick={onConfirmCoachAssassination} 
            disabled={!selectedCoachCandidate} 
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
