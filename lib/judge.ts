import { callGeminiJSON } from "./gemini";
import { PersonaDoc, Candidate } from "./types";

export interface JudgeResult {
  selectedIndex: number | null;
  selectReason: string;
  rejected: { index: number; reason: string }[];
}

/**
 * Editorial judgment call. Given a batch of fresh candidates, the persona
 * (via its fixed system prompt) picks AT MOST ONE worth publishing — or
 * none — and must give a one-line reason for every candidate it turns down.
 * This is what makes "intentionally rejecting topics" real and auditable
 * rather than just claimed.
 */
export async function judgeTopics(persona: PersonaDoc, candidates: Candidate[]): Promise<JudgeResult> {
  const list = candidates
    .map(
      (c, i) =>
        `[${i}] TITLE: ${c.title}\nSOURCE: ${c.source} (${c.url})\nSUMMARY: ${c.summary.slice(0, 300)}\nPUBLISHED: ${c.publishedAt}`
    )
    .join("\n\n");

  const userPrompt = `Here are today's candidate topics, discovered from live sources:

${list}

Apply your editorial standards. Choose AT MOST ONE topic worth publishing about right now, or none if nothing meets the bar. You reject far more than you accept — that is expected and correct.

Respond ONLY with strict JSON, no markdown fences, in exactly this shape:
{"selectedIndex": <number or null>, "selectReason": "<why this one, and why it matters right now, 1-2 sentences>", "rejected": [{"index": <number>, "reason": "<short, specific, one-line reason>"}]}

Include every candidate you did not select in "rejected" with a genuine, specific reason (e.g. off-domain, too generic, low technical substance, duplicate angle already covered, hype without evidence, unverifiable source).`;

  const result = await callGeminiJSON(persona.systemPrompt, userPrompt);

  return {
    selectedIndex: typeof result.selectedIndex === "number" ? result.selectedIndex : null,
    selectReason: typeof result.selectReason === "string" ? result.selectReason : "",
    rejected: Array.isArray(result.rejected) ? result.rejected : [],
  };
}
