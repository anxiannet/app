
"use client";

import type { Player, PlayerVote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type TeamVotingControlsProps = {
  allPlayersInRoom: Player[];
  onBulkSubmitVotes: (votes: PlayerVote[]) => void;
  currentPhase: string | undefined; // To know when to reset local state
  totalPlayerCountInRoom: number; // Keep for potential future re-use
  // userVote and hasUserVotedOnCurrentTeam are no longer needed for this manual mode
};

export function TeamVotingControls({
  allPlayersInRoom,
  onBulkSubmitVotes,
  currentPhase,
  totalPlayerCountInRoom,
}: TeamVotingControlsProps) {
  const [manualVotes, setManualVotes] = useState<{ [playerId: string]: 'approve' | 'reject' }>({});

  useEffect(() => {
    // Reset manual votes if the phase changes (e.g., new voting round)
    setManualVotes({});
  }, [currentPhase]);

  const handleManualVote = (playerId: string, vote: 'approve' | 'reject') => {
    setManualVotes(prev => ({ ...prev, [playerId]: vote }));
  };

  const allVotesEntered = Object.keys(manualVotes).length === allPlayersInRoom.length && allPlayersInRoom.length > 0;

  const handleSubmitAll = () => {
    if (!allVotesEntered) return;
    const collectedVotes: PlayerVote[] = allPlayersInRoom.map(player => ({
      playerId: player.id,
      vote: manualVotes[player.id] || 'reject', // Default to 'reject' if somehow missing, though UI should prevent this
    }));
    onBulkSubmitVotes(collectedVotes);
  };

  // If all votes are in and submitted, this component might show results or a "processing" state.
  // For now, GameRoomPage will handle phase transition.
  // The logic for `allVotesIn` (displaying outcome) from previous version is removed as GameRoomPage handles it.

  return (
    <div className="space-y-3 pt-4">
      <h3 className="text-lg font-semibold text-center">手动输入队伍投票结果</h3>
      <p className="text-sm text-center text-muted-foreground">
        请为每位玩家选择其投票意向。
      </p>
      <ScrollArea className="h-[300px] pr-3">
        <div className="space-y-2">
          {allPlayersInRoom.map(player => (
            <div key={player.id} className="flex items-center justify-between p-2 border rounded-md">
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={player.avatarUrl} alt={player.name} data-ai-hint="avatar person"/>
                  <AvatarFallback>{player.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">{player.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant={manualVotes[player.id] === 'approve' ? "default" : "outline"}
                  onClick={() => handleManualVote(player.id, 'approve')}
                  className={cn(
                    manualVotes[player.id] === 'approve' ? "bg-green-500 hover:bg-green-600 text-white" : ""
                  )}
                >
                  <ThumbsUp className="mr-1 h-4 w-4" /> 同意
                </Button>
                <Button
                  size="sm"
                  variant={manualVotes[player.id] === 'reject' ? "destructive" : "outline"}
                  onClick={() => handleManualVote(player.id, 'reject')}
                >
                  <ThumbsDown className="mr-1 h-4 w-4" /> 拒绝
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {allPlayersInRoom.length > 0 && (
        <Button
          onClick={handleSubmitAll}
          disabled={!allVotesEntered}
          className="w-full mt-4"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" /> 提交所有投票 ({Object.keys(manualVotes).length}/{allPlayersInRoom.length})
        </Button>
      )}
    </div>
  );
}
