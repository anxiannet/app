export type User = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export enum Role {
  Civilian = "Civilian",
  Undercover = "Undercover",
  Blank = "Blank",
}

export type Player = User & {
  role?: Role;
  isCaptain?: boolean;
};

export type GameRoomStatus = "waiting" | "in-progress" | "finished";

export type GameRoom = {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  status: GameRoomStatus;
  currentCaptainId?: string;
  hostId: string;
};
