
'use server';
/**
 * @fileOverview AI agent for virtual player voting decisions.
 * This flow is currently NOT USED for complex AI decisions. Virtual players use simple hardcoded logic.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Role } from '@/lib/types';
// import Handlebars from 'handlebars'; // Not needed if prompt is removed

// PlayerPerspective schema can be removed or simplified if not used by other parts of AI
const PlayerPerspectiveSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.nativeEnum(Role).optional().describe("Role of this player, if known to the virtual player."),
  avatarUrl: z.string().optional(),
});
// type PlayerPerspective = z.infer<typeof PlayerPerspectiveSchema>;


const VirtualPlayerVoteInputSchema = z.object({
  virtualPlayer: z.object({
    id: z.string(),
    name: z.string(),
    role: z.nativeEnum(Role).describe("The role of the virtual player making the decision."),
  }),
  gameContext: z.object({
    currentRound: z.number(),
    captainId: z.string().describe("ID of the current captain who proposed the team."),
    proposedTeamIds: z.array(z.string()).describe("IDs of players on the proposed mission team."),
    allPlayers: z.array(PlayerPerspectiveSchema)
      .describe("List of all players in the game, with roles revealed according to the virtual player's perspective."),
    missionHistory: z.array(
      z.object({
        round: z.number(),
        captainId: z.string(),
        teamPlayerIds: z.array(z.string()),
        outcome: z.string(), // 'success' | 'fail'
        failCardsPlayed: z.number().optional(),
        cardPlays: z.array(z.object({ 
          playerId: z.string(), 
          card: z.string(), 
        })).optional(), 
      })
    ).optional().describe("History of past missions, with roles in cardPlays revealed based on perspective."),
    teamScores: z.object({
        teamMemberWins: z.number(),
        undercoverWins: z.number(),
    }),
    captainChangesThisRound: z.number(),
    maxCaptainChangesPerRound: z.number(),
    maxRejectionsBeforeLoss: z.number().describe("Number of rejections this round that would result in a loss if the current vote is also a rejection."),
  }),
});
export type VirtualPlayerVoteInput = z.infer<typeof VirtualPlayerVoteInputSchema>;

const VirtualPlayerVoteOutputSchema = z.object({
  vote: z.enum(['approve', 'reject']).describe("The AI's decision to approve or reject the team."),
  reasoning: z.string().optional().describe("A brief explanation of why the AI made this decision."),
});
export type VirtualPlayerVoteOutput = z.infer<typeof VirtualPlayerVoteOutputSchema>;

// AI prompt and complex logic removed.
// const promptTemplate = `...`;
// Handlebars helpers (findPlayerNameById, eq, gt, lookup, isPlayerOnTeam, not, and) are removed as they are not used by simple logic.

// const virtualPlayerVotePrompt = ai.definePrompt({ ... }); // Removed

const virtualPlayerVoteFlow = ai.defineFlow(
  {
    name: 'virtualPlayerVoteFlow',
    inputSchema: VirtualPlayerVoteInputSchema,
    outputSchema: VirtualPlayerVoteOutputSchema,
  },
  async (input) => {
    // AI logic removed, defaulting to 'approve' for simplicity
    // or a very basic role-based heuristic could be placed here if needed.
    // For now, this flow won't be directly called by the game for decision making.
    console.warn("decideVirtualPlayerVote flow called, but AI logic is disabled. Defaulting vote.");
    return {
      vote: 'approve', // Default behavior if this flow were called
      reasoning: 'AI决策已禁用，默认投票。 (AI decision disabled, default vote.)',
    };
  }
);

// This function might still be called by the game page,
// but its internal AI logic is removed.
export async function decideVirtualPlayerVote(input: VirtualPlayerVoteInput): Promise<VirtualPlayerVoteOutput> {
  // Simple hardcoded logic instead of calling the flow.
  // For example, always approve or a very basic check.
  // For now, let's assume virtual players just approve.
  return {
    vote: 'approve',
    reasoning: '虚拟玩家默认同意 (Virtual player default approve)',
  };
}
