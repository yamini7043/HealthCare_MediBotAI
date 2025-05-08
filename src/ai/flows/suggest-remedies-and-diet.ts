'use server';

/**
 * @fileOverview Provides home remedies and diet suggestions based on identified health conditions.
 *
 * - suggestRemediesAndDiet - A function that suggests home remedies and a diet plan based on identified conditions.
 * - SuggestRemediesAndDietInput - The input type for the suggestRemediesAndDiet function.
 * - SuggestRemediesAndDietOutput - The return type for the suggestRemediesAndDiet function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SuggestRemediesAndDietInputSchema = z.object({
  healthCondition: z
    .string()
    .describe('The identified health condition for which remedies and diet are needed.'),
});
export type SuggestRemediesAndDietInput = z.infer<typeof SuggestRemediesAndDietInputSchema>;

const SuggestRemediesAndDietOutputSchema = z.object({
  homeRemedies: z.string().describe('A list of suggested home remedies.'),
  dietSuggestions: z.string().describe('A suggested diet plan.'),
});
export type SuggestRemediesAndDietOutput = z.infer<typeof SuggestRemediesAndDietOutputSchema>;

export async function suggestRemediesAndDiet(input: SuggestRemediesAndDietInput): Promise<SuggestRemediesAndDietOutput> {
  return suggestRemediesAndDietFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRemediesAndDietPrompt',
  input: {
    schema: z.object({
      healthCondition: z
        .string()
        .describe('The identified health condition for which remedies and diet are needed.'),
    }),
  },
  output: {
    schema: z.object({
      homeRemedies: z.string().describe('A list of suggested home remedies.'),
      dietSuggestions: z.string().describe('A suggested diet plan.'),
    }),
  },
  prompt: `You are a healthcare assistant. A user has been identified as suffering from the following condition: {{{healthCondition}}}.\n\nSuggest home remedies and a diet plan to help them manage their condition at home.`,
});

const suggestRemediesAndDietFlow = ai.defineFlow<
  typeof SuggestRemediesAndDietInputSchema,
  typeof SuggestRemediesAndDietOutputSchema
>({
  name: 'suggestRemediesAndDietFlow',
  inputSchema: SuggestRemediesAndDietInputSchema,
  outputSchema: SuggestRemediesAndDietOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});