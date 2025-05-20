
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
  if (!currentUserRole || roomStatus !== GameRoomStatus.InProgress || currentUserRole === Role.Coach || currentUserRole === Role.Undercover) {
    return null;
  }

  return (
    <>
      {/* This alert will now only show for TeamMember */}
      <Alert variant="default" className="bg-accent/20 border-accent text-accent-foreground">
        <Info className="h-5 w-5 text-accent" />
        <AlertTitle className="font-semibold">你的角色: {currentUserRole}</AlertTitle>
        <AlertDescription>
          {currentUserRole === Role.TeamMember && "作为一名普通队员，你需要找出队伍中的卧底，并完成队伍的目标。"}
        </AlertDescription>
      </Alert>
    </>
  );
}

