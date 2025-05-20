
'use server';
/**
 * @fileOverview AI agent for virtual captain team proposal.
 * This flow is currently NOT USED as AI decision-making has been simplified.
 * Keeping the file structure for potential future re-integration.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Role } from '@/lib/types';
// import type { PlayerPerspective, Mission } from '@/lib/types'; PlayerPerspective removed
// import Handlebars from 'handlebars';


// Placeholder Schemas (not actively used by game logic if AI is disabled)
const AiProposeTeamInputSchema = z.object({
  virtualCaptain: z.object({
    id: z.string(),
    name: z.string(),
    role: z.nativeEnum(Role).describe("The role of the virtual captain proposing the team."),
  }),
  gameContext: z.object({
    currentRound: z.number(),
    requiredPlayersForMission: z.number().describe("The exact number of players to select for the mission."),
    allPlayers: z.array(
      z.object({ // Simplified from PlayerPerspective
        id: z.string(),
        name: z.string(),
        role: z.nativeEnum(Role).optional().describe("Role of this player, if known to the virtual captain."),
      })
    ).describe("List of all players in the game, with roles revealed according to the virtual captain's perspective."),
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
  }),
});
export type AiProposeTeamInput = z.infer<typeof AiProposeTeamInputSchema>;

const AiProposeTeamOutputSchema = z.object({
  selectedPlayerIds: z.array(z.string()).describe("An array of player IDs selected for the mission team."),
  reasoning: z.string().optional().describe("A brief explanation of why the AI made this team proposal."),
});
export type AiProposeTeamOutput = z.infer<typeof AiProposeTeamOutputSchema>;


// The actual AI decision logic is removed/commented out from the game.
// This function would not be called if AI decision-making is disabled.
export async function decideAiTeamProposal(input: AiProposeTeamInput): Promise<AiProposeTeamOutput> {
    console.warn(`decideAiTeamProposal called for ${input.virtualCaptain.name}, but AI decision-making is disabled. Defaulting to random selection.`);
    
    const allPlayerIds = input.gameContext.allPlayers.map(p => p.id);
    // Ensure captain is on the team if possible and not already over limit
    let team = [];
    if (input.gameContext.requiredPlayersForMission > 0 && !team.includes(input.virtualCaptain.id)) {
        team.push(input.virtualCaptain.id);
    }

    const otherPlayers = allPlayerIds.filter(id => id !== input.virtualCaptain.id);
    const shuffledOtherPlayers = [...otherPlayers].sort(() => 0.5 - Math.random());

    while (team.length < input.gameContext.requiredPlayersForMission && shuffledOtherPlayers.length > 0) {
        team.push(shuffledOtherPlayers.shift()!);
    }
    
    // If team is still not full (e.g. captain was the only player or very few players)
    // This case should ideally be handled by game rules (min players for mission > 0)
    // For robustness, if team is still too small, fill with any available players (even if it means re-adding captain, though unlikely)
    const allPlayersShuffled = [...allPlayerIds].sort(() => 0.5 - Math.random());
    while (team.length < input.gameContext.requiredPlayersForMission && allPlayersShuffled.length > 0) {
        const playerToAdd = allPlayersShuffled.shift()!;
        if (!team.includes(playerToAdd)) {
            team.push(playerToAdd);
        }
    }
    // Final trim if somehow overfilled, though logic above should prevent this.
    team = team.slice(0, input.gameContext.requiredPlayersForMission);


  return {
    selectedPlayerIds: team,
    reasoning: 'AI decision-making disabled, defaulted to random selection including self.',
  };
}
