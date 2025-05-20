
'use server';
/**
 * @fileOverview AI agent for virtual player voting decisions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Role, type PlayerPerspective, type Mission } from '@/lib/types';
import Handlebars from 'handlebars';

// Register Handlebars helpers
Handlebars.registerHelper('findPlayerNameById', function (playerId, playersList) {
  if (!Array.isArray(playersList)) {
    console.warn('[Handlebars Helper] findPlayerNameById: playersList is not an array. PlayerId:', playerId);
    return '未知玩家列表';
  }
  const player = playersList.find((p: PlayerPerspective) => p.id === playerId);
  return player ? player.name : `未知玩家(${playerId ? playerId.slice(0,5) : 'N/A'})`;
});
Handlebars.registerHelper('eq', function (a, b) { return a === b; });
Handlebars.registerHelper('gt', function (a, b) { return a > b; });
Handlebars.registerHelper('lookup', function (obj, field) { return obj && obj[field]; });
Handlebars.registerHelper('findIndex', function<T>(array: T[], predicateFn: (item: T, index: number, array: T[]) => boolean) {
  if (!Array.isArray(array)) return -1;
  return array.findIndex(predicateFn);
});
Handlebars.registerHelper('isPlayerOnTeam', function (playerId, teamPlayerIds) {
  if (!Array.isArray(teamPlayerIds)) return false;
  return teamPlayerIds.includes(playerId);
});


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
      z.object({
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
        cardPlays: z.array(z.object({ playerId: z.string(), card: z.string(), role: z.nativeEnum(Role).optional() })).optional(),
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

const promptTemplate = `
You are an AI agent playing the social deduction game '暗线' (Anxian). Your goal is to make the best decision for your faction to win.
You need to decide whether to 'approve' or 'reject' the proposed mission team.

Your Player Details:
- Name: {{virtualPlayer.name}} (ID: {{virtualPlayer.id}})
- Role: {{virtualPlayer.role}}

Game Context:
- Current Round: {{gameContext.currentRound}}
- Captain: {{findPlayerNameById gameContext.captainId gameContext.allPlayers}} (ID: {{gameContext.captainId}})
- Proposed Mission Team:
  {{#each gameContext.proposedTeamIds}}
  - {{findPlayerNameById this ../gameContext.allPlayers}} (ID: {{this}})
  {{/each}}
- All Players (from your perspective):
  {{#each gameContext.allPlayers}}
  - {{this.name}} (ID: {{this.id}}){{#if this.role}}, Role (Known to you): {{this.role}}{{/if}}
  {{/each}}
- Current Team Scores: Team Members {{gameContext.teamScores.teamMemberWins}} - Undercovers {{gameContext.teamScores.undercoverWins}}
- Captain changes this round: {{gameContext.captainChangesThisRound}} (out of max {{gameContext.maxCaptainChangesPerRound}})

Mission History (from your perspective):
{{#each gameContext.missionHistory}}
  Round {{this.round}}:
  - Captain: {{findPlayerNameById this.captainId ../gameContext.allPlayers}}
  - Team: {{#each this.teamPlayerIds}}{{findPlayerNameById this ../../gameContext.allPlayers}}, {{/each}}
  - Outcome: {{this.outcome}}
  {{#if this.failCardsPlayed}}
  - Fail Cards: {{this.failCardsPlayed}}
    {{#each this.cardPlays}}
      {{#if (eq this.card "fail")}}
        {{#if this.role}}
  - Saboteur (Known to you): {{findPlayerNameById this.playerId ../../../gameContext.allPlayers}} (Role: {{this.role}})
        {{else}}
  - Saboteur (Role Unknown to you): {{findPlayerNameById this.playerId ../../../gameContext.allPlayers}}
        {{/if}}
      {{/if}}
    {{/each}}
  {{/if}}
{{else}}
  No mission history yet.
{{/each}}

Strategic Considerations based on your Role:

{{#if (eq virtualPlayer.role "队员")}}
You are a {{virtualPlayer.role}}. Your primary goal is to help the Team Members win by successfully completing missions and identifying Undercover agents.
Strategy:
- If you strongly suspect an Undercover is on the proposed team based on game history or player behavior, vote 'reject'.
- If the team looks trustworthy (e.g., known good players, or players you have no negative information about), vote 'approve'.
- If you are NOT on this proposed team: Be more critical. If you have significant doubts about any member of the proposed team, or if you believe a better team composition is likely with the next captain, you should vote 'reject'. However, if the number of rejections this round ({{gameContext.captainChangesThisRound}}) is high (e.g., 3 or more out of {{gameContext.maxCaptainChangesPerRound}}), you should be more inclined to vote 'approve' to avoid losing the round due to excessive rejections, unless the team is clearly disastrous.
- Consider the current round number and mission player count. Early rounds with fewer players are less risky.
- If a team has failed previously, be more suspicious of players from that failed team.
- If the captaincy has changed many times this round ({{gameContext.captainChangesThisRound}} out of {{gameContext.maxCaptainChangesPerRound}}), the situation is becoming dire. Approving a less-than-ideal team might be necessary to avoid losing by too many rejections, unless you are very confident it's a bad team.
{{/if}}

{{#if (eq virtualPlayer.role "教练")}}
You are the {{virtualPlayer.role}}. You know who the Undercover agents are. Your goal is to ensure missions succeed by having only Team Members on them.
Strategy:
- Identify if any known Undercover agents are on the proposed team.
  Known Undercovers: {{#each gameContext.allPlayers}}{{#if (eq this.role "卧底")}}{{this.name}}, {{/if}}{{/each}}
- If ANY Undercover is on the proposed team, vote 'reject'.
- If the proposed team consists ONLY of Team Members (and potentially yourself, the Coach), vote 'approve'.
- Even if rejections are high ({{gameContext.captainChangesThisRound}} out of {{gameContext.maxCaptainChangesPerRound}}), do NOT approve a team with an Undercover. It's better to risk losing by rejections than to guarantee a mission fail.
{{/if}}

{{#if (eq virtualPlayer.role "卧底")}}
You are an {{virtualPlayer.role}}. Your goal is to sabotage missions or cause enough team rejections to win. You know your fellow Undercover agents.
Strategy:
- Identify if you or any fellow Undercover agents are on the proposed team.
  Your fellow Undercovers: {{#each gameContext.allPlayers}}{{#if (and (eq this.role "卧底") (not (eq this.id ../virtualPlayer.id))) }}{{this.name}}, {{/if}}{{/each}}
- If the proposed team includes at least one Undercover (yourself or an ally): Generally vote 'approve' to get Undercovers on missions.
- If the proposed team consists ONLY of Team Members (and/or the Coach): Generally vote 'reject' to prevent them from succeeding, unless:
  - Rejecting would be too suspicious (e.g., you're the only one rejecting, or it's early game).
  - Rejections this round ({{gameContext.captainChangesThisRound}}) are very high (e.g., one away from {{gameContext.maxCaptainChangesPerRound}}), and your rejection would make Undercovers win. In this specific case, voting 'approve' for a non-Undercover team might be a strategic way to make Team Members lose the round by rejections.
- Try to appear like a Team Member in your voting patterns if it benefits your long-term strategy.
{{/if}}

Output your decision and a brief reasoning. Your response MUST be a JSON object matching this Zod schema:
\`\`\`json
{{{outputSchema}}}
\`\`\`
Example for 'approve': { "vote": "approve", "reasoning": "This team looks trustworthy." }
Example for 'reject': { "vote": "reject", "reasoning": "I suspect Player X is an Undercover." }

Your decision now:
`;

const virtualPlayerVotePrompt = ai.definePrompt({
  name: 'virtualPlayerVotePrompt',
  input: { schema: VirtualPlayerVoteInputSchema },
  output: { schema: VirtualPlayerVoteOutputSchema },
  prompt: (input) => Handlebars.compile(promptTemplate)({ ...input, outputSchema: JSON.stringify(VirtualPlayerVoteOutputSchema.jsonSchema, null, 2) }),
});

const virtualPlayerVoteFlow = ai.defineFlow(
  {
    name: 'virtualPlayerVoteFlow',
    inputSchema: VirtualPlayerVoteInputSchema,
    outputSchema: VirtualPlayerVoteOutputSchema,
  },
  async (input) => {
    const { output, usage } = await virtualPlayerVotePrompt(input);
    if (!output || (output.vote !== 'approve' && output.vote !== 'reject')) {
      console.warn("AI failed to provide a valid vote. Defaulting to 'approve'. AI Output:", JSON.stringify(output), "Input:", JSON.stringify(input));
      return {
        vote: 'approve',
        reasoning: 'AI default due to invalid output.',
      };
    }
    console.log(`AI Vote for ${input.virtualPlayer.name} (${input.virtualPlayer.role}): ${output.vote}. Reason: ${output.reasoning || 'No reasoning provided.'}`);
    return output;
  }
);

export async function decideVirtualPlayerVote(input: VirtualPlayerVoteInput): Promise<VirtualPlayerVoteOutput> {
  return virtualPlayerVoteFlow(input);
}

    