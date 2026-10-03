import { callGeminiJSON } from "./gemini";
import { PersonaDoc, Candidate } from "./types";

export interface WriteResult {
  text: string;
  rationale: string;
}

/**
 * Writing call. Produces the actual post text in the persona's fixed voice,
 * plus an explicit rationale covering why the topic was selected and why
 * it's relevant now — the two required parts of the "Publishing Rationale"
 * requirement (the source itself is attached separately from the candidate,
 * not invented by the model).
 */
export async function writePost(
  persona: PersonaDoc,
  winner: Candidate,
  selectReason: string,
  recentTitles: string[]
): Promise<WriteResult> {
  const userPrompt = `Write your next post about this topic:

TITLE: ${winner.title}
SOURCE: ${winner.source} (${winner.url})
SUMMARY: ${winner.summary.slice(0, 500)}
PUBLISHED: ${winner.publishedAt}

Why you picked it: ${selectReason}

Topics you've already covered recently (do not repeat the same angle or phrasing): ${
    recentTitles.length ? recentTitles.join("; ") : "none yet"
  }

Write a single social post, 120-280 words, in your voice, with a clear technical take — not a summary. Then write a short rationale explaining why you selected this topic and why it's relevant right now.

Respond ONLY with strict JSON, no markdown fences, in exactly this shape:
{"text": "<the post itself>", "rationale": "<why this topic was selected and why it is relevant now, referencing the source in your own words>"}`;

  const result = await callGeminiJSON(persona.systemPrompt, userPrompt);

  return {
    text: typeof result.text === "string" ? result.text : "",
    rationale: typeof result.rationale === "string" ? result.rationale : selectReason,
  };
}
