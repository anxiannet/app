
"use client";

import { type GameRoom, type Player, Role, type VoteHistoryEntry, GameRoomStatus } from "@/lib/types"; 
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, ThumbsUp, ThumbsDown, ShieldCheck, ShieldX, Swords, Shield, HelpCircle, CheckCircle2, XCircle as XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type VoteHistoryAccordionProps = {
  room: GameRoom;
  localPlayers: Player[];
  totalRounds: number;
};

// Helper function to get Chinese role name
function getRoleChineseName(role: Role): string {
  switch (role) {
    case Role.TeamMember: return "队员";
    case Role.Undercover: return "卧底";
    case Role.Coach: return "教练";
    default: return "未知角色";
  }
}

// Helper function to get role icon (consistent with PlayerListPanel)
const getRoleIcon = (role?: Role, iconSizeClass = "h-2 w-2 mr-0.5") => {
  switch (role) {
    case Role.Undercover: return <Swords className={cn(iconSizeClass)} />;
    case Role.TeamMember: return <Shield className={cn(iconSizeClass, "text-blue-500")} />;
    case Role.Coach: return <HelpCircle className={cn(iconSizeClass)} />;
    default: return null;
  }
};

// Helper function to get badge class based on role (consistent with PlayerListPanel)
const getRoleBadgeClassName = (role?: Role): string => {
  let baseClass = "flex items-center gap-1 text-[8px] px-0.5 py-0 border"; // Smallest for dense history
  if (role === Role.TeamMember) {
    return cn(baseClass, "bg-blue-100 text-blue-700 border-blue-300");
  } else if (role === Role.Coach) {
    return cn(baseClass, "bg-yellow-100 text-yellow-700 border-yellow-300");
  } else if (role === Role.Undercover) {
    return cn(baseClass, "bg-red-100 text-red-700 border-red-300");
  }
  return cn(baseClass, "bg-gray-100 text-gray-700 border-gray-300"); // Default/unknown
};


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
                      if (missionForRound.outcome === 'fail' && missionForRound.cardPlays && room.status === GameRoomStatus.Finished) { 
                          const saboteurs = missionForRound.cardPlays
                              .filter(play => play.card === 'fail')
                              .map(play => {
                                  const player = localPlayers.find(p => p.id === play.playerId);
                                  return player ? player.name : '未知玩家'; 
                              });
                          if (saboteurs.length > 0) {
                              missionOutcomeText += ` (破坏者: ${saboteurs.join(', ')})`;
                          }
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
                                {captain && captain.role && room.status === GameRoomStatus.Finished && <Badge className={cn(getRoleBadgeClassName(captain.role), "ml-1")}>{getRoleIcon(captain.role)}{getRoleChineseName(captain.role)}</Badge>}
                              )</div>
                              <div className="text-xs mt-1">提议队伍: {voteEntry.proposedTeamIds.map(id => {
                                  const player = localPlayers.find(p => p.id === id);
                                  return player ? (
                                    <span key={id} className="mr-1 inline-flex items-center">
                                      {player.name}
                                      {player.role && room.status === GameRoomStatus.Finished && <Badge className={cn(getRoleBadgeClassName(player.role), "ml-0.5")}>{getRoleIcon(player.role)}{getRoleChineseName(player.role)}</Badge>}
                                    </span>
                                  ) : <span key={id} className="mr-1">未知</span>;
                              }).reduce((acc, curr, idx, arr) => {
                                const elements = acc ? [acc] : [];
                                if (acc && idx > 0) elements.push(<span key={`comma-${idx}`}>, </span>);
                                elements.push(curr);
                                return <>{elements}</>;
                              }, null as React.ReactNode)}
                              </div>
                              <p className="text-xs mt-1">队伍投票结果: <span className={cn("font-semibold", voteEntry.outcome === 'approved' ? 'text-green-600' : 'text-red-500')}>{voteEntry.outcome === 'approved' ? '通过' : '否决'}</span></p>
                              <ul className="mt-2 space-y-1 text-xs list-disc list-inside pl-2">
                                  {voteEntry.votes.map(vote => {
                                  const voter = localPlayers.find(p => p.id === vote.playerId);
                                  return (
                                      <li key={`vote-${voteEntry.round}-${voteEntry.attemptNumberInRound}-${vote.playerId}`}>
                                        {voter ? voter.name : '未知玩家'}
                                        {voter && voter.role && room.status === GameRoomStatus.Finished && <Badge className={cn(getRoleBadgeClassName(voter.role), "ml-1")}>{getRoleIcon(voter.role)}{getRoleChineseName(voter.role)}</Badge>}
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
                                    {player && player.role && <Badge className={cn(getRoleBadgeClassName(player.role), "ml-1")}>{getRoleIcon(player.role)}{getRoleChineseName(player.role)}</Badge>}
                                    :
                                    {play.card === 'success' ?
                                      <Badge variant="outline" className="ml-2 border-green-500 text-green-600"><CheckCircle2 className="mr-1 h-3 w-3"/> 成功</Badge> :
                                      <Badge variant="destructive" className="ml-2"><XCircleIcon className="mr-1 h-3 w-3"/> 破坏</Badge>
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
