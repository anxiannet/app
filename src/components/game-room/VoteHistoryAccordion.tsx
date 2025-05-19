
"use client";

import type { GameRoom, Player, Role, VoteHistoryEntry } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { GameRoomStatus } from "@/lib/types";

type VoteHistoryAccordionProps = {
  room: GameRoom;
  localPlayers: Player[];
  getRoleIcon: (role?: Role) => JSX.Element | null;
  totalRounds: number;
};

export function VoteHistoryAccordion({ room, localPlayers, getRoleIcon, totalRounds }: VoteHistoryAccordionProps) {
  if (!room.fullVoteHistory || room.fullVoteHistory.length === 0 || room.status === GameRoomStatus.Waiting) {
    return null;
  }

  const defaultOpenRound = (room.status === GameRoomStatus.InProgress || room.status === GameRoomStatus.Finished) && room.currentRound ? [`round-${room.currentRound}`] : undefined;

  return (
    <Accordion type="single" collapsible className="w-full mt-6 pt-4 border-t" defaultValue={defaultOpenRound ? defaultOpenRound[0] : undefined}>
      <AccordionItem value="vote-history">
        <AccordionTrigger className="text-lg font-semibold hover:no-underline">
          <History className="mr-2 h-5 w-5 text-primary" /> 查看详细投票记录
        </AccordionTrigger>
        <AccordionContent>
          <ScrollArea className="h-[300px] pr-4">
            <Accordion 
              type="multiple" 
              className="w-full"
              defaultValue={defaultOpenRound}
            >
              {Array.from({ length: totalRounds }, (_, i) => i + 1)
                .map(roundNum => {
                  const roundVotes = room.fullVoteHistory!.filter(vh => vh.round === roundNum);
                  const missionForRound = room.missionHistory?.find(m => m.round === roundNum);
                  
                  if (roundVotes.length === 0 && !missionForRound) return null;
                  
                  const attemptCountText = roundVotes.length > 0 ? `（${roundVotes.length}次组队）` : '';
                  
                  let missionOutcomeText = '';
                  if (missionForRound) {
                      missionOutcomeText = missionForRound.outcome === 'success' ? ' - 比赛成功' : (missionForRound.outcome === 'fail' ? ' - 比赛失败' : '');
                      if (missionForRound.outcome === 'fail' && room.status === GameRoomStatus.Finished && missionForRound.cardPlays) {
                          const saboteurs = missionForRound.cardPlays
                              .filter(play => play.card === 'fail')
                              .map(play => {
                                  const player = localPlayers.find(p => p.id === play.playerId);
                                  return player ? `${player.name} (${player.role || '未知角色'})` : '未知玩家';
                              });
                          if (saboteurs.length > 0) {
                              missionOutcomeText += ` (破坏者: ${saboteurs.join(', ')})`;
                          }
                      }
                  }

                  return (
                    <AccordionItem value={`round-${roundNum}`} key={`round-history-${roundNum}`}>
                      <AccordionTrigger className="text-md font-medium hover:no-underline">第 {roundNum} 场比赛记录{attemptCountText}{missionOutcomeText}</AccordionTrigger>
                      <AccordionContent>
                        {roundVotes.length > 0 ? roundVotes.map((voteEntry, attemptIdx) => {
                          const captain = localPlayers.find(p => p.id === voteEntry.captainId);
                          const captainDisplay = captain ? `${captain.name}${room.status === GameRoomStatus.Finished && captain.role ? ` (${captain.role})` : ''}` : '未知';
                          
                          const proposedTeamDisplay = voteEntry.proposedTeamIds.map(id => {
                              const player = localPlayers.find(p => p.id === id);
                              return player ? `${player.name}${room.status === GameRoomStatus.Finished && player.role ? ` (${player.role})` : ''}` : '未知';
                          }).join(', ');

                          return (
                              <div key={`round-${roundNum}-attempt-${attemptIdx}`} className="mb-4 p-3 border rounded-md bg-muted/20">
                              <p className="font-semibold text-sm">第 {voteEntry.attemptNumberInRound} 次组队尝试 (队长: {captainDisplay})</p>
                              <p className="text-xs mt-1">提议队伍: {proposedTeamDisplay}</p>
                              <p className="text-xs mt-1">投票结果: <span className={cn("font-semibold", voteEntry.outcome === 'approved' ? 'text-green-600' : 'text-red-500')}>{voteEntry.outcome === 'approved' ? '通过' : '否决'}</span></p>
                              <ul className="mt-2 space-y-1 text-xs list-disc list-inside pl-2">
                                  {voteEntry.votes.map(vote => {
                                  const voter = localPlayers.find(p => p.id === vote.playerId);
                                  const voterDisplay = voter ? `${voter.name}${room.status === GameRoomStatus.Finished && voter.role ? ` (${voter.role})` : ''}` : '未知玩家';
                                  return (
                                      <li key={`vote-${voteEntry.round}-${voteEntry.attemptNumberInRound}-${vote.playerId}`}>
                                      {voterDisplay}: {vote.vote === 'approve' ? <span className="text-green-500 flex items-center inline-flex">同意 <ThumbsUp className="h-3 w-3 ml-1" /></span> : <span className="text-red-500 flex items-center inline-flex">拒绝 <ThumbsDown className="h-3 w-3 ml-1" /></span>}
                                      </li>
                                  );
                                  })}
                              </ul>
                              </div>
                          );
                        }) : (
                          missionForRound && <p className="text-sm text-muted-foreground">本场比赛直接判定: {missionForRound.outcome === 'success' ? '成功' : '失败'}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
