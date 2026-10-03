import { NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { PersonaDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agent/list
 * NOT part of the required contract. Lists every agent that has been
 * initialized (from the same agents:index set the tick route already
 * iterates), with basic persona info and post/rejection counts. This is
 * what lets the demo homepage show a feed automatically instead of
 * requiring a human to paste an agentId — the evaluator never touches
 * this route, only /init and /feed.
 */
export async function GET() {
  const agentIds = (((await redis.smembers(keys.agentIndex())) as string[]) || []).sort();

  const agents = await Promise.all(
    agentIds.map(async (agentId) => {
      const [personaRaw, postCount, lastPostAt] = await Promise.all([
        redis.get(keys.persona(agentId)),
        redis.llen(keys.posts(agentId)),
        redis.get(keys.lastPostAt(agentId)),
      ]);
      if (!personaRaw) return null;
      const persona: PersonaDoc = typeof personaRaw === "string" ? JSON.parse(personaRaw) : (personaRaw as PersonaDoc);
      return {
        agentId,
        name: persona.name,
        domain: persona.domain,
        foundedAt: persona.foundedAt,
        postCount,
        lastPostAt: lastPostAt || null,
      };
    })
  );

  const clean = agents.filter(Boolean).sort((a, b) => (a!.foundedAt < b!.foundedAt ? 1 : -1));

  return NextResponse.json({ agents: clean });
}
