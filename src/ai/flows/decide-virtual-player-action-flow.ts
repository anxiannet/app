
'use server';
/**
 * @fileOverview AI agent for virtual player voting decisions.
 * This flow is currently NOT USED as AI decision-making has been simplified.
 * Keeping the file structure for potential future re-integration.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Role } from '@/lib/types';
// import type { GameRoom, Player, PlayerPerspective, Mission } from '@/lib/types'; // PlayerPerspective removed
// import Handlebars from 'handlebars';


// Placeholder Schemas (not actively used by game logic if AI is disabled)
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
    allPlayers: z.array(
        z.object({ // Simplified from PlayerPerspective
            id: z.string(),
            name: z.string(),
            role: z.nativeEnum(Role).optional().describe("Role of this player, if known to the virtual player."),
        })
    ).describe("List of all players in the game, with roles revealed according to the virtual player's perspective."),
    missionHistory: z.array(
      z.object({
        round: z.number(),
        captainId: z.string(),
        teamPlayerIds: z.array(z.string()),
        outcome: z.string(), // 'success' | 'fail'
        failCardsPlayed: z.number().optional(),
        cardPlays: z.array(z.object({ playerId: z.string(), card: z.string() })).optional(),
      })
    ).optional().describe("History of past missions, with roles in cardPlays revealed based on perspective."),
    teamScores: z.object({
        teamMemberWins: z.number(),
        undercoverWins: z.number(),
    }),
    captainChangesThisRound: z.number(),
    maxCaptainChangesPerRound: z.number(),
  }),
});
export type VirtualPlayerVoteInput = z.infer<typeof VirtualPlayerVoteInputSchema>;

const VirtualPlayerVoteOutputSchema = z.object({
  vote: z.enum(['approve', 'reject']).describe("The AI's decision to approve or reject the team."),
  reasoning: z.string().optional().describe("A brief explanation of why the AI made this decision."),
});
export type VirtualPlayerVoteOutput = z.infer<typeof VirtualPlayerVoteOutputSchema>;


// The actual AI decision logic is removed/commented out from the game.
// This function would not be called if AI decision-making is disabled.
export async function decideVirtualPlayerVote(input: VirtualPlayerVoteInput): Promise<VirtualPlayerVoteOutput> {
  console.warn("decideVirtualPlayerVote called, but AI decision-making is disabled. Defaulting to 'approve'.");
  return {
    vote: 'approve',
    reasoning: 'AI decision-making disabled, defaulted to approve.',
  };
}
