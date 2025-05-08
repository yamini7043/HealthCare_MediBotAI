'use server';
/**
 * @fileOverview This file defines a Genkit flow for identifying potential health conditions based on user-provided keywords (symptoms) and optional profile context.
 *
 * - identifySymptoms - A function that takes symptom keywords and optional profile context as input and returns a list of potential health conditions.
 * - IdentifySymptomsInput - The input type for the identifySymptoms function, which is a string of keywords possibly including profile context.
 * - IdentifySymptomsOutput - The return type for the identifySymptoms function, which is a string of potential health conditions.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const IdentifySymptomsInputSchema = z.object({
  keywords: z
    .string()
    .describe('Keywords describing the symptoms experienced by the user, potentially including profile context (age, gender, pre-existing conditions).'),
});
export type IdentifySymptomsInput = z.infer<typeof IdentifySymptomsInputSchema>;

const IdentifySymptomsOutputSchema = z.object({
  conditions: z
    .string()
    .describe('A list of potential health conditions matching the symptoms and profile context (if provided). List 2-3 most likely conditions.'),
});
export type IdentifySymptomsOutput = z.infer<typeof IdentifySymptomsOutputSchema>;

export async function identifySymptoms(input: IdentifySymptomsInput): Promise<IdentifySymptomsOutput> {
  return identifySymptomsFlow(input);
}

// Updated prompt to handle profile context
const identifySymptomsPrompt = ai.definePrompt({
  name: 'identifySymptomsPrompt',
  input: {
    schema: z.object({
      keywords: z
        .string()
        .describe('Keywords describing the symptoms experienced by the user, potentially including profile context (age, gender, pre-existing conditions).'),
    }),
  },
  output: {
    schema: z.object({
      conditions: z
        .string()
        .describe('A list of 2-3 potential health conditions matching the symptoms and profile context (if provided). Be concise.'),
    }),
  },
  // Updated prompt instructions to consider profile context if available
  prompt: `You are a medical chatbot designed to identify potential health conditions based on symptoms and basic user profile information if provided.

  Based on the following information, identify 2-3 potential health conditions. Consider the user's age, gender, and pre-existing conditions if mentioned in the input, as these can influence likelihood.

  Input: {{{keywords}}}

  List the potential conditions concisely.

  Conditions:`,
});


const identifySymptomsFlow = ai.defineFlow<
  typeof IdentifySymptomsInputSchema,
  typeof IdentifySymptomsOutputSchema
>({
  name: 'identifySymptomsFlow',
  inputSchema: IdentifySymptomsInputSchema,
  outputSchema: IdentifySymptomsOutputSchema,
},
async input => {
    const {output} = await identifySymptomsPrompt(input);
    return output!;
  }
);
