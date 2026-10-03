import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { runTick } from "@/lib/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST/GET /api/agent/tick
 * NOT part of the evaluator's contract — this is the internal heartbeat
 * that an external scheduler (cron-job.org every 15-30 min, plus Vercel's
 * daily cron as a failsafe) hits to give the agent a chance to run its
 * loop. Protected by a shared secret so only the scheduler can trigger it.
 * The evaluator never needs to know this route exists.
 */
async function handleTick(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.TICK_SECRET || ""}`;
  if (!process.env.TICK_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const agentIdParam = req.nextUrl.searchParams.get("agentId");
  const agentIds = agentIdParam
    ? [agentIdParam]
    : (((await redis.smembers(keys.agentIndex())) as string[]) || []);

  const results: Record<string, any> = {};
  for (const id of agentIds) {
    try {
      results[id] = await runTick(id);
    } catch (e: any) {
      results[id] = { status: "error", message: e?.message || String(e) };
    }
  }

  return NextResponse.json({ ticked: agentIds.length, results });
}

export async function POST(req: NextRequest) {
  return handleTick(req);
}

export async function GET(req: NextRequest) {
  return handleTick(req);
}
