import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { PersonaDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agent/status?agentId=...
 * NOT part of the required contract. Surfaces exactly what the last tick
 * did (or why it failed) so you never have to dig through Vercel function
 * logs or guess from a cron provider's "200 OK" — a tick can return 200
 * at the HTTP layer while the pipeline inside it errored (e.g. a bad LLM
 * key), and this is where that shows up.
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId query param is required" }, { status: 400 });
  }

  const personaRaw = await redis.get(keys.persona(agentId));
  if (!personaRaw) {
    return NextResponse.json({ error: "Unknown agentId — no persona found for it" }, { status: 404 });
  }
  const persona: PersonaDoc = typeof personaRaw === "string" ? JSON.parse(personaRaw) : (personaRaw as PersonaDoc);

  const [postCount, rejectionCount, lastTickAt, lastTickStatusRaw, lastErrorRaw, lastPostAt] = await Promise.all([
    redis.llen(keys.posts(agentId)),
    redis.llen(keys.rejections(agentId)),
    redis.get(keys.lastTickAt(agentId)),
    redis.get(keys.lastTickStatus(agentId)),
    redis.get(keys.lastError(agentId)),
    redis.get(keys.lastPostAt(agentId)),
  ]);

  const lastTickStatus = lastTickStatusRaw
    ? typeof lastTickStatusRaw === "string"
      ? JSON.parse(lastTickStatusRaw)
      : lastTickStatusRaw
    : null;
  const lastError = lastErrorRaw ? (typeof lastErrorRaw === "string" ? JSON.parse(lastErrorRaw) : lastErrorRaw) : null;

  return NextResponse.json({
    agentId,
    persona: { name: persona.name, domain: persona.domain, foundedAt: persona.foundedAt },
    postCount,
    rejectionCount,
    lastPostAt: lastPostAt || null,
    lastTickAt: lastTickAt || null,
    lastTickStatus,
    lastError,
    diagnosis: !lastTickAt
      ? "No tick has ever run for this agent yet — check the scheduler is actually hitting /api/agent/tick with the right Authorization header."
      : lastError
      ? "The last tick threw an error before finishing — see lastError.message. A bad or wrong-format LLM API key is the most common cause (discovery succeeds, then the judgment call fails)."
      : lastTickStatus?.status === "no-fresh-candidates"
      ? "The last tick ran fine but found nothing new from Hacker News/arXiv/GitHub — expected occasionally, a problem only if every tick says this."
      : "Last tick completed normally — see lastTickStatus for what it decided.",
  });
}
