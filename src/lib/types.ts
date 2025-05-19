
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
  status: GameRoomStatus;
  currentCaptainId?: string;
  hostId: string;
  // New properties for multi-round gameplay
  currentRound?: number;
  totalRounds?: number;
  captainChangesThisRound?: number;
  maxCaptainChangesPerRound?: number;
  // gameWinner?: Role | null; // Keeping it simple for now, winner determination is complex
};

