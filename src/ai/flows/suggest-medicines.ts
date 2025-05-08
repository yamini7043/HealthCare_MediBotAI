'use server';
/**
 * @fileOverview Suggests potential over-the-counter (OTC) medicines for a given health condition.
 * Includes a mandatory disclaimer about consulting healthcare professionals.
 *
 * - suggestMedicines - A function that suggests OTC medicines based on a health condition.
 * - SuggestMedicinesInput - The input type for the suggestMedicines function.
 * - SuggestMedicinesOutput - The return type for the suggestMedicines function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SuggestMedicinesInputSchema = z.object({
  healthCondition: z
    .string()
    .describe('The identified health condition for which medicine suggestions are needed.'),
});
export type SuggestMedicinesInput = z.infer<typeof SuggestMedicinesInputSchema>;

const SuggestMedicinesOutputSchema = z.object({
  suggestedMedicines: z
    .string()
    .describe('A list of suggested over-the-counter medicines.'),
  disclaimer: z
    .string()
    .describe(
      'A mandatory disclaimer stating this is not medical advice.'
    ),
});
export type SuggestMedicinesOutput = z.infer<typeof SuggestMedicinesOutputSchema>;

export async function suggestMedicines(input: SuggestMedicinesInput): Promise<SuggestMedicinesOutput> {
  return suggestMedicinesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMedicinesPrompt',
  input: {
    schema: z.object({
      healthCondition: z
        .string()
        .describe('The identified health condition.'),
    }),
  },
  output: {
    schema: z.object({
        suggestedMedicines: z
            .string()
            .describe('A list of suggested over-the-counter (OTC) medicines appropriate for the condition. Focus on common, widely available OTC options. If no specific OTC medicines are suitable or if the condition likely requires prescription medication, state that clearly instead of suggesting inappropriate OTCs.'),
        disclaimer: z
            .string()
            .default('**Disclaimer:** This information is AI-generated and not a substitute for professional medical advice. Always consult a doctor or pharmacist before taking any medication. Self-treating can be dangerous.')
            .describe('A mandatory disclaimer about consulting healthcare professionals.')
    }),
  },
  prompt: `You are a helpful assistant providing information about potential over-the-counter (OTC) medicines.

  A user has described symptoms potentially related to: {{{healthCondition}}}.

  Suggest common, widely available OTC medicines that *might* help alleviate symptoms associated with this condition.

  **IMPORTANT RULES:**
  1.  **Only suggest OTC medicines.** Do not suggest prescription drugs.
  2.  If the condition likely requires a doctor's visit or prescription medication (e.g., infections, severe pain, chronic conditions), explicitly state that and do not suggest OTCs as primary treatment.
  3.  Prioritize safety. If suggesting anything, mention general types or active ingredients (e.g., "pain relievers containing ibuprofen", "antihistamines like loratadine", "cough drops") rather than specific brand names if possible, unless a brand is extremely common and representative of a category (e.g., Tylenol for acetaminophen).
  4.  Always include the mandatory disclaimer about consulting a healthcare professional.

  Generate the response following the output schema.
  Suggested Medicines:
  Disclaimer:`,
});

const suggestMedicinesFlow = ai.defineFlow<
  typeof SuggestMedicinesInputSchema,
  typeof SuggestMedicinesOutputSchema
>({
  name: 'suggestMedicinesFlow',
  inputSchema: SuggestMedicinesInputSchema,
  outputSchema: SuggestMedicinesOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  // Ensure the disclaimer is always included, even if the model fails to generate it.
  const finalOutput = output ?? { suggestedMedicines: "Could not generate suggestions.", disclaimer: "" };
  if (!finalOutput.disclaimer) {
      finalOutput.disclaimer = '**Disclaimer:** This information is AI-generated and not a substitute for professional medical advice. Always consult a doctor or pharmacist before taking any medication. Self-treating can be dangerous.';
  }
  return finalOutput;
});
