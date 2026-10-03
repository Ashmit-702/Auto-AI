import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { redis, keys } from "@/lib/redis";
import { buildPersonaDoc } from "@/lib/persona";
import { runTick } from "@/lib/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/agent/init
 * Called exactly once before evaluation begins. Creates the persona,
 * persists it, and runs the very first tick synchronously so the feed is
 * never empty on the first poll. Every tick after this point is triggered
 * purely by the external scheduler, never by another call to this route.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const name: string = body?.persona?.name?.toString().trim() || "Ada";
    const domain: string = body?.persona?.domain?.toString().trim() || "AI Security";

    const agentId = randomUUID();
    const persona = buildPersonaDoc(name, domain);

    await redis.set(keys.persona(agentId), JSON.stringify(persona));
    await redis.sadd(keys.agentIndex(), agentId);

    try {
      await runTick(agentId);
    } catch (e) {
      // A hiccup on the very first LLM call should never fail init itself —
      // the scheduler will simply pick the agent up on its next pass.
      console.error(`first tick failed for agent ${agentId}`, e);
    }

    return NextResponse.json({ agentId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "init failed" }, { status: 500 });
  }
}
