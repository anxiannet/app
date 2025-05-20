
'use server';
/**
 * @fileOverview AI agent for virtual captain team proposal.
 * This flow is currently NOT USED for complex AI decisions. Virtual captains use simple hardcoded logic.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Role } from '@/lib/types';
// import Handlebars from 'handlebars'; // Not needed if prompt is removed

const PlayerPerspectiveSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.nativeEnum(Role).optional().describe("Role of this player, if known to the virtual player."),
  avatarUrl: z.string().optional(),
});
// type PlayerPerspective = z.infer<typeof PlayerPerspectiveSchema>;


const AiProposeTeamInputSchema = z.object({
  virtualCaptain: z.object({
    id: z.string(),
    name: z.string(),
    role: z.nativeEnum(Role).describe("The role of the virtual captain proposing the team."),
  }),
  gameContext: z.object({
    currentRound: z.number(),
    requiredPlayersForMission: z.number().describe("The exact number of players to select for the mission."),
    currentMissionNeedsTwoFails: z.boolean().describe("Whether the current mission requires two fail cards to be sabotaged."),
    allPlayers: z.array(PlayerPerspectiveSchema)
      .describe("List of all players in the game, with roles revealed according to the virtual captain's perspective."),
    missionHistory: z.array(
      z.object({
        round: z.number(),
        captainId: z.string(),
        teamPlayerIds: z.array(z.string()),
        outcome: z.string(), // 'success' | 'fail'
        failCardsPlayed: z.number().optional(),
        cardPlays: z.array(z.object({ playerId: z.string(), card: z.string() })).optional(),
      })
    ).optional().describe("History of past missions."),
    teamScores: z.object({
      teamMemberWins: z.number(),
      undercoverWins: z.number(),
    }),
    missionPlayerCounts: z.array(z.number()).describe("Players needed for missions in round 1, 2, 3, 4, 5."),
    captainChangesThisRound: z.number(),
    maxCaptainChangesPerRound: z.number(),
    failedMissionCaptainIds: z.array(z.string()).optional().describe("IDs of captains whose missions previously failed."),
  }),
});
export type AiProposeTeamInput = z.infer<typeof AiProposeTeamInputSchema>;

const AiProposeTeamOutputSchema = z.object({
  selectedPlayerIds: z.array(z.string()).describe("An array of player IDs selected for the mission team."),
  reasoning: z.string().optional().describe("A brief explanation in CHINESE (简体中文) of why the AI made this team proposal."),
});
export type AiProposeTeamOutput = z.infer<typeof AiProposeTeamOutputSchema>;

// AI prompt and complex logic removed.
// const promptTemplate = `...`;
// Handlebars helpers (findPlayerNameById, eq, gt, lookup, isPlayerOnTeam, not, and, subtract) are removed as they are not used by simple logic.

// const aiProposeTeamPrompt = ai.definePrompt({ ... }); // Removed

const aiProposeTeamFlow = ai.defineFlow(
  {
    name: 'aiProposeTeamFlow',
    inputSchema: AiProposeTeamInputSchema,
    outputSchema: AiProposeTeamOutputSchema,
  },
  async (input) => {
    // AI logic removed. This flow won't be directly called by the game for decision making.
    // Game will implement simple random selection for virtual captains.
    console.warn("decideAiTeamProposal flow called, but AI logic is disabled. Returning default empty team (game logic should handle this).");
    
    // Fallback logic: select self and then random other players
    const expectedCount = input.gameContext.requiredPlayersForMission;
    let proposedTeamIds = [input.virtualCaptain.id];
    const otherPlayerIds = input.gameContext.allPlayers
        .filter(p => p.id !== input.virtualCaptain.id)
        .map(p => p.id);

    const shuffledOtherPlayers = [...otherPlayerIds].sort(() => 0.5 - Math.random());

    while (proposedTeamIds.length < expectedCount && shuffledOtherPlayers.length > 0) {
        proposedTeamIds.push(shuffledOtherPlayers.shift()!);
    }
    
    // If still not enough (e.g. very few players total), fill with any available, this should be rare.
    const allPlayersShuffledForFallback = [...input.gameContext.allPlayers.map(p => p.id)].sort(() => 0.5 - Math.random());
    while (proposedTeamIds.length < expectedCount && allPlayersShuffledForFallback.length > 0) {
        const playerToAdd = allPlayersShuffledForFallback.shift()!;
        if (!proposedTeamIds.includes(playerToAdd)) {
            proposedTeamIds.push(playerToAdd);
        }
    }
    // Final trim to ensure exact count
    proposedTeamIds = proposedTeamIds.slice(0, expectedCount);

    return {
      selectedPlayerIds: proposedTeamIds, // Default behavior if this flow were called
      reasoning: 'AI决策已禁用，默认随机组队。 (AI decision disabled, default random team proposal.)',
    };
  }
);

// This function might still be called by the game page,
// but its internal AI logic is removed.
export async function decideAiTeamProposal(input: AiProposeTeamInput): Promise<AiProposeTeamOutput> {
    // Simple hardcoded logic instead of calling the flow.
    // Virtual captain selects self, then random others.
    const { virtualCaptain, gameContext } = input;
    const { requiredPlayersForMission, allPlayers } = gameContext;

    let proposedTeamIds = [virtualCaptain.id];
    const otherPlayerIds = allPlayers
        .filter(p => p.id !== virtualCaptain.id)
        .map(p => p.id);

    const shuffledOtherPlayers = [...otherPlayerIds].sort(() => 0.5 - Math.random());

    while (proposedTeamIds.length < requiredPlayersForMission && shuffledOtherPlayers.length > 0) {
        proposedTeamIds.push(shuffledOtherPlayers.shift()!);
    }
    // Ensure uniqueness and correct count (though shuffling and push should handle uniqueness if IDs are unique)
    proposedTeamIds = Array.from(new Set(proposedTeamIds));
    while (proposedTeamIds.length < requiredPlayersForMission && allPlayers.length > proposedTeamIds.length) {
        // If not enough players, pick any remaining unique player
        const availablePlayers = allPlayers.filter(p => !proposedTeamIds.includes(p.id));
        if (availablePlayers.length > 0) {
            proposedTeamIds.push(availablePlayers[Math.floor(Math.random() * availablePlayers.length)].id);
        } else {
            break; // No more unique players to add
        }
    }
    
    // Final trim to ensure exact count
    proposedTeamIds = proposedTeamIds.slice(0, requiredPlayersForMission);
    
    return {
        selectedPlayerIds: proposedTeamIds,
        reasoning: '虚拟队长随机组队 (Virtual captain random team proposal)',
    };
}
