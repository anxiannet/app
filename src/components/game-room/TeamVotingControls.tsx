
"use client";

import type { Player, PlayerVote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";

type TeamVotingControlsProps = {
  currentRound?: number;
  captainChangesThisRound?: number;
  currentCaptainName?: string;
  proposedTeamNames: string[];
  votesToDisplay: PlayerVote[];
  realPlayersVotedCount: number;
  realPlayersCount: number;
  hasUserVotedOnCurrentTeam: boolean;
  isCurrentUserVirtual: boolean;
  onPlayerVote: (vote: 'approve' | 'reject') => void;
  userVote?: 'approve' | 'reject';
};

export function TeamVotingControls({
  currentRound,
  captainChangesThisRound,
  currentCaptainName,
  proposedTeamNames,
  votesToDisplay,
  realPlayersVotedCount,
  realPlayersCount,
  hasUserVotedOnCurrentTeam,
  isCurrentUserVirtual,
  onPlayerVote,
  userVote,
}: TeamVotingControlsProps) {
  return (
    <div className="space-y-3">
      {/* 
      The following lines have been removed as per user request:
      <h3 className="text-lg font-semibold text-center">为队伍投票</h3>
      <p className="text-center text-muted-foreground">队长 <span className="font-bold text-accent">{currentCaptainName}</span> 提议以下队伍执行比赛:</p>
      <ul className="text-center font-medium list-disc list-inside bg-muted/30 p-2 rounded-md">{proposedTeamNames.join(', ')}</ul> 
      */}
      
      {votesToDisplay.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          已投票: {votesToDisplay.filter(v => v.vote === 'approve').length} 同意, {votesToDisplay.filter(v => v.vote === 'reject').length} 拒绝.
          ({realPlayersCount - realPlayersVotedCount} 人未投票)
        </p>
      )}
      {!hasUserVotedOnCurrentTeam && !isCurrentUserVirtual ? (
        <div className="flex gap-4 justify-center">
          <Button onClick={() => onPlayerVote('approve')} className="bg-green-500 hover:bg-green-600 text-white"><ThumbsUp className="mr-2 h-5 w-5"/> 同意</Button>
          <Button onClick={() => onPlayerVote('reject')} variant="destructive"><ThumbsDown className="mr-2 h-5 w-5"/> 拒绝</Button>
        </div>
      ) : (!isCurrentUserVirtual && userVote &&
        <p className="text-center text-green-600 font-semibold">你已投票: {userVote === 'approve' ? '同意' : '拒绝'}</p>
      )}
      {realPlayersVotedCount < realPlayersCount && <p className="text-sm text-center text-muted-foreground">等待其他真实玩家投票...</p>}
    </div>
  );
}
