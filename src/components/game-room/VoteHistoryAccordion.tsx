
"use client";

import * as React from "react"; // Added React import
import { type GameRoom, type Player, Role, GameRoomStatus } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, ThumbsUp, ThumbsDown, CheckCircle2, XCircle as XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type VoteHistoryAccordionProps = {
  room: GameRoom;
  localPlayers: Player[];
  totalRounds: number;
};

function getRoleChineseName(role: Role): string {
  switch (role) {
    case Role.TeamMember: return "队员";
    case Role.Undercover: return "卧底";
    case Role.Coach: return "教练";
    default: return "未知角色";
  }
}

export function VoteHistoryAccordion({ room, localPlayers, totalRounds }: VoteHistoryAccordionProps) {
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
                                  return player ? player.name : '未知玩家';
                              }).join(', ');
                          if (saboteurs.length > 0) {
                              missionOutcomeText += ` (破坏者: ${saboteurs})`;
                          }
                      } else if (missionForRound.outcome === 'fail' && missionForRound.generatedFailureReason?.narrativeSummary) {
                         missionOutcomeText += ` (${missionForRound.generatedFailureReason.narrativeSummary})`;
                      } else if (missionForRound.outcome === 'fail' && !missionForRound.generatedFailureReason?.narrativeSummary && missionForRound.failCardsPlayed && missionForRound.failCardsPlayed > 0) {
                         missionOutcomeText += ` (因 ${missionForRound.failCardsPlayed} 个破坏行动而失败)`;
                      }
                  }

                  return (
                    <AccordionItem value={`round-${roundNum}`} key={`round-history-${roundNum}`}>
                      <AccordionTrigger className="text-md font-medium hover:no-underline text-left">第 {roundNum} 场比赛记录{attemptCountText}{missionOutcomeText}</AccordionTrigger>
                      <AccordionContent>
                        {roundVotes.length > 0 ? roundVotes.map((voteEntry, attemptIdx) => {
                          const captain = localPlayers.find(p => p.id === voteEntry.captainId);
                          
                          return (
                              <div key={`round-${roundNum}-attempt-${attemptIdx}`} className="mb-4 p-3 border rounded-md bg-muted/20">
                              <div className="font-semibold text-sm">第 {voteEntry.attemptNumberInRound} 次组队尝试 (队长: {captain ? captain.name : '未知'}
                                {captain && captain.role && room.status === GameRoomStatus.Finished && <span className="text-xs font-normal text-muted-foreground ml-1">({getRoleChineseName(captain.role)})</span>}
                              )</div>
                              <div className="text-xs mt-1">提议队伍: {voteEntry.proposedTeamIds.map((id, idx) => {
                                  const player = localPlayers.find(p => p.id === id);
                                  return (
                                    <React.Fragment key={id}>
                                      {idx > 0 && ", "}
                                      {player ? player.name : '未知'}
                                      {player && player.role && room.status === GameRoomStatus.Finished && <span className="text-xs font-normal text-muted-foreground ml-0.5">({getRoleChineseName(player.role)})</span>}
                                    </React.Fragment>
                                  );
                              })}
                              </div>
                              <p className="text-xs mt-1">队伍投票结果: <span className={cn("font-semibold", voteEntry.outcome === 'approved' ? 'text-green-600' : 'text-red-500')}>{voteEntry.outcome === 'approved' ? '通过' : '否决'}</span></p>
                              <ul className="mt-2 space-y-1 text-xs list-disc list-inside pl-2">
                                  {voteEntry.votes.map(vote => {
                                  const voter = localPlayers.find(p => p.id === vote.playerId);
                                  return (
                                      <li key={`vote-${voteEntry.round}-${voteEntry.attemptNumberInRound}-${vote.playerId}`}>
                                        {voter ? voter.name : '未知玩家'}
                                        {voter && voter.role && room.status === GameRoomStatus.Finished && <span className="text-xs font-normal text-muted-foreground ml-1">({getRoleChineseName(voter.role)})</span>}
                                        : {vote.vote === 'approve' ? <span className="text-green-500 flex items-center inline-flex">同意 <ThumbsUp className="h-3 w-3 ml-1" /></span> : <span className="text-red-500 flex items-center inline-flex">拒绝 <ThumbsDown className="h-3 w-3 ml-1" /></span>}
                                      </li>
                                  );
                                  })}
                              </ul>
                              </div>
                          );
                        }) : (
                          missionForRound && <p className="text-sm text-muted-foreground">本轮无有效组队投票。</p>
                        )}

                        {missionForRound && room.status === GameRoomStatus.Finished && missionForRound.cardPlays && missionForRound.cardPlays.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-dashed">
                            <p className="font-semibold text-sm mb-2">本场比赛队员行动:</p>
                            <ul className="space-y-1 text-xs">
                              {missionForRound.cardPlays.map((play, playIdx) => {
                                const player = localPlayers.find(p => p.id === play.playerId);
                                return (
                                  <li key={`mission-play-${roundNum}-${playIdx}`} className="flex items-center">
                                    {player ? player.name : '未知玩家'}
                                    {player && player.role && <span className="text-xs font-normal text-muted-foreground ml-1">({getRoleChineseName(player.role)})</span>}
                                    :
                                    {play.card === 'success' ?
                                      <span className="ml-2 text-green-600 flex items-center"><CheckCircle2 className="mr-1 h-3 w-3"/> 成功</span> :
                                      <span className="ml-2 text-red-500 flex items-center"><XCircleIcon className="mr-1 h-3 w-3"/> 破坏</span>
                                    }
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                         {missionForRound && missionForRound.outcome === 'fail' && (!missionForRound.cardPlays || missionForRound.cardPlays.length === 0) && room.status === GameRoomStatus.Finished && (
                            <p className="text-sm text-muted-foreground mt-2">比赛失败，但未记录具体行动信息。</p>
                        )}
                        {missionForRound && missionForRound.outcome === 'success' && (!missionForRound.cardPlays || missionForRound.cardPlays.length === 0) && room.status === GameRoomStatus.Finished && (
                            <p className="text-sm text-muted-foreground mt-2">比赛成功，但未记录具体行动信息。</p>
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

