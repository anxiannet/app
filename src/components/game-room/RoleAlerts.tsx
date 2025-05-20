
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
  if (!currentUserRole || roomStatus !== GameRoomStatus.InProgress || currentUserRole === Role.Coach || currentUserRole === Role.Undercover || currentUserRole === Role.TeamMember) {
    return null;
  }

  // This alert will now effectively be hidden for all roles as per user requests
  // If you ever need to show an alert for a new role, or re-enable for TeamMember,
  // you would adjust the condition above.
  return (
    <>
      <Alert variant="default" className="bg-accent/20 border-accent text-accent-foreground">
        <Info className="h-5 w-5 text-accent" />
        <AlertTitle className="font-semibold">你的角色: {currentUserRole}</AlertTitle>
        <AlertDescription>
          {/* Descriptions for other roles would go here if they were not also hidden */}
        </AlertDescription>
      </Alert>
    </>
  );
}
