
"use client";

import type { Player, Role, MissionCardPlay, RoomMode } from "@/lib/types"; // Added RoomMode
import { Role as RoleEnum } from "@/lib/types"; // Import Role as RoleEnum to avoid conflict
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldX, Eye } from "lucide-react"; // Added Eye

type MissionExecutionDisplayProps = {
  roomMode: RoomMode;
  isHostCurrentUser: boolean;
  currentRound?: number;
  missionTeamPlayerIds: string[]; // Keep this to know who is on the team
  allPlayersInRoom: Player[]; // To get role and name for manual mode
  currentUserIsOnMission: boolean;
  currentUserRole?: Role;
  currentUserHasPlayedMissionCard: boolean; // For online mode
  onFinalizeMissionManually: () => void; // For manual mode to trigger processing
  missionCardPlaysForCurrentMission: MissionCardPlay[]; // To know who has played

  // Manual mode specific props
  manualMissionPlayerIndex: number | null;
  isManualCardInputVisible: boolean;
  onShowManualCardInput: () => void;
  onManualCardPlay: (card: 'success' | 'fail') => void;
};

export function MissionExecutionDisplay({
  roomMode,
  isHostCurrentUser,
  currentRound,
  missionTeamPlayerIds,
  allPlayersInRoom,
  currentUserIsOnMission,
  currentUserRole,
  currentUserHasPlayedMissionCard,
  onFinalizeMissionManually, // This prop might be better named, e.g., onAllManualPlaysSubmitted
  missionCardPlaysForCurrentMission,
  // Manual mode props
  manualMissionPlayerIndex,
  isManualCardInputVisible,
  onShowManualCardInput,
  onManualCardPlay,
}: MissionExecutionDisplayProps) {

  const missionTeamPlayerObjects = missionTeamPlayerIds.map(id => allPlayersInRoom.find(p => p.id === id)).filter(Boolean) as Player[];

  if (roomMode === RoomMode.ManualInput) {
    if (!isHostCurrentUser) {
      return <p className="text-center text-muted-foreground py-4">等待主持人为出战队员逐一输入行动...</p>;
    }

    if (manualMissionPlayerIndex === null || manualMissionPlayerIndex >= missionTeamPlayerObjects.length) {
      // This case should ideally be handled by the parent, 
      // e.g., by calling onFinalizeMissionManually or moving to next phase.
      // For now, if all manual plays are done, this component might not even be active,
      // or we show a waiting message if somehow it's still in this phase.
      return <p className="text-center text-muted-foreground py-4">等待处理比赛结果...</p>;
    }
    
    const currentPlayerForManualInput = missionTeamPlayerObjects[manualMissionPlayerIndex];
    if (!currentPlayerForManualInput) {
        return <p className="text-center text-destructive py-4">错误：找不到当前出牌玩家。</p>;
    }

    return (
      <div className="space-y-4 text-center p-4 border rounded-lg shadow-md">
        <h3 className="text-lg font-semibold">手动输入比赛行动 (回合 {currentRound})</h3>
        {!isManualCardInputVisible ? (
          <>
            <p className="text-xl font-medium">轮到玩家 <span className="text-primary">{currentPlayerForManualInput.name}</span> 出牌。</p>
            <p className="text-sm text-muted-foreground">请将设备仅给该玩家查看，或由主持人询问其选择后输入。</p>
            <Button onClick={onShowManualCardInput} className="mt-2">
              <Eye className="mr-2 h-5 w-5" /> {isHostCurrentUser ? `为 ${currentPlayerForManualInput.name} 显示出牌选项` : "准备好了"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xl font-medium">玩家 <span className="text-primary">{currentPlayerForManualInput.name}</span>，请秘密选择你的行动：</p>
            <div className="flex gap-4 justify-center mt-3">
              <Button onClick={() => onManualCardPlay('success')} className="bg-blue-500 hover:bg-blue-600 text-white">
                <ShieldCheck className="mr-2 h-5 w-5"/> 打出【成功】
              </Button>
              {currentPlayerForManualInput.role === RoleEnum.Undercover && (
                <Button onClick={() => onManualCardPlay('fail')} variant="destructive" className="bg-orange-500 hover:bg-orange-600">
                  <ShieldX className="mr-2 h-5 w-5"/> 打出【破坏】
                </Button>
              )}
            </div>
          </>
        )}
         <p className="text-xs text-muted-foreground mt-2">
          已输入: {missionCardPlaysForCurrentMission.length} / {missionTeamPlayerIds.length}
        </p>
      </div>
    );
  }

  // Online Mode UI
  return (
    <div className="space-y-3 text-center">
      <h3 className="text-lg font-semibold">比赛执行中 (回合 {currentRound})</h3>
      <p className="text-muted-foreground">出战队伍: {missionTeamPlayerObjects.map(p=>p.name).join(', ')}</p>
      {currentUserIsOnMission ? (
        currentUserRole === RoleEnum.Undercover ? (
          !currentUserHasPlayedMissionCard ? (
            <div className="space-y-2">
              <p className="font-semibold">选择你的行动：</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => {
                    // This component should not directly call `onHumanUndercoverPlayCard`
                    // Instead, the parent should handle this or pass a more specific handler
                    // For now, assuming parent has `handleHumanUndercoverPlayCard`
                    // This part of the component is now less relevant since the parent handles the logic for online mode.
                    // This direct call might be removed if `handleHumanUndercoverPlayCard` is moved or handled higher up.
                    console.warn("Direct call from MissionExecutionDisplay to play card, review logic flow.");
                }} className="bg-blue-500 hover:bg-blue-600 text-white"><ShieldCheck className="mr-2 h-5 w-5"/> 打出【成功】</Button>
                <Button onClick={() => {
                     console.warn("Direct call from MissionExecutionDisplay to play card, review logic flow.");
                }} variant="destructive" className="bg-orange-500 hover:bg-orange-600"><ShieldX className="mr-2 h-5 w-5"/> 打出【破坏】</Button>
              </div>
            </div>
          ) : (
            <p className="text-green-600 font-semibold">你已选择行动。</p> // Simplified message
          )
        ) : (
          <p className="text-blue-600 font-semibold">你自动打出【成功】牌。</p>
        )
      ) : (
        <p className="text-muted-foreground">等待队伍行动...</p>
      )}
       <p className="text-xs text-muted-foreground mt-2">
          已行动: {missionCardPlaysForCurrentMission.length} / {missionTeamPlayerIds.length}
        </p>
    </div>
  );
}
