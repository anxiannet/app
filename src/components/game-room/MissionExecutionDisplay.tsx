
"use client";

import { type Role, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldX } from "lucide-react";

type MissionExecutionDisplayProps = {
  currentRound?: number;
  missionTeamPlayerNames: string[];
  currentUserIsOnMission: boolean;
  currentUserRole?: Role;
  currentUserHasPlayedMissionCard: boolean;
  humanUndercoverCardChoice: 'success' | 'fail' | null;
  onHumanUndercoverPlayCard: (card: 'success' | 'fail') => void;
};

export function MissionExecutionDisplay({
  currentRound,
  missionTeamPlayerNames,
  currentUserIsOnMission,
  currentUserRole,
  currentUserHasPlayedMissionCard,
  humanUndercoverCardChoice,
  onHumanUndercoverPlayCard,
}: MissionExecutionDisplayProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-center">比赛执行中 (回合 {currentRound})</h3>
      <p className="text-center text-muted-foreground">出战队伍: {missionTeamPlayerNames.join(', ')}</p>
      {currentUserIsOnMission ? (
        currentUserRole === Role.Undercover ? (
          !currentUserHasPlayedMissionCard ? (
            <div className="text-center space-y-2">
              <p className="font-semibold">选择你的行动：</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => onHumanUndercoverPlayCard('success')} className="bg-blue-500 hover:bg-blue-600 text-white"><ShieldCheck className="mr-2 h-5 w-5"/> 打出【成功】</Button>
                <Button onClick={() => onHumanUndercoverPlayCard('fail')} variant="destructive" className="bg-orange-500 hover:bg-orange-600"><ShieldX className="mr-2 h-5 w-5"/> 打出【破坏】</Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-green-600 font-semibold">你已选择: 打出【{humanUndercoverCardChoice === 'success' ? '成功' : '破坏'}】</p>
          )
        ) : (
          <p className="text-center text-blue-600 font-semibold">你自动打出【成功】牌。</p>
        )
      ) : (
        <p className="text-center text-muted-foreground">等待队伍行动...</p>
      )}
    </div>
  );
}
