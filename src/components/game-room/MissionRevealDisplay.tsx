
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
          <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md shadow text-center">
            <p className="font-semibold text-lg mb-2 text-destructive text-center">
              原因分析 ({failCardsPlayedForDisplay || 0}):
            </p>
            {generatedFailureReason ? (
              (() => {
                let reasonText = "未能确定具体原因。"; 
                if (generatedFailureReason.selectedReasons && generatedFailureReason.selectedReasons.length === 1) {
                  reasonText = generatedFailureReason.selectedReasons[0];
                } else if (generatedFailureReason.narrativeSummary) {
                  let summary = generatedFailureReason.narrativeSummary;
                  const prefixesToRemove = [
                    "比赛失利，主要原因是：", 
                    "比赛失利，可能原因是：", 
                    "本次比赛失利，主要归咎于以下几点：",
                    "比赛失利；" 
                  ];
                  for (const prefix of prefixesToRemove) {
                    if (summary.startsWith(prefix)) {
                      summary = summary.substring(prefix.length).trimStart();
                      break; 
                    }
                  }
                  reasonText = summary;
                } else if (generatedFailureReason.selectedReasons && generatedFailureReason.selectedReasons.length > 1) {
                  reasonText = generatedFailureReason.selectedReasons.join("，");
                }
                return <p>{reasonText}</p>;
              })()
            ) : failCardsPlayedForDisplay !== undefined && failCardsPlayedForDisplay > 0 ? (
              <p className="flex items-center justify-center">
                <AlertTriangle className="mr-1 h-4 w-4 text-orange-500" />
                比赛因 {failCardsPlayedForDisplay} 个破坏行动而失败。
              </p>
            ) : (
              <p>比赛失败，原因未知。</p>
            )}
          </div>
        </>
      )}
      <Button onClick={onProceedToNextRoundOrGameOver} className="mt-2">继续</Button>
    </div>
  );
}

