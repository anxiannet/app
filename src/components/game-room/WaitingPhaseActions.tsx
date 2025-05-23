
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, UserPlus, LogOut, PlusCircle } from "lucide-react";
import { RoomMode } from "@/lib/types"; // Import RoomMode

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
  roomMode: RoomMode; // New prop
  onManualAddPlayer: (nickname: string) => void; // New prop
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
  roomMode,
  onManualAddPlayer,
}: WaitingPhaseActionsProps) {
  const [newPlayerNickname, setNewPlayerNickname] = useState("");

  const handleAddManualPlayerClick = () => {
    if (newPlayerNickname.trim()) {
      onManualAddPlayer(newPlayerNickname.trim());
      setNewPlayerNickname(""); // Clear input after adding
    }
  };

  const canAddMorePlayers = localPlayersLength < maxPlayers;

  return (
    <>
      <p className="text-muted-foreground text-center">等待主持人开始游戏...</p>
      {isHost && (
        <div className="space-y-3 mt-4">
          <Button onClick={onStartGame} disabled={!canStartGame} className="w-full bg-green-500 hover:bg-green-600 text-white transition-transform hover:scale-105 active:scale-95">
            <Play className="mr-2 h-5 w-5" /> 开始游戏
          </Button>
          {!canStartGame && (localPlayersLength < minPlayersToStart || localPlayersLength > maxPlayers) && (
            <p className="text-sm text-destructive text-center">需要 {minPlayersToStart}-{maxPlayers} 名玩家才能开始. 当前 {localPlayersLength} 名.</p>
          )}

          {roomMode === RoomMode.ManualInput && canAddMorePlayers && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="manual-player-nickname" className="text-sm font-medium">添加真实玩家昵称:</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-player-nickname"
                  type="text"
                  placeholder="输入玩家昵称"
                  value={newPlayerNickname}
                  onChange={(e) => setNewPlayerNickname(e.target.value)}
                  className="flex-grow"
                />
                <Button onClick={handleAddManualPlayerClick} variant="outline" size="icon" title="添加玩家" disabled={!newPlayerNickname.trim()}>
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {roomMode === RoomMode.Online && canAddMorePlayers && (
            <Button onClick={onAddVirtualPlayer} disabled={!canAddVirtualPlayer} variant="outline" className="w-full transition-transform hover:scale-105 active:scale-95">
              <UserPlus className="mr-2 h-5 w-5" /> 添加虚拟玩家
            </Button>
          )}
           {!canAddMorePlayers && (
            <p className="text-sm text-destructive text-center pt-2 border-t">房间已满 ({maxPlayers} / {maxPlayers}).</p>
          )}
        </div>
      )}
      <Button variant="outline" onClick={onReturnToLobby} className="w-full mt-6">
        <LogOut className="mr-2 h-4 w-4" /> {isHost ? "关闭房间" : "离开房间"}
      </Button>
    </>
  );
}
