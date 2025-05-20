
'use server';
/**
 * @fileOverview Generates a narrative reason for a mission/match failure.
 *
 * - generateFailureReason - A function that generates failure reasons.
 * - GenerateFailureReasonInput - The input type.
 * - GenerateFailureReasonOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Handlebars from 'handlebars';

const FAILURE_REASONS_LIST = [
  "阵容不合理", // Team Composition Issues
  "节奏不同步", // Synchronization/Pacing Issues
  "资源利用差", // Poor Resource Management
  "频繁送头",   // Frequent Feeding/Deaths
  "技能释放错误", // Skill Misuse
  "经济差距",   // Economic Disparity
  "盲目开团 / 不开团", // Poor Initiation/Hesitation
  "视野不足",   // Lack of Vision
  "判断失误",   // Misjudgment
  "挂机、演员、互喷", // AFK, Trolling, Toxic Behavior
  "指责队友导致配合断裂", // Blaming Teammates, Breakdown in Cooperation
  "网络卡顿 / 延迟高", // Network Lag/High Ping
  "掉线、闪退",       // Disconnections/Crashes
  "匹配机制不平衡"  // Unbalanced Matchmaking (less applicable here, but for completeness)
];

const GenerateFailureReasonInputSchema = z.object({
  failCardCount: z.number().min(1).describe("The number of 'sabotage actions' or critical mistakes that led to the failure. This will determine how many reasons are selected."),
  // Optional context, might be useful later
  // playerCount: z.number().optional().describe("Total players in the game."),
  // roundNumber: z.number().optional().describe("Current round number."),
  // missionTeamSize: z.number().optional().describe("Size of the team that went on the mission."),
});
export type GenerateFailureReasonInput = z.infer<typeof GenerateFailureReasonInputSchema>;

const GenerateFailureReasonOutputSchema = z.object({
  selectedReasons: z.array(z.string()).describe("An array of distinct reasons selected from the provided list, corresponding to the failCardCount."),
  narrativeSummary: z.string().describe("A concise summary explaining the failure, incorporating the selected reasons."),
});
export type GenerateFailureReasonOutput = z.infer<typeof GenerateFailureReasonOutputSchema>;

// Helper registration (if not already global or in a shared utility)
if (typeof Handlebars.helpers['eq'] === 'undefined') {
    Handlebars.registerHelper('eq', function (a, b) {
        return a === b;
    });
}
if (typeof Handlebars.helpers['gt'] === 'undefined') {
    Handlebars.registerHelper('gt', function (a, b) {
        return a > b;
    });
}

const promptTemplate = `You are a game analyst for the social deduction game '暗线'. A mission (match) has just failed.
The number of critical mistakes or sabotage actions that occurred, indicated by 'failCardCount', is {{failCardCount}}.

Your task is to:
1. Select exactly {{failCardCount}} distinct reasons from the list of 'Potential Failure Reasons' below that best explain why the mission failed.
   If {{failCardCount}} is greater than the number of unique reasons available in the list, select as many unique reasons as possible.
2. Generate a concise narrative summary that incorporates these selected reasons to explain the failure. The summary should sound like a plausible in-game explanation.

Potential Failure Reasons:
{{#each failureReasons}}
- {{{this}}}
{{/each}}

Desired output format is JSON. Ensure your response strictly adheres to this Zod schema:
\`\`\`json
{{{outputSchema}}}
\`\`\`

Example (if failCardCount is 1):
{
  "selectedReasons": ["频繁送头"],
  "narrativeSummary": "本次比赛失利，主要原因是队伍中出现了频繁送头的情况，导致局势无法挽回。"
}

Example (if failCardCount is 2):
{
  "selectedReasons": ["阵容不合理", "视野不足"],
  "narrativeSummary": "本次比赛的失利，一方面是由于阵容不合理，另一方面也暴露了团队在视野控制上的不足。"
}

Provide your response now for failCardCount = {{failCardCount}}.
`;


const generateFailureReasonPrompt = ai.definePrompt({
  name: 'generateFailureReasonPrompt',
  input: { schema: GenerateFailureReasonInputSchema },
  output: { schema: GenerateFailureReasonOutputSchema },
  prompt: (input) => Handlebars.compile(promptTemplate)({
    ...input,
    failureReasons: FAILURE_REASONS_LIST,
    outputSchema: JSON.stringify(GenerateFailureReasonOutputSchema.jsonSchema, null, 2)
  }),
});

const generateFailureReasonFlowInternal = ai.defineFlow(
  {
    name: 'generateFailureReasonFlowInternal',
    inputSchema: GenerateFailureReasonInputSchema,
    outputSchema: GenerateFailureReasonOutputSchema,
  },
  async (input) => {
    const { output, usage } = await generateFailureReasonPrompt(input);
    if (!output || !output.selectedReasons || output.selectedReasons.length === 0) {
      console.warn("AI failed to generate failure reasons. Defaulting. Input:", input, "Output:", output);
      const defaultReasonsCount = Math.min(input.failCardCount, 3); // Max 3 default reasons
      const defaultReasons = FAILURE_REASONS_LIST.slice(0, defaultReasonsCount);
      return {
        selectedReasons: defaultReasons,
        narrativeSummary: `比赛失利，可能原因是：${defaultReasons.join("，")}。`,
      };
    }
    // Ensure the number of reasons matches failCardCount, or is max possible if failCardCount is too high
    const reasonsToReturnCount = Math.min(input.failCardCount, FAILURE_REASONS_LIST.length);
    if (output.selectedReasons.length !== reasonsToReturnCount && output.selectedReasons.length < reasonsToReturnCount) {
        // If AI returned too few, pad with generic ones if necessary, though prompt asks for exact.
        // For now, we'll trust the AI tried its best, or it used the default.
        console.warn(`AI returned ${output.selectedReasons.length} reasons, expected ${reasonsToReturnCount}. Using what was returned or a refined default.`);
    }

    // Construct a narrative summary if the AI's one is poor or missing
    let summary = output.narrativeSummary;
    if (!summary || summary.length < 10) { // Arbitrary length check for a decent summary
        summary = `本次比赛失利，主要归咎于以下几点：${output.selectedReasons.join("，")}。`;
    }


    return {
        selectedReasons: output.selectedReasons.slice(0, reasonsToReturnCount), // Ensure correct number
        narrativeSummary: summary
    };
  }
);

export async function generateFailureReason(input: GenerateFailureReasonInput): Promise<GenerateFailureReasonOutput> {
  return generateFailureReasonFlowInternal(input);
}
