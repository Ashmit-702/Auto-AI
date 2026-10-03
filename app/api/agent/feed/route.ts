import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Post } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agent/feed?agentId=...
 * The only endpoint the evaluator calls after init. Purely reads state —
 * it never triggers publishing itself. Posts are stored newest-first
 * (lpush on write), so no extra sort is needed here.
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId query param is required" }, { status: 400 });
  }

  const raw = (await redis.lrange(keys.posts(agentId), 0, -1)) as unknown[];
  const posts: Post[] = (raw || []).map((p) => (typeof p === "string" ? JSON.parse(p) : (p as Post)));

  return NextResponse.json({ posts });
}
