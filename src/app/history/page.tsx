
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type PlayerGameRecord, Role, type VoteHistoryEntry, type Mission, type MissionCardPlay } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, Award, Shield, Swords, HelpCircle, TrendingUp, TrendingDown, MinusCircle, ListChecks, Info, ThumbsUp, ThumbsDown, History as HistoryIcon, CheckCircle2, XCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function getRoleChineseName(role: Role): string {
  switch (role) {
    case Role.TeamMember: return "队员";
    case Role.Undercover: return "卧底";
    case Role.Coach: return "教练";
    default: return "未知";
  }
}

function getRoleIcon(role?: Role) {
    switch (role) {
      case Role.Undercover: return <Swords className="inline-block mr-1 h-4 w-4 text-destructive" />;
      case Role.TeamMember: return <Shield className="inline-block mr-1 h-4 w-4 text-green-500" />;
      case Role.Coach: return <HelpCircle className="inline-block mr-1 h-4 w-4 text-yellow-500" />;
      default: return null;
    }
}

export default function GameHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [gameRecords, setGameRecords] = useState<PlayerGameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/history");
      return;
    }

    setIsLoading(true);
    try {
      const historyKey = `anxian-history-${user.id}`;
      const storedRecordsRaw = localStorage.getItem(historyKey);
      if (storedRecordsRaw) {
        const parsedRecords: PlayerGameRecord[] = JSON.parse(storedRecordsRaw);
        // Ensure missionHistory and fullVoteHistory are arrays
        const validatedRecords = parsedRecords.map(record => ({
            ...record,
            missionHistory: Array.isArray(record.missionHistory) ? record.missionHistory : [],
            fullVoteHistory: Array.isArray(record.fullVoteHistory) ? record.fullVoteHistory : [],
            playersInGame: Array.isArray(record.playersInGame) ? record.playersInGame : [],
        }));
        validatedRecords.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
        setGameRecords(validatedRecords);
      }
    } catch (e) {
      console.error("Failed to load game history from localStorage:", e);
    }
    setIsLoading(false);
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return <div className="text-center py-10">加载游戏记录...</div>;
  }

  if (!user) {
    return null; 
  }

  if (gameRecords.length === 0) {
    return (
      <div className="text-center py-10">
        <h1 className="text-3xl font-bold mb-4 text-primary">游戏记录</h1>
        <p className="text-muted-foreground">您还没有任何游戏记录。</p>
        <Button onClick={() => router.push("/")} className="mt-6">返回大厅</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="text-center py-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">
          {user.name} 的游戏记录
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          回顾你的卧底生涯，分析每一次的胜负。
        </p>
      </section>

      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="space-y-6 pr-4">
          {gameRecords.map((record, index) => (
            <Card key={record.gameInstanceId ? `record-${record.gameInstanceId}-${index}` : `record-index-${index}`} className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-2xl text-primary">{record.roomName}</CardTitle>
                  <Badge
                    className={cn(
                      "text-sm px-3 py-1",
                      record.gameOutcome === 'win' && "bg-green-500 text-white",
                      record.gameOutcome === 'loss' && "bg-red-500 text-white",
                      record.gameOutcome === 'draw' && "bg-gray-500 text-white"
                    )}
                  >
                    {record.gameOutcome === 'win' ? <Award className="mr-1 h-4 w-4" /> : record.gameOutcome === 'loss' ? <TrendingDown className="mr-1 h-4 w-4" /> : <MinusCircle className="mr-1 h-4 w-4" />}
                    {record.gameOutcome === 'win' ? '胜利' : record.gameOutcome === 'loss' ? '失败' : '平局'}
                  </Badge>
                </div>
                <CardDescription className="flex items-center text-xs text-muted-foreground">
                  <CalendarDays className="mr-1 h-3 w-3" /> {new Date(record.playedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <strong>你的角色:</strong> {getRoleIcon(record.myRole)} {getRoleChineseName(record.myRole)}
                </div>
                <div className="text-sm">
                  <strong>最终比分 (战队:卧底):</strong> {record.finalScores.teamMemberWins} : {record.finalScores.undercoverWins}
                </div>
                 <div className="text-sm">
                  <strong>游戏结果:</strong> <span className="font-semibold">{record.gameSummaryMessage}</span>
                </div>
                {record.coachAssassinationAttempt && (
                  <div className="text-xs p-2 border border-dashed rounded-md bg-muted/30">
                    <p className="font-semibold flex items-center"><Info className="mr-1 h-3 w-3"/>教练指认环节:</p>
                    <p>目标: {record.coachAssassinationAttempt.targetPlayerName} ({getRoleChineseName(record.playersInGame.find(p => p.id === record.coachAssassinationAttempt?.targetPlayerId)?.role || Role.TeamMember )})</p>
                    <p>结果: {record.coachAssassinationAttempt.assassinationSucceeded ? "指认成功 (卧底胜利)" : "指认失败 (战队胜利)"}</p>
                  </div>
                )}
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="players-in-game">
                    <AccordionTrigger className="text-sm hover:no-underline">
                        <Users className="mr-2 h-4 w-4 text-muted-foreground" /> 查看当局玩家 ({record.playersInGame.length}人)
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="max-h-40">
                        <ul className="space-y-1 text-xs pl-2">
                          {record.playersInGame.map(p => (
                            <li key={p.id} className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                              <span>{p.name}</span>
                              <Badge variant="outline" className="font-normal text-xs">
                                  {getRoleIcon(p.role)} {getRoleChineseName(p.role)}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>

                  {(record.missionHistory && record.missionHistory.length > 0) || (record.fullVoteHistory && record.fullVoteHistory.length > 0) ? (
                     <AccordionItem value="game-details-for-record">
                        <AccordionTrigger className="text-sm hover:no-underline">
                            <ListChecks className="mr-2 h-4 w-4 text-muted-foreground" /> 查看本局详细记录
                        </AccordionTrigger>
                        <AccordionContent>
                            {record.fullVoteHistory && record.fullVoteHistory.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold mb-2 mt-4 text-muted-foreground">详细投票记录:</h4>
                                    <ScrollArea className="h-[300px] pr-4">
                                        <Accordion type="multiple" className="w-full">
                                            {Array.from(new Set(record.fullVoteHistory.map(vh => vh.round))).sort((a, b) => a - b)
                                            .map(roundNum => {
                                                const roundVotes = record.fullVoteHistory!.filter(vh => vh.round === roundNum);
                                                const missionForRound = record.missionHistory?.find(m => m.round === roundNum);

                                                if (roundVotes.length === 0 && !missionForRound) return null;

                                                let missionOutcomeText = '';
                                                if (missionForRound) {
                                                    missionOutcomeText = missionForRound.outcome === 'success' ? ' - 比赛成功' : (missionForRound.outcome === 'fail' ? ' - 比赛失败' : '');
                                                    if (missionForRound.outcome === 'fail' && missionForRound.cardPlays) {
                                                        const saboteurs = missionForRound.cardPlays
                                                            .filter(play => play.card === 'fail')
                                                            .map(play => {
                                                                const player = record.playersInGame.find(p => p.id === play.playerId);
                                                                return player ? player.name : '未知玩家';
                                                            });
                                                        if (saboteurs.length > 0) {
                                                            missionOutcomeText += ` (破坏者: ${saboteurs.join(', ')})`;
                                                        }
                                                    }
                                                }
                                                
                                                return (
                                                    <AccordionItem value={`round-history-${record.gameInstanceId}-${roundNum}`} key={`round-history-${record.gameInstanceId}-${roundNum}`}>
                                                        <AccordionTrigger className="text-sm font-medium hover:no-underline p-2 bg-muted/50 rounded-t-md">
                                                        第 {roundNum} 场比赛记录 ({roundVotes.length}次组队){missionOutcomeText}
                                                        </AccordionTrigger>
                                                        <AccordionContent className="p-2 border border-t-0 rounded-b-md">
                                                        {roundVotes.map((voteEntry, attemptIdx) => {
                                                            const captain = record.playersInGame.find(p => p.id === voteEntry.captainId);
                                                            const captainDisplay = captain ? `${captain.name} (${getRoleChineseName(captain.role)})` : '未知';

                                                            const proposedTeamDisplay = voteEntry.proposedTeamIds.map(id => {
                                                                const player = record.playersInGame.find(p => p.id === id);
                                                                return player ? `${player.name} (${getRoleChineseName(player.role)})` : '未知';
                                                            }).join(', ');

                                                            return (
                                                            <div key={`vote-entry-${record.gameInstanceId}-${roundNum}-${attemptIdx}`} className="mb-3 p-2 border rounded-md bg-background text-xs">
                                                                <p className="font-semibold">第 {voteEntry.attemptNumberInRound} 次组队 (队长: {captainDisplay})</p>
                                                                <p className="mt-1">提议队伍: {proposedTeamDisplay}</p>
                                                                <p className="mt-1">投票结果: <span className={cn("font-semibold", voteEntry.outcome === 'approved' ? 'text-green-600' : 'text-red-500')}>{voteEntry.outcome === 'approved' ? '通过' : '否决'}</span></p>
                                                                <ul className="mt-1.5 space-y-0.5 list-disc list-inside pl-1">
                                                                {voteEntry.votes.map(vote => {
                                                                    const voter = record.playersInGame.find(p => p.id === vote.playerId);
                                                                    const voterDisplay = voter ? `${voter.name} (${getRoleChineseName(voter.role)})` : '未知玩家';
                                                                    return (
                                                                    <li key={`vote-${record.gameInstanceId}-${voteEntry.round}-${voteEntry.attemptNumberInRound}-${vote.playerId}`}>
                                                                        {voterDisplay}: {vote.vote === 'approve' ? <span className="text-green-500 flex items-center inline-flex">同意 <ThumbsUp className="h-3 w-3 ml-1" /></span> : <span className="text-red-500 flex items-center inline-flex">拒绝 <ThumbsDown className="h-3 w-3 ml-1" /></span>}
                                                                    </li>
                                                                    );
                                                                })}
                                                                </ul>
                                                            </div>
                                                            );
                                                        })}
                                                        {missionForRound && missionForRound.cardPlays && missionForRound.cardPlays.length > 0 && (
                                                            <div className="mt-3 pt-3 border-t border-dashed">
                                                                <p className="font-semibold text-sm mb-1">本场比赛队员行动:</p>
                                                                <ul className="space-y-0.5 text-xs list-disc list-inside pl-1">
                                                                {missionForRound.cardPlays.map((play, playIdx) => {
                                                                    const player = record.playersInGame.find(p => p.id === play.playerId);
                                                                    const playerDisplay = player ? `${player.name} (${getRoleChineseName(player.role)})` : '未知玩家';
                                                                    return (
                                                                    <li key={`mission-play-${record.gameInstanceId}-${roundNum}-${playIdx}`}>
                                                                        {playerDisplay}: 
                                                                        {play.card === 'success' ? 
                                                                            <Badge variant="outline" className="ml-1 px-1 py-0 border-green-500 text-green-600"><CheckCircle2 className="inline-block mr-0.5 h-3 w-3"/> 成功</Badge> : 
                                                                            <Badge variant="destructive" className="ml-1 px-1 py-0"><XCircle className="inline-block mr-0.5 h-3 w-3"/> 破坏</Badge>
                                                                        }
                                                                    </li>
                                                                    );
                                                                })}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}
                                        </Accordion>
                                    </ScrollArea>
                                </section>
                            )}
                        </AccordionContent>
                     </AccordionItem>
                  ) : null}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
       <div className="text-center mt-8">
          <Button onClick={() => router.push("/")} variant="outline">返回大厅</Button>
        </div>
    </div>
  );
}
