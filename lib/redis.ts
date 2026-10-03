import { Redis } from "@upstash/redis";

// Upstash's REST client works natively in serverless / edge functions with no
// connection pooling headaches, which is why it's used instead of a raw TCP
// redis client. All agent state (persona, posts, memory of seen topics,
// rejection log) lives here so it survives cold starts between cron ticks.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export const keys = {
  persona: (agentId: string) => `agent:${agentId}:persona`,
  posts: (agentId: string) => `agent:${agentId}:posts`,
  seenTopics: (agentId: string) => `agent:${agentId}:seenTopics`,
  recentTopicTitles: (agentId: string) => `agent:${agentId}:recentTopicTitles`,
  rejections: (agentId: string) => `agent:${agentId}:rejections`,
  lastPostAt: (agentId: string) => `agent:${agentId}:lastPostAt`,
  lock: (agentId: string) => `agent:${agentId}:lock`,
  agentIndex: () => `agents:index`,
  lastTickAt: (agentId: string) => `agent:${agentId}:lastTickAt`,
  lastTickStatus: (agentId: string) => `agent:${agentId}:lastTickStatus`,
  lastError: (agentId: string) => `agent:${agentId}:lastError`,
};
