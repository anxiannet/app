
'use server';
/**
 * @fileOverview An AI agent that decides which players a virtual captain should propose for a mission team.
 *
 * - decideAiTeamProposal - A function that handles the AI captain's team proposal.
 * - AiProposeTeamInput - The input type for the decideAiTeamProposal function.
 * - AiProposeTeamOutput - The return type for the decideAiTeamProposal function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { PlayerPerspective, Role, Mission } from '@/lib/types';
import Handlebars from 'handlebars';

// Helper to find a player by ID (name for display in prompt)
Handlebars.registerHelper('findPlayerNameById', function (playerId, playersList) {
  const player = playersList.find((p: PlayerPerspective) => p.id === playerId);
  return player ? player.name : '未知玩家';
});

Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});

Handlebars.registerHelper('roleName', function (role: Role) {
    return role || "未知角色";
});


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
      z.object({
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

const promptTemplate = `
You are '{{virtualCaptain.name}}', a virtual player and the current CAPTAIN in the game '暗线'. Your role is '{{virtualCaptain.role}}'.
It's round {{gameContext.currentRound}}, and you must propose a team of exactly {{gameContext.requiredPlayersForMission}} players for the upcoming mission.

Current Game State:
- Your Role: {{virtualCaptain.role}}
- Round: {{gameContext.currentRound}}
- Players needed for this mission: {{gameContext.requiredPlayersForMission}}
- Team Scores: Team Members {{gameContext.teamScores.teamMemberWins}} - Undercovers {{gameContext.teamScores.undercoverWins}}
- Captain changes this round: {{gameContext.captainChangesThisRound}} out of {{gameContext.maxCaptainChangesPerRound}}

All Players in Game (from your perspective):
{{#each gameContext.allPlayers}}
- {{name}} (ID: {{id}}){{#if role}} - Role: {{roleName role}}{{else}} - Role: Unknown to you{{/if}}
{{/each}}

Mission History (if any):
{{#each gameContext.missionHistory}}
- Round {{round}}: Captain {{findPlayerNameById captainId ../gameContext.allPlayers}} proposed {{#each teamPlayerIds}}{{findPlayerNameById this ../../gameContext.allPlayers}}{{#unless @last}}, {{/unless}}{{/each}}. Outcome: {{outcome}}. Fail cards: {{failCardsPlayed}}.
  {{#if cardPlays}}
    Plays: {{#each cardPlays}}{{findPlayerNameById playerId ../../../gameContext.allPlayers}} played {{card}}. {{/each}}
  {{/if}}
{{else}}
- No mission history yet.
{{/each}}

Strategic Considerations for Team Proposal:
{{#if (eq virtualCaptain.role "队员")}}
You are a Team Member. Your goal is to get trustworthy players on the mission to ensure its success.
- Always include yourself on the team if possible.
- Try to select players you believe are also Team Members.
- Avoid players you suspect might be Undercovers based on past mission outcomes or voting patterns (if any).
- Be mindful of mission history. If a mission failed, players on that team are suspect.
{{/if}}

{{#if (eq virtualCaptain.role "教练")}}
You are the Coach. You know who the Undercovers are. Your primary goal is to propose a team of ONLY Team Members (and yourself).
- Always include yourself on the team.
- Select other players who are Team Members.
- ABSOLUTELY AVOID selecting any known Undercovers.
{{/if}}

{{#if (eq virtualCaptain.role "卧底")}}
You are an Undercover. Your goal is to get Undercovers onto missions so they can fail. You know your fellow Undercovers.
- Try to include yourself on the team.
- Try to include at least one other Undercover if possible, but balance this with making the team look plausible to Team Members. A team of all Undercovers is too obvious.
- You might include some Team Members to make the team less suspicious.
- If you are the only Undercover, include yourself.
{{/if}}

Propose a team by providing an array of player IDs. The array must contain exactly {{gameContext.requiredPlayersForMission}} unique player IDs from the 'All Players in Game' list.

Desired output format is JSON. Ensure your response strictly adheres to this Zod schema:
\`\`\`json
{{{outputSchema}}}
\`\`\`
Provide your response now.
`;

const aiProposeTeamPrompt = ai.definePrompt({
  name: 'aiProposeTeamPrompt',
  input: { schema: AiProposeTeamInputSchema },
  output: { schema: AiProposeTeamOutputSchema },
  prompt: (input) => Handlebars.compile(promptTemplate)({
    ...input,
    outputSchema: JSON.stringify(AiProposeTeamOutputSchema.jsonSchema, null, 2)
  }),
});

const aiProposeTeamFlow = ai.defineFlow(
  {
    name: 'aiProposeTeamFlow',
    inputSchema: AiProposeTeamInputSchema,
    outputSchema: AiProposeTeamOutputSchema,
  },
  async (input) => {
    const { output } = await aiProposeTeamPrompt(input);
    if (!output || !output.selectedPlayerIds || output.selectedPlayerIds.length !== input.gameContext.requiredPlayersForMission) {
      console.warn("AI failed to provide a valid team proposal or correct number of players. Defaulting to a random selection. AI Output:", JSON.stringify(output), "Input:", JSON.stringify(input));
      
      // Fallback: select random players
      const allPlayerIds = input.gameContext.allPlayers.map(p => p.id);
      const shuffledPlayers = [...allPlayerIds].sort(() => 0.5 - Math.random());
      const fallbackTeam = shuffledPlayers.slice(0, input.gameContext.requiredPlayersForMission);
      
      return {
        selectedPlayerIds: fallbackTeam,
        reasoning: 'AI decision failed or was invalid, defaulted to random team proposal.',
      };
    }
    return output;
  }
);

export async function decideAiTeamProposal(input: AiProposeTeamInput): Promise<AiProposeTeamOutput> {
  return aiProposeTeamFlow(input);
}
