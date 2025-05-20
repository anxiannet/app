
'use server';
/**
 * @fileOverview AI agent for virtual captain team proposal.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Role, type PlayerPerspective as PlayerPerspectiveType } from '@/lib/types'; // Renamed import to avoid conflict
import Handlebars from 'handlebars';

// Define PlayerPerspective locally to ensure it's what we expect for the schema
const PlayerPerspectiveSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.nativeEnum(Role).optional().describe("Role of this player, if known to the virtual player."),
  avatarUrl: z.string().optional(),
});
type PlayerPerspective = z.infer<typeof PlayerPerspectiveSchema>;


// Register Handlebars helpers
if (typeof Handlebars.helpers['findPlayerNameById'] === 'undefined') {
  Handlebars.registerHelper('findPlayerNameById', function (playerId, playersList) {
    if (!Array.isArray(playersList)) {
      console.warn('[Handlebars Helper] findPlayerNameById: playersList is not an array. PlayerId:', playerId, 'List:', playersList);
      return `未知玩家(${playerId ? String(playerId).slice(0,5) : 'N/A'})`;
    }
    const player = playersList.find((p: PlayerPerspective) => p.id === playerId);
    return player ? player.name : `未知玩家(${playerId ? String(playerId).slice(0,5) : 'N/A'})`;
  });
}
if (typeof Handlebars.helpers['eq'] === 'undefined') {
  Handlebars.registerHelper('eq', function (a, b) { return a === b; });
}
if (typeof Handlebars.helpers['gt'] === 'undefined') {
  Handlebars.registerHelper('gt', function (a, b) { return a > b; });
}
if (typeof Handlebars.helpers['lookup'] === 'undefined') {
  Handlebars.registerHelper('lookup', function (obj, field) { return obj && obj[field]; });
}
// Removed findIndex helper as it's not used or was problematic
if (typeof Handlebars.helpers['isPlayerOnTeam'] === 'undefined') {
  Handlebars.registerHelper('isPlayerOnTeam', function (playerId, teamPlayerIds) {
    if (!Array.isArray(teamPlayerIds)) return false;
    return teamPlayerIds.includes(playerId);
  });
}


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
  reasoning: z.string().optional().describe("A brief explanation of why the AI made this team proposal."),
});
export type AiProposeTeamOutput = z.infer<typeof AiProposeTeamOutputSchema>;

const promptTemplate = `
You are an AI agent acting as the captain in the social deduction game '暗线' (Anxian). Your goal is to propose a mission team of exactly {{gameContext.requiredPlayersForMission}} players to help your faction win.

Your Captain Details:
- Name: {{virtualCaptain.name}} (ID: {{virtualCaptain.id}})
- Role: {{virtualCaptain.role}}

Game Context:
- Current Round: {{gameContext.currentRound}}
- Players to Select for Mission: {{gameContext.requiredPlayersForMission}}
- Current Mission Sabotage Requirement: {{#if gameContext.currentMissionNeedsTwoFails}}Requires 2 Fail Cards{{else}}Requires 1 Fail Card{{/if}}
- All Players (from your perspective):
  {{#each gameContext.allPlayers}}
  - {{this.name}} (ID: {{this.id}}){{#if this.role}}, Role (Known to you): {{this.role}}{{/if}}
  {{/each}}
- Current Team Scores: Team Members {{gameContext.teamScores.teamMemberWins}} - Undercovers {{gameContext.teamScores.undercoverWins}}
- Captain changes this round: {{gameContext.captainChangesThisRound}} (out of max {{gameContext.maxCaptainChangesPerRound}})

Mission History (from your perspective):
{{#each gameContext.missionHistory}}
  Round {{this.round}}:
  - Captain: {{findPlayerNameById this.captainId @root.gameContext.allPlayers}}
  - Team: {{#each this.teamPlayerIds}}{{findPlayerNameById this @root.gameContext.allPlayers}}, {{/each}}
  - Outcome: {{this.outcome}}
  {{#if this.failCardsPlayed}}
  - Fail Cards: {{this.failCardsPlayed}}
  {{/if}}
{{else}}
  No mission history yet.
{{/each}}

Strategic Considerations for Team Proposal based on your Role:

{{#if (eq virtualCaptain.role "队员")}}
You are a {{virtualCaptain.role}}. Your primary goal is to help the Team Members win.
Strategy:
- Select yourself (ID: {{virtualCaptain.id}}) for the team.
- Select other players you believe are Team Members.
- Avoid players you suspect are Undercover based on past mission failures or voting patterns.
{{#if gameContext.failedMissionCaptainIds.length}}
- Avoid selecting players who were captains of previously FAILED missions. These players might be Undercover or poor leaders.
  Previously failed mission captains to consider avoiding:
  {{#each gameContext.failedMissionCaptainIds}}
  - {{findPlayerNameById this @root.gameContext.allPlayers}} (ID: {{this}})
  {{/each}}
{{/if}}
- Prioritize players who have not been on many failed missions.
- If unsure, try to distribute mission participation.
- Ensure you select exactly {{gameContext.requiredPlayersForMission}} players.
{{/if}}

{{#if (eq virtualCaptain.role "教练")}}
You are the {{virtualCaptain.role}}. You know who the Undercover agents are. Your goal is to ensure missions succeed by forming a team of only Team Members (and possibly yourself).
Known Undercover Agents (from your perspective):
{{#each gameContext.allPlayers}}
  {{#if (eq this.role "卧底")}}
  - {{this.name}} (ID: {{this.id}})
  {{/if}}
{{/each}}
Strategy:
- You MUST NOT select any known Undercover agents for the mission team.
- Select yourself (ID: {{virtualCaptain.id}}) for the team.
- Fill the remaining {{subtract gameContext.requiredPlayersForMission 1}} spots with players you know are *not* Undercover (i.e., Team Members).
- If you do not have enough non-Undercover players (excluding yourself) to fill the team, this is a critical situation for the prompt writer, but you must still select exactly {{gameContext.requiredPlayersForMission}} players *excluding* any known Undercovers. This might mean selecting fewer non-Undercovers than ideal if the player count is very low and Undercover count is high.
- Your primary objective is a mission success; therefore, proposing a team entirely of Team Members (and yourself) is paramount.
- Ensure you select exactly {{gameContext.requiredPlayersForMission}} players.
{{/if}}

{{#if (eq virtualCaptain.role "卧底")}}
You are an {{virtualCaptain.role}}. Your goal is to sabotage missions or make the Team Members lose. You know your fellow Undercover agents.
Your fellow Undercovers (from your perspective):
{{#each gameContext.allPlayers}}
  {{#if (and (eq this.role "卧底") (not (eq this.id ../virtualCaptain.id)))}}
  - {{this.name}} (ID: {{this.id}}),
  {{/if}}
{{/each}}
Strategy:
1.  Always select yourself (ID: {{virtualCaptain.id}}) for the team. This is the most reliable way to ensure an Undercover is on the mission.
2.  {{#if gameContext.currentMissionNeedsTwoFails}}
    This mission requires 2 Fail Cards to be sabotaged. You should try to select one other fellow Undercover (from the list above, if available) for the team. This significantly increases the chances of mission failure. If no other fellow Undercover is available, proceed with just yourself.
    {{else}}
    This mission requires only 1 Fail Card to be sabotaged. Including just yourself is usually sufficient. If you want to spread suspicion or if there are many Team Members and few Undercovers, you might consider adding another Undercover, but it's riskier. For now, prioritize getting yourself on.
    {{/if}}
3.  Fill the remaining spots with players you believe are Team Members or players whose roles are unknown to you to make the team look plausible. Avoid picking too many known/strong Team Members if it makes the team too obviously good.
4.  Ensure you select exactly {{gameContext.requiredPlayersForMission}} players.
{{/if}}

Output your decision as a JSON object containing an array of player IDs and a brief reasoning.
The array \`selectedPlayerIds\` MUST contain exactly {{gameContext.requiredPlayersForMission}} unique player IDs.
Your response MUST be a JSON object matching this Zod schema:
\`\`\`json
{{{outputSchema}}}
\`\`\`
Example: { "selectedPlayerIds": ["player_id_1", "player_id_2"], "reasoning": "Selected myself and a trustworthy player." }

Your team proposal:
`;

// Register the 'subtract' helper
Handlebars.registerHelper('subtract', function(a, b) {
  return a - b;
});

const aiProposeTeamPrompt = ai.definePrompt({
  name: 'aiProposeTeamPrompt',
  input: { schema: AiProposeTeamInputSchema },
  output: { schema: AiProposeTeamOutputSchema },
  prompt: (input) => Handlebars.compile(promptTemplate)({ ...input, outputSchema: JSON.stringify(AiProposeTeamOutputSchema.jsonSchema, null, 2) }),
});

const aiProposeTeamFlow = ai.defineFlow(
  {
    name: 'aiProposeTeamFlow',
    inputSchema: AiProposeTeamInputSchema,
    outputSchema: AiProposeTeamOutputSchema,
  },
  async (input) => {
    const { output, usage } = await aiProposeTeamPrompt(input);
    if (!output || !output.selectedPlayerIds || output.selectedPlayerIds.length !== input.gameContext.requiredPlayersForMission) {
      const expectedCount = input.gameContext.requiredPlayersForMission;
      const actualCount = output?.selectedPlayerIds?.length || 0;
      console.warn(
        `AI Propose Team Flow Warning: AI failed to provide a valid team proposal or correct number of players. Expected ${expectedCount}, got ${actualCount}. Defaulting to a random selection including self. AI Output:`,
        JSON.stringify(output),
        "Input Context (summary):",
        JSON.stringify({
          virtualCaptain: input.virtualCaptain,
          currentRound: input.gameContext.currentRound,
          requiredPlayers: input.gameContext.requiredPlayersForMission,
          needsTwoFails: input.gameContext.currentMissionNeedsTwoFails,
          playerCount: input.gameContext.allPlayers.length,
          missionHistoryCount: input.gameContext.missionHistory?.length || 0,
          failedMissionCaptainIds: input.gameContext.failedMissionCaptainIds,
        })
      );

      // Fallback logic: select self and then random other players
      let proposedTeamIds = [input.virtualCaptain.id];
      const otherPlayerIds = input.gameContext.allPlayers
        .filter(p => p.id !== input.virtualCaptain.id)
        .map(p => p.id);

      const shuffledOtherPlayers = [...otherPlayerIds].sort(() => 0.5 - Math.random());

      while (proposedTeamIds.length < input.gameContext.requiredPlayersForMission && shuffledOtherPlayers.length > 0) {
        proposedTeamIds.push(shuffledOtherPlayers.shift()!);
      }
       // If still not enough (e.g. very few players total), fill with any available, this should be rare.
      const allPlayersShuffledForFallback = [...input.gameContext.allPlayers.map(p => p.id)].sort(() => 0.5 - Math.random());
      while (proposedTeamIds.length < input.gameContext.requiredPlayersForMission && allPlayersShuffledForFallback.length > 0) {
          const playerToAdd = allPlayersShuffledForFallback.shift()!;
          if (!proposedTeamIds.includes(playerToAdd)) {
              proposedTeamIds.push(playerToAdd);
          }
      }
      // Final trim to ensure exact count
      proposedTeamIds = proposedTeamIds.slice(0, input.gameContext.requiredPlayersForMission);


      return {
        selectedPlayerIds: proposedTeamIds,
        reasoning: 'AI default due to invalid output or incorrect player count from LLM. Selected self and random others.',
      };
    }
    return output;
  }
);

export async function decideAiTeamProposal(input: AiProposeTeamInput): Promise<AiProposeTeamOutput> {
  return aiProposeTeamFlow(input);
}
