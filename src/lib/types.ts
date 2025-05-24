
export type User = {
  id: string; // For mock login, this will be the nickname
  name: string; // Nickname
  avatarUrl?: string;
  isAdmin?: boolean;
};

export enum Role {
  TeamMember = "队员",
  Undercover = "卧底",
  Coach = "教练",
}

export type Player = User & {
  role?: Role;
};

export enum GameRoomStatus {
  Waiting = "waiting",
  InProgress = "in-progress",
  Finished = "finished",
}

export enum RoomMode {
  Online = "online",
  ManualInput = "manual_input",
  OfflineKeyword = "offline_keyword", // New mode
}

export type MissionOutcome = 'success' | 'fail' | 'pending' | 'sabotaged';

export type MissionCardPlay = {
  playerId: string;
  card: 'success' | 'fail';
};

export type GeneratedFailureReason = {
  selectedReasons: string[];
  narrativeSummary: string;
};

export type Mission = {
  round: number;
  captainId: string;
  teamPlayerIds: string[];
  outcome: MissionOutcome;
  failCardsPlayed: number;
  cardPlays: MissionCardPlay[];
  generatedFailureReason?: GeneratedFailureReason;
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

// For OfflineKeyword mode
export type KeywordThemeName = string;
export type OfflineKeywordPlayerSetup = Player & {
  keywordTheme: KeywordThemeName;
  successKeywords: string[];
  failKeywords: string[];
};

export type GameRoom = {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  status: GameRoomStatus;
  hostId: string;
  createdAt: string;
  mode: RoomMode;

  currentGameInstanceId?: string;
  currentCaptainId?: string;
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
  generatedFailureReason?: GeneratedFailureReason;

  teamScores?: {
    teamMemberWins: number;
    undercoverWins: number;
  };
  missionHistory?: Mission[];
  fullVoteHistory?: VoteHistoryEntry[];

  missionPlayerCounts?: number[];
  coachCandidateId?: string;

  // For OfflineKeyword mode, stores the generated setup for display
  offlinePlayerSetups?: OfflineKeywordPlayerSetup[];
};

export type WinningFactionType = Role.TeamMember | Role.Undercover | 'Draw' | null;

export type PlayerGameRecord = {
  gameInstanceId: string;
  roomId: string;
  roomName: string;
  playedAt: string;
  myRole: Role;
  gameOutcome: 'win' | 'loss' | 'draw';
  winningFaction: WinningFactionType;
  gameSummaryMessage: string;
  finalScores: { teamMemberWins: number; undercoverWins: number };
  playersInGame: Array<{ id: string; name: string; role: Role; avatarUrl?: string; }>;
  coachAssassinationAttempt?: {
    targetPlayerId: string;
    targetPlayerName: string;
    wasTargetCoach: boolean;
    assassinationSucceeded: boolean;
  };
  fullVoteHistory?: VoteHistoryEntry[];
  missionHistory?: Mission[];
};
