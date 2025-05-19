
'use server';
/**
 * @fileOverview AI flow for deciding a virtual player's action in the game.
 *
 * - decideVirtualPlayerVote - A function that determines a virtual player's vote on a proposed team.
 * - VirtualPlayerVoteInput - The input type for the decideVirtualPlayerVote function.
 * - VirtualPlayerVoteOutput - The return type for the decideVirtualPlayerVote function.
 */

import {ai} from '@/ai/genkit';
import { Role, type PlayerPerspective, type Mission, type GameRoomPhase } from '@/lib/types';
import {z} from 'genkit';

const VirtualPlayerVoteInputSchema = z.object({
  virtualPlayer: z.object({
    id: z.string(),
    name: z.string(),
    role: z.nativeEnum(Role),
  }),
  gameContext: z.object({
    currentRound: z.number(),
    totalRounds: z.number(),
    captainChangesThisRound: z.number(),
    maxCaptainChangesPerRound: z.number(),
    missionPlayerCounts: z.array(z.number()),
    proposedTeamPlayerIds: z.array(z.string()),
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
    currentCaptainId: z.string(),
    currentPhase: z.string(), // GameRoomPhase
  }),
});
export type VirtualPlayerVoteInput = z.infer<typeof VirtualPlayerVoteInputSchema>;

const VirtualPlayerVoteOutputSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reasoning: z.string().optional().describe("A brief explanation for the decision, for analysis or future use."),
});
export type VirtualPlayerVoteOutput = z.infer<typeof VirtualPlayerVoteOutputSchema>;

export async function decideVirtualPlayerVote(input: VirtualPlayerVoteInput): Promise<VirtualPlayerVoteOutput> {
  return virtualPlayerVoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'virtualPlayerVotePrompt',
  input: {schema: VirtualPlayerVoteInputSchema},
  output: {schema: VirtualPlayerVoteOutputSchema},
  prompt: `You are an AI player in a social deduction game similar to "The Resistance" or "Avalon".
Your current role is: {{virtualPlayer.role}}. Your name is {{virtualPlayer.name}}.
Your primary objective is to help your faction win.
Team Members and Coaches win if 3 missions succeed. Undercovers win if 3 missions fail OR if 5 teams are rejected in a single round.

Current Game State:
- Round: {{gameContext.currentRound}} of {{gameContext.totalRounds}}
- Captain: {{#with (findPlayerById gameContext.allPlayers gameContext.currentCaptainId)}}{{name}}{{else}}Unknown (ID: {{gameContext.currentCaptainId}}){{/with}} (ID: {{gameContext.currentCaptainId}})
- Captaincy changes this round: {{gameContext.captainChangesThisRound}} (Max: {{gameContext.maxCaptainChangesPerRound}})
- Mission Player Counts (for rounds 1-{{gameContext.totalRounds}}): {{#each gameContext.missionPlayerCounts}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- Current Team Scores: Team Members {{gameContext.teamScores.teamMemberWins}}, Undercovers {{gameContext.teamScores.undercoverWins}}

A team has been proposed by the current captain for the mission in round {{gameContext.currentRound}}.
The proposed team members are:
{{#each gameContext.proposedTeamPlayerIds as |playerId|}}
  {{#with (findPlayerById ../gameContext.allPlayers playerId) as |player|}}
- {{player.name}} (ID: {{player.id}})
  {{else}}
- Unknown Player (ID: {{playerId}})
  {{/with}}
{{/each}}

All Players in the game (Your role, {{virtualPlayer.role}}, means you might know others' roles):
{{#each gameContext.allPlayers}}
- {{name}} (ID: {{id}}){{#if role}} (Known Role: {{role}}){{/if}}{{#if isCaptain}} (Captain){{/if}}
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
Based on your role ({{virtualPlayer.role}}) and all the information above, decide whether to VOTE_APPROVE or VOTE_REJECT the_proposed_team.
Output your decision as 'approve' or 'reject'. Provide a brief reasoning.

Strategic Considerations:
1.  **If you are {{Role.TeamMember}}:**
    *   Your goal is to get missions to SUCCEED.
    *   Try to identify Undercovers from voting patterns, mission compositions, and outcomes.
    *   Approve teams you believe are trustworthy and likely to succeed.
    *   Reject teams you suspect include Undercovers, especially if a single fail card can sabotage the mission.
    *   Be mindful: if too many teams are rejected in a round ({{gameContext.maxCaptainChangesPerRound}} times), Undercovers win the game.

2.  **If you are {{Role.Coach}}:**
    *   You know the identities of the Undercovers. (Visible in "All Players" list if provided).
    *   Your goal is to get missions with ONLY Team Members to SUCCEED.
    *   VOTE_APPROVE teams that consist solely of Team Members (and yourself if applicable).
    *   VOTE_REJECT teams that include any Undercover players. Try not to be too obvious if you are the only one rejecting.

3.  **If you are {{Role.Undercover}}:**
    *   You know the identities of your fellow Undercovers. (Visible in "All Players" list if provided).
    *   Your goal is to get missions to FAIL or for 5 teams to be rejected in a round.
    *   Try to get yourself or other Undercovers onto mission teams.
    *   VOTE_APPROVE teams that include at least one Undercover (ideally yourself or a fellow Undercover).
    *   VOTE_REJECT teams composed entirely of Team Members, unless doing so is too suspicious (e.g., it's the 4th rejection attempt and you'd be the deciding vote to make it 5).
    *   If you are on an approved mission team, you will later decide to play a 'success' or 'fail' card.

Consider the number of Undercovers potentially on the proposed team, the current game score, and the risk of the round ending due to rejections.
Make the decision that best serves your faction's victory.
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

const virtualPlayerVoteFlow = ai.defineFlow(
  {
    name: 'virtualPlayerVoteFlow',
    inputSchema: VirtualPlayerVoteInputSchema,
    outputSchema: VirtualPlayerVoteOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    // Ensure there is a default reasonable output if AI fails
    if (!output || !output.decision) {
        console.warn("AI failed to provide a decision. Defaulting to 'approve'. Input:", JSON.stringify(input));
        return { decision: 'approve', reasoning: "AI failed to respond, defaulted to approve." };
    }
    return output;
  }
);

// Register Handlebars helpers if not already registered (idempotent)
if (typeof (globalThis as any).Handlebars !== 'undefined') {
    const Handlebars = (globalThis as any).Handlebars;
    if (!Handlebars.helpers.lookup) {
        Handlebars.registerHelper('lookup', function(obj: any, index: any) {
            return obj && obj[index];
        });
    }
    if (!Handlebars.helpers.eq) {
        Handlebars.registerHelper('eq', function (a: any, b: any) {
            return a === b;
        });
    }
    if (!Handlebars.helpers.findIndex) {
        Handlebars.registerHelper('findIndex', (array: any[], key: string, value: any) => {
            return array.findIndex(item => item[key] === value);
        });
    }
    if (!Handlebars.helpers.findPlayerById) {
        Handlebars.registerHelper('findPlayerById', (players: PlayerPerspective[], playerId: string) => {
            return players.find(p => p.id === playerId);
        });
    }
} else {
    console.warn("Handlebars not available globally for AI prompt templating.");
}

    