
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
  teamPlayerIds: string[];
  outcome: MissionOutcome;
  failCardsPlayed: number;
};

export type GameRoomPhase = 'team_selection' | 'team_voting' | 'mission_execution' | 'mission_reveal' | 'coach_assassination' | 'game_over';

export type PlayerVote = {
  playerId: string;
  vote: 'approve' | 'reject';
};

export type MissionCardPlay = {
  playerId: string;
  card: 'success' | 'fail';
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
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  status: GameRoomStatus;
  currentCaptainId?: string;
  hostId: string;

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
  fullVoteHistory?: VoteHistoryEntry[]; // Added for detailed vote logging

  missionPlayerCounts?: number[];
  coachCandidateId?: string;
};
