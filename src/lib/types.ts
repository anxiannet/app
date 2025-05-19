
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

export type MissionCardPlay = {
  playerId: string;
  card: 'success' | 'fail';
};

export type Mission = {
  round: number;
  captainId: string;
  teamPlayerIds: string[];
  outcome: MissionOutcome;
  failCardsPlayed: number;
  cardPlays: MissionCardPlay[];
};

export type GameRoomPhase = 'team_selection' | 'team_voting' | 'mission_execution' | 'mission_reveal' | 'coach_assassination' | 'game_over';

export type PlayerVote = {
  playerId: string;
  vote: 'approve' | 'reject';
};

export type VoteHistoryEntry = {
  round: number;
  captainId: string;
  attemptNumberInRound: number;
  proposedTeamIds: string[];
  votes: PlayerVote[];
  outcome: 'approved' | 'rejected';
};

export type GameRoom = {
  id: string; // Persistent Room ID
  name: string;
  players: Player[];
  maxPlayers: number;
  status: GameRoomStatus;
  currentCaptainId?: string;
  hostId: string;
  currentGameInstanceId?: string; // Unique ID for the current game instance

  currentRound?: number;
  totalRounds?: number;
  captainChangesThisRound?: number;
  maxCaptainChangesPerRound?: number;

  currentPhase?: GameRoomPhase;
  selectedTeamForMission?: string[];
  teamVotes?: PlayerVote[];

  missionCardPlaysForCurrentMission?: MissionCardPlay[];
  missionOutcomeForDisplay?: MissionOutcome;
  failCardsPlayedForDisplay?: number;

  teamScores?: {
    teamMemberWins: number;
    undercoverWins: number;
  };
  missionHistory?: Mission[];
  fullVoteHistory?: VoteHistoryEntry[];

  missionPlayerCounts?: number[];
  coachCandidateId?: string;
};

// For Game History
export type WinningFactionType = Role.TeamMember | Role.Undercover | 'Draw' | null;

export type PlayerGameRecord = {
  gameInstanceId: string; // Unique ID for this specific game session
  roomId: string; // ID of the persistent room where the game was played
  roomName: string;
  playedAt: string; // ISO date string
  myRole: Role;
  gameOutcome: 'win' | 'loss' | 'draw';
  winningFaction: WinningFactionType;
  gameSummaryMessage: string;
  finalScores: { teamMemberWins: number; undercoverWins: number };
  playersInGame: Array<{ id: string; name: string; role: Role }>;
  coachAssassinationAttempt?: {
    targetPlayerId: string;
    targetPlayerName: string;
    wasTargetCoach: boolean;
    assassinationSucceeded: boolean;
  };
  fullVoteHistory?: VoteHistoryEntry[]; // Added this line
};

