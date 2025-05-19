
"use client";

import { Button } from "@/components/ui/button";
import { Play, UserPlus, LogOut } from "lucide-react"; // Added LogOut for Return to Lobby

type WaitingPhaseActionsProps = {
  isHost: boolean;
  canStartGame: boolean;
  localPlayersLength: number;
  minPlayersToStart: number;
  maxPlayers: number;
  onStartGame: () => void;
  canAddVirtualPlayer: boolean;
  onAddVirtualPlayer: () => void;
  onReturnToLobby: () => void;
};

export function WaitingPhaseActions({
  isHost,
  canStartGame,
  localPlayersLength,
  minPlayersToStart,
  maxPlayers,
  onStartGame,
  canAddVirtualPlayer,
  onAddVirtualPlayer,
  onReturnToLobby,
}: WaitingPhaseActionsProps) {
  return (
    <>
      <p className="text-muted-foreground">等待主持人开始游戏...</p>
      {isHost && (
        <div className="space-y-2">
          <Button onClick={onStartGame} disabled={!canStartGame} className="w-full bg-green-500 hover:bg-green-600 text-white transition-transform hover:scale-105 active:scale-95">
            <Play className="mr-2 h-5 w-5" /> 开始游戏
          </Button>
          {!canStartGame && (localPlayersLength < minPlayersToStart || localPlayersLength > maxPlayers) && (
            <p className="text-sm text-destructive text-center">需要 {minPlayersToStart}-{maxPlayers} 名玩家才能开始. 当前 {localPlayersLength} 名.</p>
          )}
          <Button onClick={onAddVirtualPlayer} disabled={!canAddVirtualPlayer} variant="outline" className="w-full transition-transform hover:scale-105 active:scale-95">
            <UserPlus className="mr-2 h-5 w-5" /> 添加虚拟玩家
          </Button>
          {!canAddVirtualPlayer && localPlayersLength >= maxPlayers && (
            <p className="text-sm text-destructive text-center">房间已满.</p>
          )}
        </div>
      )}
      <Button variant="outline" onClick={onReturnToLobby} className="w-full mt-4">
        <LogOut className="mr-2 h-4 w-4" /> 返回大厅
      </Button>
    </>
  );
}
