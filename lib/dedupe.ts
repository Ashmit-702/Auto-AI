import crypto from "crypto";

/**
 * Normalizes a topic title into a stable fingerprint so the agent can
 * remember "have I already considered this?" across ticks, regardless of
 * minor wording differences between how two sources phrase the same story.
 */
export function fingerprint(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}
