
"use client";

import type { PlayerVote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react"; 

type TeamVotingControlsProps = {
  votesToDisplay: PlayerVote[];
  hasUserVotedOnCurrentTeam: boolean;
  isCurrentUserVirtual: boolean;
  onPlayerVote: (vote: 'approve' | 'reject') => void;
  userVote?: 'approve' | 'reject';
  totalPlayerCountInRoom: number;
  totalHumanPlayersInRoom: number; // Added prop
};

export function TeamVotingControls({
  votesToDisplay,
  hasUserVotedOnCurrentTeam,
  isCurrentUserVirtual,
  onPlayerVote,
  userVote,
  totalPlayerCountInRoom,
  totalHumanPlayersInRoom, // Use new prop
}: TeamVotingControlsProps) {

  const allVotesIn = votesToDisplay.length === totalPlayerCountInRoom && totalPlayerCountInRoom > 0;

  if (allVotesIn) {
    const approveVotes = votesToDisplay.filter(v => v.vote === 'approve').length;
    const rejectVotes = votesToDisplay.filter(v => v.vote === 'reject').length;
    const outcomeText = approveVotes > rejectVotes ? "队伍已批准!" : "队伍被否决!";

    return (
      <div className="text-center space-y-2 p-4">
        <p className="text-lg font-semibold">
          投票结果: {approveVotes} 同意, {rejectVotes} 拒绝
        </p>
        <p className={`text-md font-bold ${approveVotes > rejectVotes ? 'text-green-600' : 'text-red-500'}`}>
          {outcomeText}
        </p>
        <p className="text-sm text-muted-foreground">正在进入下一阶段...</p>
      </div>
    );
  }

  const humanPlayersVotedCount = votesToDisplay.filter(v => !v.playerId.startsWith("virtual_")).length;

  return (
    <div className="space-y-3 pt-4"> 
      
      {votesToDisplay.length > 0 && humanPlayersVotedCount < totalHumanPlayersInRoom && totalHumanPlayersInRoom > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          ({totalHumanPlayersInRoom - humanPlayersVotedCount} 名真实玩家未投票)
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
      {totalHumanPlayersInRoom > 0 && humanPlayersVotedCount < totalHumanPlayersInRoom && <p className="text-sm text-center text-muted-foreground">等待其他真实玩家投票...</p>}
      {totalHumanPlayersInRoom === 0 && votesToDisplay.length < totalPlayerCountInRoom && <p className="text-sm text-center text-muted-foreground">等待虚拟玩家投票...</p>}
    </div>
  );
}
