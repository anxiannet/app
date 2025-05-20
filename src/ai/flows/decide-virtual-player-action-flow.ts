
'use server';
/**
 * @fileOverview An AI agent that decides how a virtual player should vote on a proposed mission team.
 *
 * - decideVirtualPlayerVote - A function that handles the virtual player's voting decision.
 * - VirtualPlayerVoteInput - The input type for the decideVirtualPlayerVote function.
 * - VirtualPlayerVoteOutput - The return type for the decideVirtualPlayerVote function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Role } from '@/lib/types';
import type { GameRoom, Player, PlayerPerspective, Mission } from '@/lib/types';
import Handlebars from 'handlebars';

// Helper to find a player by ID (name for display in prompt)
Handlebars.registerHelper('findPlayerNameById', function (playerId, playersList) {
  if (!Array.isArray(playersList)) {
    console.warn(`findPlayerNameById: playersList is not an array for playerId ${playerId}. playersList:`, playersList);
    return '未知玩家 (列表错误)';
  }
  const player = playersList.find((p: PlayerPerspective) => p.id === playerId);
  return player ? player.name : '未知玩家';
});

Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});

Handlebars.registerHelper('roleName', function (role: Role) {
    return role || "未知角色";
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

const promptTemplate = `
You are '{{virtualPlayer.name}}', a virtual player in the game '暗线'. Your role is '{{virtualPlayer.role}}'.
A team has been proposed for mission {{gameContext.currentRound}}. You need to decide whether to VOTE 'approve' or 'reject' this team.

Current Game State:
- Round: {{gameContext.currentRound}}
- Captain who proposed this team: {{findPlayerNameById gameContext.captainId gameContext.allPlayers}}
- Proposed Team Members (IDs): {{#each gameContext.proposedTeamIds}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  - Names: {{#each gameContext.proposedTeamIds}}{{findPlayerNameById this ../gameContext.allPlayers}} ({{#with (lookup ../gameContext.allPlayers @index)}}{{#if role}}{{roleName role}}{{else}}Role Unknown{{/if}}{{/with}}){{#unless @last}}, {{/unless}}{{/each}}
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

Strategic Considerations:
{{#if (eq virtualPlayer.role "队员")}}
You are a Team Member. Your goal is for Team Members to win 3 missions.
- Try to approve teams you believe are composed of fellow Team Members.
- Reject teams if you suspect an Undercover is on it, especially if multiple Undercovers might be present.
- Consider the mission history. If a previous mission failed, try to identify who might have sabotaged it.
- If this is the 5th team proposal this round (captainChangesThisRound is 4), rejecting it means Undercovers win this round. Vote carefully.
{{/if}}

{{#if (eq virtualPlayer.role "教练")}}
You are the Coach. You know who the Undercovers are. Your goal is for Team Members to win 3 missions.
- Approve teams consisting ONLY of Team Members (including yourself if you are on it).
- Reject teams if ANY Undercover is on it.
- If this is the 5th team proposal this round, rejecting it means Undercovers win this round. You might have to approve a team with one Undercover if it's the only way to avoid an automatic Undercover win, but this is risky. Your primary goal is to ensure no Undercovers go on missions.
{{/if}}

{{#if (eq virtualPlayer.role "卧底")}}
You are an Undercover. Your goal is for Undercovers to cause 3 missions to fail. You know your fellow Undercovers.
- Try to get yourself or a fellow Undercover onto the mission team by voting 'approve'.
- If the proposed team consists only of Team Members (no Undercovers), generally vote 'reject' to force a new team proposal, unless doing so is too suspicious (e.g., multiple rejections already, or it's the 5th proposal).
- If this is the 5th team proposal this round, rejecting it means Undercovers win this round. So, 'reject' is generally a good choice here if the team isn't favorable to Undercovers.
- If you are on the team, you usually want to approve it so you can potentially sabotage the mission.
{{/if}}

Based on your role and the game state, decide your VOTE.
Desired output format is JSON. Ensure your response strictly adheres to this Zod schema:
\`\`\`json
{{{outputSchema}}}
\`\`\`
Provide your response now.
`;

const virtualPlayerVotePrompt = ai.definePrompt({
  name: 'virtualPlayerVotePrompt',
  input: { schema: VirtualPlayerVoteInputSchema },
  output: { schema: VirtualPlayerVoteOutputSchema },
  prompt: (input) => Handlebars.compile(promptTemplate)({
    ...input,
    outputSchema: JSON.stringify(VirtualPlayerVoteOutputSchema.jsonSchema, null, 2)
  }),
});

const virtualPlayerVoteFlow = ai.defineFlow(
  {
    name: 'virtualPlayerVoteFlow',
    inputSchema: VirtualPlayerVoteInputSchema,
    outputSchema: VirtualPlayerVoteOutputSchema,
  },
  async (input) => {
    const { output } = await virtualPlayerVotePrompt(input);
    if (!output || !output.vote) {
      console.warn("AI failed to provide a vote. Defaulting to 'approve'. Input:", JSON.stringify(input), "Output:", JSON.stringify(output));
      return {
        vote: 'approve',
        reasoning: 'AI decision failed, defaulted to approve.',
      };
    }
    return output;
  }
);

export async function decideVirtualPlayerVote(input: VirtualPlayerVoteInput): Promise<VirtualPlayerVoteOutput> {
  return virtualPlayerVoteFlow(input);
}
