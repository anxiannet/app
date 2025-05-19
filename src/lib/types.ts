export type User = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export enum Role {
  TeamMember = "队员",
  Undercover = "卧底",
  Coach = "教练",
}

export type Player = User & {
  role?: Role;
  isCaptain?: boolean;
};

// Changed from type alias to enum
export enum GameRoomStatus {
  Waiting = "waiting",
  InProgress = "in-progress",
  Finished = "finished",
}

export type GameRoom = {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  status: GameRoomStatus; // This will now correctly refer to the enum
  currentCaptainId?: string;
  hostId: string;
};
