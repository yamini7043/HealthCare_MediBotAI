
'use server';
/**
 * @fileOverview Analyzes a medical prescription image to extract medication details, dosage, frequency, duration, overall instructions, and provides a disclaimer.
 *
 * - analyzePrescription - A function that analyzes a prescription image.
 * - AnalyzePrescriptionInput - The input type for the analyzePrescription function.
 * - AnalyzePrescriptionOutput - The return type for the analyzePrescription function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Input Schema
const AnalyzePrescriptionInputSchema = z.object({
  prescriptionImageDataUri: z
    .string()
    .describe(
      "A photo of a medical prescription, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzePrescriptionInput = z.infer<typeof AnalyzePrescriptionInputSchema>;

// Schema for individual medication details
const MedicationSchema = z.object({
    name: z.string().describe('The name of the medication.'),
    dosage: z.string().describe('The dosage of the medication (e.g., "500mg", "1 tablet").'),
    frequency: z.string().optional().describe('How often the medication should be taken (e.g., "twice a day", "before food").'),
    duration: z.string().optional().describe('How long the medication should be taken for (e.g., "10 days", "until finished").'),
    notes: z.string().optional().describe('Any other relevant instructions or notes for this specific medication.'),
});

// Output Schema (not exported directly)
const AnalyzePrescriptionOutputSchema = z.object({
  medications: z.array(MedicationSchema)
      .describe('An array containing details for each identified medication. If the image is unclear or not a prescription, this array should be empty.'),
  overall_instructions: z.string().optional().describe('Any general instructions from the doctor not specific to a single medication.'),
  summary: z.string().describe('A brief confirmation that the prescription was analyzed, or a clear statement if it could not be analyzed (e.g., "Image unclear", "Not a prescription").'),
  disclaimer: z.string().default(
    '**Important Disclaimer:** This analysis is AI-generated and for informational purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. ALWAYS consult with a qualified healthcare provider or pharmacist regarding any medical condition or treatment. Do not disregard professional medical advice or delay in seeking it because of something you have read or interpreted from this AI-generated analysis. Reliance on any information provided by this AI is solely at your own risk.'
  ).describe('Mandatory disclaimer.'),
});
export type AnalyzePrescriptionOutput = z.infer<typeof AnalyzePrescriptionOutputSchema>;

// Exported function
export async function analyzePrescription(input: AnalyzePrescriptionInput): Promise<AnalyzePrescriptionOutput> {
  return analyzePrescriptionFlow(input);
}

// Prompt Definition
const analyzePrescriptionPrompt = ai.definePrompt({
  name: 'analyzePrescriptionPrompt',
  input: {schema: AnalyzePrescriptionInputSchema},
  output: {schema: AnalyzePrescriptionOutputSchema},
  prompt: `You are an AI assistant specialized in analyzing medical prescriptions from images. Your task is to extract medication details accurately.

Analyze the provided prescription image: {{{media url=prescriptionImageDataUri}}}

1.  **Identify Medications:** Carefully identify each distinct medication listed on the prescription.
2.  **Extract Details:** For *each* medication identified, extract the following details:
    *   \`name\`: The name of the drug.
    *   \`dosage\`: The strength or amount per dose (e.g., "500mg", "1 tablet", "10ml").
    *   \`frequency\`: How often to take it (e.g., "Twice daily", "Once at bedtime", "Every 6 hours as needed"). If not specified, omit this field.
    *   \`duration\`: For how long to take it (e.g., "10 days", "Finish the course"). If not specified, omit this field.
    *   \`notes\`: Any other specific instructions for that medication (e.g., "Take with food", "Avoid grapefruit"). If none, omit this field.
3.  **Overall Instructions:** Extract any general instructions that apply to the whole prescription or are not tied to a specific drug (e.g., "Follow up in 2 weeks"). If none, omit this field.
4.  **Summarize:** Provide a brief \`summary\` confirming the analysis (e.g., "Prescription analyzed.") or stating why it failed (e.g., "Analysis failed: Image is unclear.", "Analysis failed: Document does not appear to be a medical prescription.").
5.  **Format Output:** Structure your response strictly as a JSON object matching the defined output schema. The \`medications\` field should be an array of objects, one for each identified medication. If no medications are found or the image is invalid, the \`medications\` array MUST be empty.
6.  **Disclaimer:** Always include the mandatory \`disclaimer\`.

**Output JSON Schema:**
\`\`\`json
{
  "medications": [
    {
      "name": "string",
      "dosage": "string",
      "frequency": "string (optional)",
      "duration": "string (optional)",
      "notes": "string (optional)"
    }
    // ... more medications
  ],
  "overall_instructions": "string (optional)",
  "summary": "string",
  "disclaimer": "string"
}
\`\`\`

Generate the JSON output based on the image analysis.
`,
});

// Flow Definition
const analyzePrescriptionFlow = ai.defineFlow(
  {
    name: 'analyzePrescriptionFlow',
    inputSchema: AnalyzePrescriptionInputSchema,
    outputSchema: AnalyzePrescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await analyzePrescriptionPrompt(input);

    // Default disclaimer text, aligned with the schema default
    const defaultDisclaimerText = '**Important Disclaimer:** This analysis is AI-generated and for informational purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. ALWAYS consult with a qualified healthcare provider or pharmacist regarding any medical condition or treatment. Do not disregard professional medical advice or delay in seeking it because of something you have read or interpreted from this AI-generated analysis. Reliance on any information provided by this AI is solely at your own risk.';

    // Construct the final output, ensuring mandatory fields are present
    const finalOutput: AnalyzePrescriptionOutput = {
      medications: output?.medications ?? [],
      overall_instructions: output?.overall_instructions,
      summary: output?.summary ?? "Could not analyze the prescription. The image might be unclear or not a valid prescription.",
      disclaimer: output?.disclaimer || defaultDisclaimerText, // Ensure disclaimer is always included
    };

    return finalOutput;
  }
);
