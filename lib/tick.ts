import { randomUUID } from "crypto";
import { redis, keys } from "./redis";
import { PersonaDoc, Post } from "./types";
import { discoverCandidates } from "./discover";
import { fingerprint } from "./dedupe";
import { judgeTopics } from "./judge";
import { writePost } from "./writer";

const MIN_POST_GAP_MINUTES = Number(process.env.MIN_POST_GAP_MINUTES) || 90;
const MAX_CANDIDATES_TO_JUDGE = 12;
const RECENT_TITLES_FOR_CONTEXT = 5;

export type TickResult =
  | { status: "locked" }
  | { status: "no-persona" }
  | { status: "no-fresh-candidates" }
  | { status: "nothing-cleared-bar" }
  | { status: "cadence-hold"; topic: string }
  | { status: "published"; post: Post };

/**
 * One full autonomous cycle: discover -> filter against memory -> editorial
 * judgment -> cadence gate -> write -> persist. Called by the tick API route,
 * which is itself driven purely by an external scheduler (cron-job.org /
 * Vercel Cron) — no human ever calls this after POST /api/agent/init.
 */
export async function runTick(agentId: string): Promise<TickResult> {
  // Guard against overlapping cron hits double-processing the same cycle.
  const gotLock = await redis.set(keys.lock(agentId), "1", { nx: true, ex: 50 });
  if (!gotLock) {
    return { status: "locked" };
  }

  try {
    const result = await runTickInner(agentId);
    await redis.set(keys.lastTickAt(agentId), new Date().toISOString());
    await redis.set(keys.lastTickStatus(agentId), JSON.stringify(result));
    await redis.del(keys.lastError(agentId));
    return result;
  } catch (err: any) {
    // Persist the failure so it's visible via GET /api/agent/status instead
    // of only existing in Vercel's function logs — this is what makes a
    // silent "cron says 200 OK but nothing ever publishes" diagnosable
    // without log access (e.g. a bad LLM key: discovery succeeds, so no
    // "no-fresh-candidates" outcome, but the judge call throws before
    // anything gets persisted).
    await redis.set(keys.lastTickAt(agentId), new Date().toISOString());
    await redis.set(
      keys.lastError(agentId),
      JSON.stringify({ message: err?.message || String(err), ts: new Date().toISOString() })
    );
    throw err;
  } finally {
    await redis.del(keys.lock(agentId));
  }
}

async function runTickInner(agentId: string): Promise<TickResult> {
  const personaRaw = await redis.get(keys.persona(agentId));
  if (!personaRaw) return { status: "no-persona" };
  const persona: PersonaDoc = typeof personaRaw === "string" ? JSON.parse(personaRaw) : (personaRaw as PersonaDoc);

  // 1. Discover topics from live sources.
  const candidates = await discoverCandidates(persona.domain);

  // 2. Filter out anything already considered (published OR rejected) before.
  const seen = (await redis.smembers(keys.seenTopics(agentId))) as string[];
  const seenSet = new Set(seen);
  const fresh = candidates.filter((c) => !seenSet.has(fingerprint(c.title)));

  if (fresh.length === 0) {
    return { status: "no-fresh-candidates" };
  }

  const pool = fresh.slice(0, MAX_CANDIDATES_TO_JUDGE);

  // 3. Editorial judgment: pick at most one, log every rejection.
  const judgment = await judgeTopics(persona, pool);

  for (const r of judgment.rejected) {
    const cand = pool[r.index];
    if (!cand) continue;
    await redis.lpush(
      keys.rejections(agentId),
      JSON.stringify({
        topic: cand.title,
        url: cand.url,
        reason: r.reason,
        ts: new Date().toISOString(),
      })
    );
    await redis.sadd(keys.seenTopics(agentId), fingerprint(cand.title));
  }
  await redis.ltrim(keys.rejections(agentId), 0, 199);

  if (judgment.selectedIndex === null || judgment.selectedIndex === undefined) {
    return { status: "nothing-cleared-bar" };
  }

  const winner = pool[judgment.selectedIndex];
  if (!winner) {
    return { status: "nothing-cleared-bar" };
  }

  // Mark the winner as considered regardless of whether it gets published
  // this cycle, so it's never re-judged from scratch later.
  await redis.sadd(keys.seenTopics(agentId), fingerprint(winner.title));

  // 4. Cadence gate: publish at most once per MIN_POST_GAP_MINUTES so the
  // feed reads as paced editorial output, not a firehose.
  const lastPostAtRaw = (await redis.get(keys.lastPostAt(agentId))) as string | null;
  const now = Date.now();
  const cadenceOk = !lastPostAtRaw || now - new Date(lastPostAtRaw).getTime() >= MIN_POST_GAP_MINUTES * 60 * 1000;

  if (!cadenceOk) {
    await redis.lpush(
      keys.rejections(agentId),
      JSON.stringify({
        topic: winner.title,
        url: winner.url,
        reason: "Cleared editorial bar but held back to preserve publishing cadence",
        ts: new Date().toISOString(),
      })
    );
    return { status: "cadence-hold", topic: winner.title };
  }

  // 5. Write the post + rationale in the fixed persona voice.
  const recentTitlesRaw = (await redis.lrange(keys.recentTopicTitles(agentId), 0, RECENT_TITLES_FOR_CONTEXT - 1)) as string[];
  const draft = await writePost(persona, winner, judgment.selectReason, recentTitlesRaw || []);

  if (!draft.text.trim()) {
    return { status: "nothing-cleared-bar" };
  }

  const post: Post = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    text: draft.text.trim(),
    rationale: draft.rationale.trim(),
    sources: [winner.url],
  };

  // 6. Persist: push newest-first, update memory of what's been published.
  await redis.lpush(keys.posts(agentId), JSON.stringify(post));
  await redis.set(keys.lastPostAt(agentId), post.createdAt);
  await redis.lpush(keys.recentTopicTitles(agentId), winner.title);
  await redis.ltrim(keys.recentTopicTitles(agentId), 0, 19);

  return { status: "published", post };
}
