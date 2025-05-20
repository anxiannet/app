
"use client";

import { type Player, Role, GameRoomStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Eye, Users } from "lucide-react";

type RoleAlertsProps = {
  currentUserRole?: Role;
  roomStatus: GameRoomStatus;
  knownUndercoversByCoach: Player[];
  fellowUndercovers: Player[];
  isSoleUndercover: boolean;
};

export function RoleAlerts({ currentUserRole, roomStatus, knownUndercoversByCoach, fellowUndercovers, isSoleUndercover }: RoleAlertsProps) {
  if (!currentUserRole || roomStatus !== GameRoomStatus.InProgress || currentUserRole === Role.Coach) {
    return null;
  }

  return (
    <>
      {/* This alert will now only show for TeamMember and Undercover */}
      <Alert variant="default" className="bg-accent/20 border-accent text-accent-foreground">
        <Info className="h-5 w-5 text-accent" />
        <AlertTitle className="font-semibold">你的角色: {currentUserRole}</AlertTitle>
        <AlertDescription>
          {currentUserRole === Role.Undercover && "你的任务是隐藏自己的身份，误导其他队员，并达成秘密目标。"}
          {currentUserRole === Role.TeamMember && "作为一名普通队员，你需要找出队伍中的卧底，并完成队伍的目标。"}
        </AlertDescription>
      </Alert>

      {currentUserRole === Role.Undercover && (
        <>
          {fellowUndercovers.length > 0 && (
            <Alert variant="default" className="bg-destructive/10 border-destructive/30 text-destructive-foreground mt-4">
              <Users className="h-5 w-5 text-destructive" />
              <AlertTitle className="font-semibold">你的卧底同伙</AlertTitle>
              <AlertDescription>你的卧底同伙是: {fellowUndercovers.map(u => u.name).join(', ')}。</AlertDescription>
            </Alert>
          )}
          {isSoleUndercover && (
            <Alert variant="default" className="bg-destructive/10 border-destructive/30 text-destructive-foreground mt-4">
              <Info className="h-5 w-5 text-destructive" />
              <AlertTitle className="font-semibold">孤军奋战</AlertTitle>
              <AlertDescription>你是场上唯一的卧底。</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </>
  );
}
