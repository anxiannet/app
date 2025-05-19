
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

export type MissionOutcome = 'success' | 'fail' | 'pending' | 'sabotaged';

export type Mission = {
  round: number;
  captainId: string;
  team: Player[]; // Store full player objects or just IDs
  outcome: MissionOutcome;
  failCardsPlayed?: number; // Optional: for missions needing >1 fail card
  // sabotagedBy?: string[]; // Optional: if you want to reveal saboteurs later
};

export type GameRoomPhase = 'team_selection' | 'team_voting' | 'mission_execution' | 'mission_reveal' | 'game_over';

export type GameRoom = {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  status: GameRoomStatus;
  currentCaptainId?: string;
  hostId: string;

  // Multi-round gameplay
  currentRound?: number;
  totalRounds?: number; // Typically 5
  captainChangesThisRound?: number;
  maxCaptainChangesPerRound?: number; // Typically 5

  // Mission and phase tracking
  currentPhase?: GameRoomPhase;
  selectedTeamForMission?: string[]; // Array of player IDs
  // missionVotes?: Array<{playerId: string; vote: 'approve' | 'reject'}>; // For team voting phase
  // playersOnMission?: string[]; // IDs of players actually on the mission
  // missionSuccessCards?: number;
  // missionFailCards?: number;
  
  teamScores?: {
    teamMemberWins: number; // Missions succeeded by team members
    undercoverWins: number; // Missions sabotaged by undercover
  };
  missionHistory?: Mission[];
  
  // Configuration for current game instance (derived from player count)
  missionPlayerCounts?: number[]; // e.g. [2,3,2,3,3] for 5 players
  // missionFailRequirements?: number[]; // e.g. [1,1,1,2,1] for when 2 fail cards are needed
};

