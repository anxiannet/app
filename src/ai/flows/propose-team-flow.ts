
'use server';
/**
 * @fileOverview AI flow for a virtual captain to propose a mission team.
 *
 * - decideAiTeamProposal - A function that determines the team a virtual captain will propose.
 * - AiProposeTeamInput - The input type for the decideAiTeamProposal function.
 * - AiProposeTeamOutput - The return type for the decideAiTeamProposal function.
 */

import {ai} from '@/ai/genkit';
import { Role, type PlayerPerspective, type Mission } from '@/lib/types';
import {z} from 'genkit';

const AiProposeTeamInputSchema = z.object({
  virtualCaptain: z.object({
    id: z.string(),
    name: z.string(),
    role: z.nativeEnum(Role),
  }),
  gameContext: z.object({
    currentRound: z.number(),
    totalRounds: z.number(),
    requiredPlayersForMission: z.number().describe("The exact number of players that must be selected for the current mission."),
    allPlayers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.nativeEnum(Role).optional(), // Role is conditional based on AI's perspective
        isCaptain: z.boolean().optional(),
      })
    ),
    missionHistory: z.array(
      z.object({
        round: z.number(),
        captainId: z.string(),
        team: z.array(z.object({ id: z.string(), name: z.string(), role: z.nativeEnum(Role).optional()})),
        outcome: z.string(), // 'success' | 'fail' | 'sabotaged'
        failCardsPlayed: z.number().optional(),
      })
    ).optional(),
    teamScores: z.object({
      teamMemberWins: z.number(),
      undercoverWins: z.number(),
    }),
    missionPlayerCounts: z.array(z.number()).describe("Player counts for missions in rounds 1 to totalRounds."),
  }),
});
export type AiProposeTeamInput = z.infer<typeof AiProposeTeamInputSchema>;

const AiProposeTeamOutputSchema = z.object({
  selectedPlayerIds: z.array(z.string()).describe("An array of player IDs for the proposed team. Must contain exactly 'requiredPlayersForMission' players."),
  reasoning: z.string().optional().describe("A brief explanation for the team selection."),
});
export type AiProposeTeamOutput = z.infer<typeof AiProposeTeamOutputSchema>;

export async function decideAiTeamProposal(input: AiProposeTeamInput): Promise<AiProposeTeamOutput> {
  return aiProposeTeamFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiProposeTeamPrompt',
  input: {schema: AiProposeTeamInputSchema},
  output: {schema: AiProposeTeamOutputSchema},
  prompt: `You are an AI player, {{virtualCaptain.name}}, and you are the CAPTAIN for round {{gameContext.currentRound}}.
Your role is: {{virtualCaptain.role}}.
Your primary objective is to help your faction ({{virtualCaptain.role}}) win.
Team Members and Coaches win if 3 missions succeed. Undercovers win if 3 missions fail OR if 5 teams are rejected in a single round.

You MUST select exactly {{gameContext.requiredPlayersForMission}} players for the mission in round {{gameContext.currentRound}}.

Current Game State:
- Round: {{gameContext.currentRound}} of {{gameContext.totalRounds}}
- Mission Player Counts (for rounds 1-{{gameContext.totalRounds}}): {{#each gameContext.missionPlayerCounts}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- Current Team Scores: Team Members {{gameContext.teamScores.teamMemberWins}}, Undercovers {{gameContext.teamScores.undercoverWins}}

All Players in the game (Your role, {{virtualCaptain.role}}, means you might know others' roles):
{{#each gameContext.allPlayers}}
- {{name}} (ID: {{id}}){{#if role}} (Known Role: {{role}}){{/if}}
{{/each}}

Mission History (if any):
{{#if gameContext.missionHistory}}
{{#each gameContext.missionHistory}}
- Round {{round}}: Captain {{#with (findPlayerById ../../gameContext.allPlayers captainId)}}{{name}}{{else}}Unknown (ID: {{captainId}}){{/with}}. Team: {{#each team}}{{#with (findPlayerById ../../../gameContext.allPlayers id)}}{{name}}{{else}}Unknown (ID: {{id}}){{/with}}{{#unless @last}}, {{/unless}}{{/each}}. Outcome: {{outcome}}.
{{/each}}
{{else}}
No missions have occurred yet.
{{/if}}

Your Task:
Select exactly {{gameContext.requiredPlayersForMission}} player IDs for the mission team. Return their IDs in the 'selectedPlayerIds' array.

Strategic Considerations for Team Selection:

1.  **If you are {{Role.TeamMember}}:**
    *   Goal: Get missions to SUCCEED.
    *   Select players you believe are trustworthy Team Members. Include yourself if you think it's a good strategic move.
    *   Analyze mission history. Avoid players who were on failed missions if possible, especially if you suspect them.
    *   If little information is available (early game), you might need to make educated guesses. Consider spreading out selections if unsure.

2.  **If you are {{Role.Coach}}:**
    *   Goal: Get missions with ONLY Team Members to SUCCEED.
    *   You KNOW the identities of the Undercovers (visible in "All Players" list if their roles are revealed to you).
    *   You MUST select a team composed entirely of Team Members (and yourself if applicable). DO NOT select any Undercover players.

3.  **If you are {{Role.Undercover}}:**
    *   Goal: Get missions to FAIL or cause rejections.
    *   You KNOW your fellow Undercovers (visible in "All Players" list if their roles are revealed to you).
    *   Try to get AT LEAST ONE Undercover (yourself or an ally) onto the team.
    *   Balance this by making the team seem plausible to Team Members to increase approval chances.
    *   If you are the only Undercover, try to get yourself on the team.
    *   Consider the number of fail cards needed for the mission if known (not provided in current context, but a general strategy).

Output Format:
Return a JSON object with 'selectedPlayerIds' (an array of strings) and an optional 'reasoning' string.
The 'selectedPlayerIds' array MUST contain exactly {{gameContext.requiredPlayersForMission}} unique player IDs from the 'All Players' list.
Do not select more or fewer players than required.
Prioritize players who are not yourself if you are trying to gather information or if putting yourself on is too risky for your role.
Think step-by-step to construct the team.
Example output if required players is 2: { "selectedPlayerIds": ["player_id_1", "player_id_2"], "reasoning": "Selected based on..." }
`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
       {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  }
});

const aiProposeTeamFlow = ai.defineFlow(
  {
    name: 'aiProposeTeamFlow',
    inputSchema: AiProposeTeamInputSchema,
    outputSchema: AiProposeTeamOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output || !output.selectedPlayerIds || output.selectedPlayerIds.length !== input.gameContext.requiredPlayersForMission) {
      console.warn("AI failed to provide a valid team proposal or correct number of players. Defaulting to a random selection. AI Output:", JSON.stringify(output), "Input:", JSON.stringify(input));
      
      // Fallback: select random players if AI fails
      const availablePlayers = input.gameContext.allPlayers.map(p => p.id);
      const shuffledPlayers = availablePlayers.sort(() => 0.5 - Math.random());
      const fallbackTeam = shuffledPlayers.slice(0, input.gameContext.requiredPlayersForMission);
      
      return {
        selectedPlayerIds: fallbackTeam,
        reasoning: `AI failed to respond or provide a valid team size (${output?.selectedPlayerIds?.length || 'undefined'} instead of ${input.gameContext.requiredPlayersForMission}). Defaulted to random selection.`,
      };
    }
    return output;
  }
);

// Register Handlebars helpers
if (typeof (globalThis as any).Handlebars !== 'undefined') {
    const Handlebars = (globalThis as any).Handlebars;
    if (!Handlebars.helpers.findPlayerById) {
        Handlebars.registerHelper('findPlayerById', (players: PlayerPerspective[], playerId: string) => {
            return players.find(p => p.id === playerId);
        });
    }
    // Ensure Role enum is available for the template
    if (!Handlebars.helpers.Role) {
        Handlebars.registerHelper('Role', () => Role);
    }
} else {
    console.warn("Handlebars not available globally for AI prompt templating in propose-team-flow.");
}

    