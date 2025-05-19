
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type PlayerGameRecord, Role } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, Award, Shield, Swords, HelpCircle, TrendingUp, TrendingDown, MinusCircle, ListChecks, Info } from "lucide-react";
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
        // Sort by playedAt descending (most recent first)
        parsedRecords.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
        setGameRecords(parsedRecords);
      }
    } catch (e) {
      console.error("Failed to load game history from localStorage:", e);
      // Optionally, show a toast to the user
    }
    setIsLoading(false);
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return <div className="text-center py-10">加载游戏记录...</div>;
  }

  if (!user) {
    return null; // Should be redirected by useEffect
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
          {gameRecords.map((record) => (
            <Card key={record.gameInstanceId + record.playedAt} className="shadow-lg hover:shadow-xl transition-shadow">
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
                    <p>目标: {record.coachAssassinationAttempt.targetPlayerName}</p>
                    <p>结果: {record.coachAssassinationAttempt.assassinationSucceeded ? "指认成功 (卧底胜利)" : "指认失败 (战队胜利)"}</p>
                  </div>
                )}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="players-in-game">
                    <AccordionTrigger className="text-sm hover:no-underline">
                        <Users className="mr-2 h-4 w-4 text-muted-foreground" /> 查看当局玩家 ({record.playersInGame.length}人)
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 text-xs pl-2 max-h-40 overflow-y-auto">
                        {record.playersInGame.map(p => (
                          <li key={p.id} className="flex items-center justify-between p-1 rounded hover:bg-muted/50">
                            <span>{p.name}</span>
                            <Badge variant="outline" className="font-normal text-xs">
                                {getRoleIcon(p.role)} {getRoleChineseName(p.role)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
              <CardFooter>
                <Button variant="link" onClick={() => router.push(`/rooms/${record.roomId}`)} className="text-xs p-0 h-auto">
                  (仅供参考) 查看房间原始信息
                </Button>
              </CardFooter>
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
