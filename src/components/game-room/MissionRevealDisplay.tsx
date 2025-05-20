
"use client";

import type { MissionOutcome } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

type MissionRevealDisplayProps = {
  currentRound?: number;
  missionOutcomeForDisplay?: MissionOutcome;
  failCardsPlayedForDisplay?: number;
  onProceedToNextRoundOrGameOver: () => void;
};

export function MissionRevealDisplay({
  currentRound,
  missionOutcomeForDisplay,
  failCardsPlayedForDisplay,
  onProceedToNextRoundOrGameOver,
}: MissionRevealDisplayProps) {
  return (
    <div className="space-y-3 text-center">
      <h3 className="text-lg font-semibold">第 {currentRound} 场比赛结果揭晓!</h3>
      {missionOutcomeForDisplay === 'success' ?
        <p className="text-2xl font-bold text-green-500 flex items-center justify-center"><CheckCircle2 className="mr-2 h-8 w-8"/> 比赛成功!</p> :
        <p className="text-2xl font-bold text-destructive flex items-center justify-center"><XCircle className="mr-2 h-8 w-8"/> 比赛失败!</p>
      }
      <p className="text-muted-foreground">破坏牌数量: {failCardsPlayedForDisplay}</p>
      <Button onClick={onProceedToNextRoundOrGameOver} className="mt-2">继续</Button>
    </div>
  );
}

