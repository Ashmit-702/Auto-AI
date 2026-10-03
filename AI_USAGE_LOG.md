# AI Usage Log

This hackathon requires an accessible AI usage log for Stage 1 (Eligibility) and Stage 2 (Authenticity Review). Fill this in as you build — it should reasonably correspond to the features actually implemented, since judges cross-check this against commit history.

## Tools used
- Claude (Anthropic) — architecture planning, code generation, debugging
- (add any others: ChatGPT, Copilot, Cursor, etc.)

## Log format
For each significant AI-assisted step, record: what you asked for, roughly what was generated/changed, and which files it touched.

| # | Tool | Prompt (summary) | Output used for | Files touched |
|---|------|-------------------|------------------|----------------|
| 1 | Claude | Plan the overall architecture for an autonomous publishing agent on Vercel free tier | System design: Next.js + Upstash Redis + external cron + Gemini | (planning only) |
| 2 | Claude | Scaffold the full Next.js project implementing the init/feed/tick API contract | Full initial codebase | `app/api/agent/*`, `lib/*` |
| 3 | Claude | Write the persona system prompt and editorial-judgment prompt | `lib/persona.ts`, `lib/judge.ts` | |
| 4 | Claude | Implement HN/arXiv/GitHub source connectors | `lib/sources/*` | |
| 5 | Claude | Build the demo feed UI | `app/page.tsx`, `app/globals.css` | |
| 6 | Claude | README + deployment instructions | `README.md` | |
| ... | | | | |

## Notes for authenticity review
- Keep committing incrementally as you build/test locally rather than one large final commit — Stage 2 flags a first commit that already contains most of the project, or little activity followed by one big commit.
- If you significantly hand-edit AI-generated code, note that here too (e.g. "adjusted cadence gating logic manually after testing").
