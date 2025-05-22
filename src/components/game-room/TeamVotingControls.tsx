
"use client";

import type { Player, PlayerVote, RoomMode, User as AuthUser } from "@/lib/types"; // Added RoomMode, AuthUser
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type TeamVotingControlsProps = {
  roomMode: RoomMode;
  allPlayersInRoom: Player[];
  currentUser: AuthUser; // Changed from User to AuthUser for clarity
  votesToDisplay: PlayerVote[];
  onPlayerVote: (vote: 'approve' | 'reject') => void; // For Online mode
  onBulkSubmitVotes: (votes: PlayerVote[]) => void; // For Manual Input mode
  currentPhase: string | undefined;
  totalPlayerCountInRoom: number;
  totalHumanPlayersInRoom: number;
};

export function TeamVotingControls({
  roomMode,
  allPlayersInRoom,
  currentUser,
  votesToDisplay,
  onPlayerVote,
  onBulkSubmitVotes,
  currentPhase,
  totalPlayerCountInRoom,
  totalHumanPlayersInRoom,
}: TeamVotingControlsProps) {
  const [manualVotes, setManualVotes] = useState<{ [playerId: string]: 'approve' | 'reject' }>({});

  useEffect(() => {
    // Reset manual votes if the phase changes (e.g., new voting round) for ManualInput mode
    if (roomMode === RoomMode.ManualInput) {
        setManualVotes({});
    }
  }, [currentPhase, roomMode]);

  const handleManualVote = (playerId: string, vote: 'approve' | 'reject') => {
    setManualVotes(prev => ({ ...prev, [playerId]: vote }));
  };

  const allManualVotesEntered = allPlayersInRoom.length > 0 && Object.keys(manualVotes).length === allPlayersInRoom.length;

  const handleSubmitAllManualVotes = () => {
    if (!allManualVotesEntered) return;
    const collectedVotes: PlayerVote[] = allPlayersInRoom.map(player => ({
      playerId: player.id,
      vote: manualVotes[player.id] || 'reject',
    }));
    onBulkSubmitVotes(collectedVotes);
  };

  const hasUserVotedOnCurrentTeam = votesToDisplay.some(v => v.playerId === currentUser.id);
  const isCurrentUserVirtual = currentUser.id.startsWith("virtual_");
  const humanPlayersVotedCount = votesToDisplay.filter(v => !v.playerId.startsWith("virtual_")).length;
  const allHumansVoted = humanPlayersVotedCount === totalHumanPlayersInRoom;
  const allVotesIn = votesToDisplay.length === totalPlayerCountInRoom;

  if (roomMode === RoomMode.ManualInput) {
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
            onClick={handleSubmitAllManualVotes}
            disabled={!allManualVotesEntered}
            className="w-full mt-4"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" /> 提交所有投票 ({Object.keys(manualVotes).length}/{allPlayersInRoom.length})
          </Button>
        )}
      </div>
    );
  }

  // Online Mode UI
  return (
    <div className="space-y-3 pt-4 text-center">
      <h3 className="text-lg font-semibold">队伍投票</h3>
      {!isCurrentUserVirtual && !hasUserVotedOnCurrentTeam && (
        <div className="flex gap-4 justify-center">
          <Button onClick={() => onPlayerVote('approve')} className="bg-green-500 hover:bg-green-600 text-white">
            <ThumbsUp className="mr-2 h-5 w-5"/> 同意
          </Button>
          <Button onClick={() => onPlayerVote('reject')} variant="destructive">
            <ThumbsDown className="mr-2 h-5 w-5"/> 拒绝
          </Button>
        </div>
      )}
      {hasUserVotedOnCurrentTeam && <p className="text-green-600 font-semibold">你已投票。</p>}
      
      {allVotesIn ? (
        <div>
          <p className="font-semibold mt-2">
            投票结果: {votesToDisplay.filter(v => v.vote === 'approve').length} 同意, {votesToDisplay.filter(v => v.vote === 'reject').length} 拒绝
          </p>
          <p className="text-sm text-muted-foreground">
            {votesToDisplay.filter(v => v.vote === 'approve').length > votesToDisplay.filter(v => v.vote === 'reject').length
              ? "队伍已批准! 正在进入下一阶段..."
              : "队伍被否决! 正在进入下一阶段..."}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-2">
          {totalHumanPlayersInRoom - humanPlayersVotedCount > 0
            ? `等待 ${totalHumanPlayersInRoom - humanPlayersVotedCount} 名真实玩家投票...`
            : "等待虚拟玩家投票..."}
        </p>
      )}
    </div>
  );
}
