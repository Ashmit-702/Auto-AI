const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/**
 * Calls Gemini's generateContent endpoint with a fixed system instruction
 * (the persona) and a task-specific user prompt, forcing strict JSON output
 * so the caller can parse a reliable structured result instead of scraping
 * prose. Used for both the editorial-judgment call and the writing call.
 */
export async function callGeminiJSON(systemPrompt: string, userPrompt: string): Promise<any> {
  // Trim defensively: a stray trailing newline/space from copy-pasting the
  // key into Vercel's env var UI is the single most common cause of a
  // "valid-looking" key still getting rejected with 400 API_KEY_INVALID.
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it in Vercel -> Project -> Settings -> Environment Variables (Production), then redeploy."
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Google migrated Gemini API keys from "Standard" (AIza...) to "Auth"
      // (AQ.Ab...) keys in mid-2026. Auth keys must be sent via this header
      // — the legacy `?key=` query-param method that Standard keys used is
      // no longer reliable for Auth keys and can return a misleading
      // "API key not valid" 400 even with a genuinely correct key. Sending
      // it via header works for both key types, so this is safe either way.
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // Surface the specific reason up front (before the raw JSON dump) so it
    // shows immediately in the status card instead of requiring the reader
    // to parse Google's nested error object.
    let hint = "";
    if (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(errText)) {
      hint =
        " -- The key itself is being rejected by Google (not a code bug). Regenerate a key at https://aistudio.google.com/apikey, then set GEMINI_API_KEY in Vercel -> Settings -> Environment Variables (Production scope), and redeploy. Check for a trailing space/newline or an extra quote character pasted in by accident.";
    } else if (res.status === 401) {
      hint =
        " -- Google rejected the credential type (e.g. an 'AQ.' Auth key sent somewhere expecting an OAuth token). Regenerate the key in AI Studio and confirm it's being sent to the native generativelanguage.googleapis.com endpoint, not an OpenAI-compatible route.";
    } else if (res.status === 429) {
      hint = " -- Free-tier rate limit hit. This should clear on the next tick.";
    }
    throw new Error(`Gemini API error ${res.status}${hint}: ${errText}`);
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ?? "";

  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Gemini JSON output: ${cleaned.slice(0, 500)}`);
  }
}
