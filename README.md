# Autonomous AI Creator

An autonomous AI & technology persona that discovers topics from live sources, exercises real editorial judgment, writes in a consistent voice, remembers what it's already covered, and keeps publishing over time with **zero human input after initialization**.

Built for the "Autonomous AI Creator" hackathon problem statement. Runs entirely on free tiers — no credit card required anywhere.

---

## How it satisfies the spec

| Requirement | How |
|---|---|
| Topic discovery | Live pulls from **Hacker News** (Algolia API), **arXiv** (Atom API), and **GitHub** search — every tick, in parallel |
| Editorial judgment | A single LLM call (`lib/judge.ts`) applies the persona's fixed editorial standards, selects **at most one** topic, and must give a genuine one-line reason for rejecting every other candidate — logged and queryable at `/api/agent/rejections` |
| Consistent persona | One fixed system prompt (`lib/persona.ts`), generated once at `init` time and reused verbatim for *every* LLM call after that — judgment and writing both draw from the same identity |
| Memory | Every considered topic (published or rejected) is fingerprinted and stored in a Redis set, so the agent never re-covers the same ground; the 5 most recent published topics are also fed back into the writer prompt to keep angles fresh |
| Autonomous publishing over time | An external scheduler (cron-job.org) calls an internal `/api/agent/tick` route every 15–30 minutes; a cadence gate stops the agent from publishing more than once every `MIN_POST_GAP_MINUTES`, so output reads as paced editorial output, not a firehose |
| Publishing rationale | Every post carries `rationale` (why selected + why relevant now) and `sources` (the real URL discovered), both returned directly in the feed API response |

## Why this counts as "autonomous" on serverless

Vercel functions have no persistent background process — a tick has to be *triggered* by something outside the function itself. The evaluator's contract only allows two calls (`init` once, `feed` repeatedly, neither of which is allowed to drive publishing). So an external, dumb clock (cron-job.org, free, interval down to 1 minute) pings a **separate, secret-protected internal route** on a schedule. That external ping never decides *what* gets published — it just gives the agent's own logic (discovery → judgment → writing, all self-contained) a chance to run. From the evaluator's point of view, calling `feed` is the only interaction, and new posts appear on their own.

Vercel's own daily cron (`vercel.json`) is wired in too, as a redundant failsafe in case the external scheduler is ever misconfigured.

---

## Architecture

```
autonomous-ai-creator/
├── app/
│   ├── page.tsx                    # optional demo UI: paste an agentId, watch the feed live
│   ├── layout.tsx / globals.css
│   └── api/agent/
│       ├── init/route.ts           # POST — required. Creates persona, runs first tick.
│       ├── feed/route.ts           # GET  — required. Read-only, returns posts newest-first.
│       ├── tick/route.ts           # POST/GET — internal heartbeat, secret-protected. Not in the evaluator's contract.
│       └── rejections/route.ts     # GET  — optional transparency endpoint for demo/judging.
├── lib/
│   ├── redis.ts                    # Upstash REST client + key naming
│   ├── persona.ts                  # builds the one fixed system prompt per agent
│   ├── types.ts
│   ├── dedupe.ts                   # title -> fingerprint, for memory/dedup
│   ├── discover.ts                 # fan-out to all sources
│   ├── sources/
│   │   ├── hackernews.ts
│   │   ├── arxiv.ts
│   │   └── github.ts
│   ├── gemini.ts                   # forces strict-JSON Gemini calls
│   ├── judge.ts                    # editorial judgment LLM call
│   ├── writer.ts                   # post + rationale LLM call
│   └── tick.ts                     # the full autonomous loop, one call = one cycle
├── vercel.json                     # backup daily cron -> /api/agent/tick
└── .env.example
```

### The tick pipeline (`lib/tick.ts`), each cycle

1. **Lock** — a short Redis lock prevents two overlapping cron hits from double-publishing.
2. **Discover** — pull ~10-30 candidates from HN + arXiv + GitHub in parallel.
3. **Filter memory** — drop anything already fingerprinted as seen (published or rejected before).
4. **Judge** — one LLM call: pick at most one candidate against the persona's editorial standards; log a reason for every rejection.
5. **Cadence gate** — if a post already went out too recently, hold the winner back (still logged, for transparency) rather than publishing immediately.
6. **Write** — one LLM call: generate the post text + rationale in the fixed voice, referencing the source.
7. **Persist** — push the new post (newest-first) into Redis, update "last published" timestamp and recent-topics memory.
8. **No-op gracefully** — if nothing clears the bar, the tick does nothing and returns fast. That silence is itself evidence of editorial judgment.

---

## Setup

### 1. Free accounts needed
- **Upstash** (Redis, free tier — [console.upstash.com](https://console.upstash.com)) → create a Redis database → copy the REST URL + REST token.
- **Google AI Studio** (Gemini API key, free tier — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)).
- **cron-job.org** (free scheduler — [cron-job.org](https://cron-job.org)).

### 2. Environment variables
Copy `.env.example` to `.env.local` for local dev, and set the same keys in **Vercel → Project → Settings → Environment Variables** for deployment:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
TICK_SECRET=some-long-random-string
MIN_POST_GAP_MINUTES=90
```

### 3. Deploy
1. Push this repo to GitHub.
2. Import it in Vercel → it auto-detects Next.js, no build config needed.
3. Add the environment variables above.
4. Deploy (Hobby plan is enough — everything here fits comfortably in the free tier).

### 4. Wire up the real heartbeat (cron-job.org)
1. Create a job hitting `POST https://<your-app>.vercel.app/api/agent/tick`.
2. Interval: every 15–30 minutes.
3. Add header: `Authorization: Bearer <your TICK_SECRET>`.
4. Save and enable it.

(`vercel.json` also registers a once-daily Vercel Cron hitting the same route as a failsafe — Vercel Hobby caps its own cron at once/day, which is why cron-job.org is the primary driver.)

### 5. Initialize the agent
Call once, e.g.:
```bash
curl -X POST https://<your-app>.vercel.app/api/agent/init \
  -H "Content-Type: application/json" \
  -d '{"persona": {"name": "Nyra", "domain": "AI Security"}}'
```
Response: `{"agentId": "..."}` — save this. `init` also runs the very first tick synchronously so the feed isn't empty on the first poll.

### 6. Watch it run
- **Demo UI**: just open `https://<your-app>.vercel.app/` — no agentId needed. It auto-discovers any agent you've already initialized and shows its feed. If none exist yet, it shows one-click buttons to launch a starter persona (calls `init` for you). Multiple agents initialized? Tabs appear to switch between them.
- API: `GET https://<your-app>.vercel.app/api/agent/feed?agentId=<id>`
- Status/health (debug, not required by spec): `GET /api/agent/status?agentId=<id>` — shows the last tick's outcome or exact error, so a failure is never invisible
- Rejections (optional, for demoing editorial judgment): `GET /api/agent/rejections?agentId=<id>`
- All agents (debug): `GET /api/agent/list`

---

## Notes

- Publishing is simulated (feed-only) — the spec explicitly allows this; no real social platform integration is required.
- `MIN_POST_GAP_MINUTES` controls pacing; lower it for a faster-moving demo, raise it for a more editorially sparse feed.
- Every LLM call forces `responseMimeType: "application/json"` so judgment/writing output is parsed reliably rather than scraped from prose.
- If a discovery source is rate-limited or down, it's caught and skipped — the tick still runs on whatever other sources return.
