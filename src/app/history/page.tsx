
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
                      <ScrollArea className="max-h-40"> {/* Removed overflow-y-auto here */}
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

                  {(record.missionHistory && record.missionHistory.length > 0) || (record.fullVoteHistory && record.fullVoteHistory.length > 0) && (
                     <AccordionItem value="game-details-for-record">
                        <AccordionTrigger className="text-sm hover:no-underline">
                            <ListChecks className="mr-2 h-4 w-4 text-muted-foreground" /> 查看本局详细记录
                        </AccordionTrigger>
                        <AccordionContent>
                            {record.missionHistory && record.missionHistory.length > 0 && (
                                <section className="mb-4">
                                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground">比赛详情:</h4>
                                    <ScrollArea className="max-h-[250px] pr-2">
                                        <div className="space-y-3">
                                        {record.missionHistory.map((mission, missionIdx) => (
                                            <div key={`mission-${record.gameInstanceId}-${mission.round}-${missionIdx}`} className="p-2 border rounded-md bg-background text-xs">
                                                <p className="font-semibold">第 {mission.round} 场比赛: 
                                                    <span className={cn("ml-1", mission.outcome === 'success' ? 'text-green-600' : 'text-red-500')}>
                                                    {mission.outcome === 'success' ? '比赛成功' : '比赛失败'}
                                                    </span>
                                                    {mission.outcome === 'fail' && ` (${mission.failCardsPlayed} 张破坏牌)`}
                                                </p>
                                                <p className="mt-1">出战队伍:</p>
                                                <ul className="list-disc list-inside pl-2">
                                                    {mission.teamPlayerIds.map(playerId => {
                                                        const player = record.playersInGame.find(p => p.id === playerId);
                                                        return (
                                                            <li key={`mission-${mission.round}-player-${playerId}`}>
                                                                {player ? `${player.name} (${getRoleChineseName(player.role)})` : '未知玩家'}
                                                                {mission.cardPlays.find(cp => cp.playerId === playerId)?.card === 'fail' && (
                                                                    <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">破坏</Badge>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                                {mission.outcome === 'fail' && mission.cardPlays.filter(cp => cp.card === 'fail').length > 0 && (
                                                    <p className="mt-1">破坏者: {mission.cardPlays.filter(cp => cp.card === 'fail').map(cp => {
                                                        const player = record.playersInGame.find(p => p.id === cp.playerId);
                                                        return player ? player.name : '未知玩家';
                                                    }).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                        </div>
                                    </ScrollArea>
                                </section>
                            )}
                            {record.fullVoteHistory && record.fullVoteHistory.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold mb-2 mt-4 text-muted-foreground">详细投票记录:</h4>
                                    <ScrollArea className="h-[200px] pr-2">
                                        {record.fullVoteHistory.reduce((acc, vh) => acc.includes(vh.round) ? acc : [...acc, vh.round], [] as number[])
                                        .sort((a,b) => a - b) 
                                        .map(roundNum => {
                                            const roundVotes = record.fullVoteHistory!.filter(vh => vh.round === roundNum);
                                            if (roundVotes.length === 0) return null;
                                            
                                            return (
                                                <Accordion key={`record-${record.gameInstanceId}-round-${roundNum}`} type="single" collapsible className="mb-2">
                                                <AccordionItem value={`round-detail-${roundNum}`}>
                                                    <AccordionTrigger className="text-xs font-medium hover:no-underline p-2 bg-muted/50 rounded-t-md">
                                                    第 {roundNum} 场比赛记录 ({roundVotes.length}次组队)
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
                                                        <div key={`record-${record.gameInstanceId}-round-${roundNum}-attempt-${attemptIdx}`} className="mb-3 p-2 border rounded-md bg-background text-xs">
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
                                                    </AccordionContent>
                                                </AccordionItem>
                                                </Accordion>
                                            );
                                        })}
                                    </ScrollArea>
                                </section>
                            )}
                        </AccordionContent>
                     </AccordionItem>
                  )}
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

