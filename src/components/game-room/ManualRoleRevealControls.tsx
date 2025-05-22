
"use client";

import type { Player } from "@/lib/types";
import { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Eye, CheckSquare, Users, Swords, Shield, HelpCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ManualRoleRevealControlsProps = {
  playerToReveal?: Player;
  allPlayersInRoom: Player[];
  isRoleVisible: boolean;
  onShowRole: () => void;
  onNextOrComplete: () => void;
  isLastPlayer: boolean;
};

const getRoleIcon = (role?: Role, className = "h-4 w-4") => {
    switch (role) {
      case Role.Undercover: return <Swords className={cn(className, "text-destructive")} />;
      case Role.TeamMember: return <Shield className={cn(className, "text-blue-500")} />;
      case Role.Coach: return <HelpCircle className={cn(className, "text-yellow-500")} />;
      default: return null;
    }
  };
  
  const getRoleBadgeClassName = (role?: Role): string => {
    let baseClass = "text-xs px-2 py-0.5 border"; 
    if (role === Role.TeamMember) {
      return cn(baseClass, "bg-blue-100 text-blue-700 border-blue-300");
    } else if (role === Role.Coach) {
      return cn(baseClass, "bg-yellow-100 text-yellow-700 border-yellow-300");
    } else if (role === Role.Undercover) {
      return cn(baseClass, "bg-red-100 text-red-700 border-red-300");
    }
    return cn(baseClass, "bg-gray-100 text-gray-700 border-gray-300");
  };


export function ManualRoleRevealControls({
  playerToReveal,
  allPlayersInRoom,
  isRoleVisible,
  onShowRole,
  onNextOrComplete,
  isLastPlayer,
}: ManualRoleRevealControlsProps) {

  if (!playerToReveal) {
    // This state ideally shouldn't be reached if logic in GameRoomPage is correct,
    // as manualRoleRevealIndex would be null, hiding this component.
    return <p className="text-center text-muted-foreground">角色查看完毕。</p>;
  }

  const knownUndercoversByCoach = (playerToReveal.role === Role.Coach) 
    ? allPlayersInRoom.filter(p => p.role === Role.Undercover) 
    : [];
  const fellowUndercovers = (playerToReveal.role === Role.Undercover) 
    ? allPlayersInRoom.filter(p => p.role === Role.Undercover && p.id !== playerToReveal.id) 
    : [];


  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 min-h-[300px] bg-background rounded-lg shadow-md border">
      {!isRoleVisible ? (
        <>
          <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary ring-offset-2">
            <AvatarImage src={playerToReveal.avatarUrl} alt={playerToReveal.name} data-ai-hint="avatar person" />
            <AvatarFallback className="text-3xl">
              {playerToReveal.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="text-2xl font-semibold text-center text-foreground">
            轮到玩家 <span className="text-primary">{playerToReveal.name}</span> 查看身份。
          </p>
          <p className="text-sm text-muted-foreground text-center">请确认你是 {playerToReveal.name} 本人，然后点击下方按钮。</p>
          <Button onClick={onShowRole} size="lg" className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Eye className="mr-2 h-5 w-5" /> 查看我的身份
          </Button>
        </>
      ) : (
        <Card className="w-full max-w-md p-6 shadow-xl text-center">
          <CardHeader>
            <div className="flex items-center justify-center space-x-3 mb-2">
                <Avatar className="h-16 w-16 border-2 border-accent">
                    <AvatarImage src={playerToReveal.avatarUrl} alt={playerToReveal.name} data-ai-hint="avatar person"/>
                    <AvatarFallback className="text-2xl">{playerToReveal.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-2xl text-primary">{playerToReveal.name}</CardTitle>
            </div>
            <CardDescription className="text-lg">你的身份是:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge className={cn("text-2xl px-4 py-2", getRoleBadgeClassName(playerToReveal.role))}>
              {getRoleIcon(playerToReveal.role, "mr-2 h-6 w-6")}
              {playerToReveal.role}
            </Badge>

            {playerToReveal.role === Role.Coach && knownUndercoversByCoach.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-semibold text-destructive flex items-center justify-center">
                  <Eye className="mr-1 h-4 w-4" /> 你知道的卧底是:
                </p>
                <ul className="list-disc list-inside text-muted-foreground">
                  {knownUndercoversByCoach.map(uc => <li key={uc.id}>{uc.name}</li>)}
                </ul>
              </div>
            )}

            {playerToReveal.role === Role.Undercover && fellowUndercovers.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-semibold text-destructive flex items-center justify-center">
                  <Users className="mr-1 h-4 w-4" /> 你的卧底同伙是:
                </p>
                <ul className="list-disc list-inside text-muted-foreground">
                  {fellowUndercovers.map(fu => <li key={fu.id}>{fu.name}</li>)}
                </ul>
              </div>
            )}
             {playerToReveal.role === Role.Undercover && fellowUndercovers.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">(你是唯一的卧底)</p>
             )}


            <Button onClick={onNextOrComplete} size="lg" className="mt-6 bg-accent hover:bg-accent/90 text-accent-foreground w-full">
              <CheckSquare className="mr-2 h-5 w-5" />
              {isLastPlayer ? "我知道了，开始游戏" : "我看完了，传递给下一位"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
