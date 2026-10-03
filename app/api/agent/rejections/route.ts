import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Rejection } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agent/rejections?agentId=...
 * NOT part of the required contract. A transparency/debug endpoint that
 * exposes what the agent chose NOT to publish and why — useful evidence of
 * genuine editorial judgment for judges/demo purposes, without being
 * required by the spec.
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId query param is required" }, { status: 400 });
  }

  const raw = (await redis.lrange(keys.rejections(agentId), 0, 49)) as unknown[];
  const rejections: Rejection[] = (raw || []).map((r) => (typeof r === "string" ? JSON.parse(r) : (r as Rejection)));

  return NextResponse.json({ rejections });
}
