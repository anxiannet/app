
"use client";

import type { GameRoom, Player, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldX } from "lucide-react";

type GameOverSummaryProps = {
  room: GameRoom;
  localPlayers: Player[];
  gameOverMessage: React.ReactNode;
  onReturnToLobby: () => void;
};

export function GameOverSummary({ room, localPlayers, gameOverMessage, onReturnToLobby }: GameOverSummaryProps) {
  return (
    <div className="text-center p-6 bg-green-100 dark:bg-green-900 rounded-lg shadow">
      <h3 className="text-2xl font-bold text-green-700 dark:text-green-300">游戏结束!</h3>
      {gameOverMessage && (<p className="text-lg mt-2">{gameOverMessage}</p>)}
      {room.coachCandidateId && (
        <div className="mt-2 text-sm">
          <p className="font-semibold">教练指认环节:</p>
          <p>卧底指认 <span className="font-bold">{localPlayers.find(p=>p.id === room.coachCandidateId)?.name || '未知玩家'}</span> 为教练。</p>
          <p>
            {localPlayers.find(p => p.id === room.coachCandidateId && p.role === Role.Coach)
              ? <span className="text-destructive font-bold">指认成功!</span>
              : <span className="text-green-600 font-bold">指认失败!</span>
            }
            实际教练是: <span className="font-bold">{localPlayers.find(p=>p.role === Role.Coach)?.name || '未知'}</span>
          </p>
        </div>
      )}
      <div className="flex items-center gap-4 justify-center mt-2">
        <span className="flex items-center"><ShieldCheck className="mr-1 h-4 w-4 text-green-500" /> 战队胜场: {room.teamScores?.teamMemberWins || 0}</span>
        <span className="flex items-center"><ShieldX className="mr-1 h-4 w-4 text-destructive" /> 卧底胜场: {room.teamScores?.undercoverWins || 0}</span>
      </div>
      <p className="text-muted-foreground mt-2">感谢您的参与！</p>
      <Button variant="outline" onClick={onReturnToLobby} className="w-full mt-4 max-w-sm mx-auto">返回大厅</Button>
    </div>
  );
}
