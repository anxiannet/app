
"use client";

import type { MissionOutcome, GeneratedFailureReason } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type MissionRevealDisplayProps = {
  currentRound?: number;
  missionOutcomeForDisplay?: MissionOutcome;
  failCardsPlayedForDisplay?: number;
  generatedFailureReason?: GeneratedFailureReason;
  onProceedToNextRoundOrGameOver: () => void;
};

export function MissionRevealDisplay({
  currentRound,
  missionOutcomeForDisplay,
  failCardsPlayedForDisplay,
  generatedFailureReason,
  onProceedToNextRoundOrGameOver,
}: MissionRevealDisplayProps) {
  const roundText = currentRound !== undefined ? `第 ${currentRound} 场比赛` : "本场比赛";
  return (
    <div className="space-y-3 text-center">
      {missionOutcomeForDisplay === 'success' ? (
        <p className="text-2xl font-bold text-green-500 flex items-center justify-center">
          <CheckCircle2 className="mr-2 h-8 w-8"/> {roundText}：胜利!
        </p>
      ) : (
        <>
          <p className="text-2xl font-bold text-destructive flex items-center justify-center">
            <XCircle className="mr-2 h-8 w-8"/> {roundText}：战败!
          </p>
          {generatedFailureReason && (generatedFailureReason.selectedReasons?.length > 0 || generatedFailureReason.narrativeSummary) ? (
            (() => {
              let displayReasonText = "";
              if (generatedFailureReason.selectedReasons && generatedFailureReason.selectedReasons.length === 1) {
                displayReasonText = generatedFailureReason.selectedReasons[0];
              } else if (generatedFailureReason.narrativeSummary) {
                displayReasonText = generatedFailureReason.narrativeSummary;
              } else if (generatedFailureReason.selectedReasons && generatedFailureReason.selectedReasons.length > 1) {
                // Fallback if narrativeSummary is somehow empty but multiple reasons exist
                displayReasonText = generatedFailureReason.selectedReasons.join("，");
              } else {
                displayReasonText = "未能确定具体原因。"; 
              }
              return (
                <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md shadow text-left">
                  <p>
                    <span className="font-semibold">原因分析:</span> {displayReasonText}
                  </p>
                </div>
              );
            })()
          ) : failCardsPlayedForDisplay !== undefined && failCardsPlayedForDisplay > 0 ? (
            <p className="text-sm text-muted-foreground flex items-center justify-center">
              <AlertTriangle className="mr-1 h-4 w-4 text-orange-500" />
              比赛因 {failCardsPlayedForDisplay} 个破坏行动而失败。
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">比赛失败，原因未知。</p>
          )}
        </>
      )}
      <Button onClick={onProceedToNextRoundOrGameOver} className="mt-2">继续</Button>
    </div>
  );
}
