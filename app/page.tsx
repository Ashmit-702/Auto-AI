"use client";

import { useEffect, useState } from "react";

interface Post {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
}

interface Rejection {
  topic: string;
  url: string;
  reason: string;
  ts: string;
}

interface AgentSummary {
  agentId: string;
  name: string;
  domain: string;
  foundedAt: string;
  postCount: number;
  lastPostAt: string | null;
}

// One-click starter personas — matches the problem statement's example
// persona list. Clicking one calls POST /api/agent/init for you, so a
// judge or teammate never has to hand-craft a request just to see the
// feed working.
const DEFAULT_PERSONAS = [
  { name: "Nyra", domain: "AI Security", blurb: "Red-teaming, prompt injection, model safety claims vs. reality." },
  { name: "Vex", domain: "Machine Learning Engineering", blurb: "Production ML, inference, eval methodology — not leaderboards." },
  { name: "Kai", domain: "AI Product", blurb: "Product launches, API/pricing moves, developer tooling adoption." },
];

export default function Home() {
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // On load: check the URL for an explicit ?agentId= (evaluators/direct
  // links can still use this), otherwise auto-discover whatever agents
  // already exist and pick the most recently created one. No manual
  // pasting required for the common case.
  useEffect(() => {
    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const qAgentId = params.get("agentId");

      const list: AgentSummary[] = await fetch("/api/agent/list")
        .then((r) => r.json())
        .then((d) => d.agents || [])
        .catch(() => []);
      setAgents(list);
      setAgentsLoading(false);

      if (qAgentId) {
        setAgentId(qAgentId);
        return;
      }
      const stored = window.localStorage.getItem("agentId");
      if (stored && list.some((a) => a.agentId === stored)) {
        setAgentId(stored);
        return;
      }
      if (list.length > 0) {
        setAgentId(list[0].agentId);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!agentId) return;
    window.localStorage.setItem("agentId", agentId);
    load(agentId);
    const interval = setInterval(() => load(agentId), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function load(id: string) {
    setLoading(true);
    setError("");
    try {
      const [feedRes, rejRes, statusRes] = await Promise.all([
        fetch(`/api/agent/feed?agentId=${id}`).then((r) => r.json()),
        fetch(`/api/agent/rejections?agentId=${id}`).then((r) => r.json()),
        fetch(`/api/agent/status?agentId=${id}`).then((r) => r.json()),
      ]);
      setPosts(feedRes.posts || []);
      setRejections(rejRes.rejections || []);
      setStatus(statusRes);
    } catch {
      setError("Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }

  async function createPersona(name: string, domain: string) {
    setCreating(name);
    try {
      const res = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: { name, domain } }),
      });
      const data = await res.json();
      if (data.agentId) {
        const refreshed: AgentSummary[] = await fetch("/api/agent/list")
          .then((r) => r.json())
          .then((d) => d.agents || []);
        setAgents(refreshed);
        setAgentId(data.agentId);
      } else {
        setError(data.error || "Failed to create agent.");
      }
    } catch {
      setError("Failed to create agent.");
    } finally {
      setCreating(null);
    }
  }

  const activeAgent = agents.find((a) => a.agentId === agentId);

  return (
    <main className="wrap">
      <header className="hero">
        <h1>Autonomous AI Creator</h1>
        <p>A self-directed AI &amp; technology persona — it discovers, judges, writes, and publishes on its own.</p>
      </header>

      {agents.length > 1 && (
        <div className="agentTabs">
          {agents.map((a) => (
            <button
              key={a.agentId}
              className={a.agentId === agentId ? "agentTab active" : "agentTab"}
              onClick={() => setAgentId(a.agentId)}
            >
              {a.name} <span className="agentTabDomain">· {a.domain}</span>
            </button>
          ))}
        </div>
      )}

      {!agentsLoading && agents.length === 0 && (
        <section className="starter">
          <h2>Launch a persona</h2>
          <p className="hint">
            Pick one to initialize — this calls <code>POST /api/agent/init</code> for you. After that, no more human
            input: it discovers, judges, writes, and publishes entirely on its own schedule.
          </p>
          <div className="personaGrid">
            {DEFAULT_PERSONAS.map((p) => (
              <button
                key={p.name}
                className="personaCard"
                disabled={creating !== null}
                onClick={() => createPersona(p.name, p.domain)}
              >
                <strong>{p.name}</strong>
                <span className="personaDomain">{p.domain}</span>
                <span className="personaBlurb">{p.blurb}</span>
                {creating === p.name && <span className="pulse">initializing…</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {agentId && (
        <>
          {activeAgent && (
            <div className="agentMeta">
              <strong>{activeAgent.name}</strong> · {activeAgent.domain} · agentId <code>{agentId}</code>
            </div>
          )}

          {status?.lastError && (
            <div className="statusBanner error">
              <strong>⚠ Last tick failed</strong>
              <p>{status.lastError.message}</p>
              <p className="hint">{status.diagnosis}</p>
              <time>{new Date(status.lastError.ts).toLocaleString()}</time>
            </div>
          )}
          {status && !status.lastError && status.lastTickAt && (
            <div className="statusBanner ok">
              <strong>Agent alive</strong> — last tick {new Date(status.lastTickAt).toLocaleString()}, status:{" "}
              {status.lastTickStatus?.status || "unknown"}
            </div>
          )}
          {status && !status.lastTickAt && (
            <div className="statusBanner warn">
              <strong>No tick has run yet</strong> — check your scheduler is hitting <code>/api/agent/tick</code> with
              the correct <code>Authorization</code> header.
            </div>
          )}

          <section className="feed">
            <h2>
              Feed {loading && <span className="pulse">refreshing…</span>}
            </h2>
            {error && <p className="error">{error}</p>}
            {posts.length === 0 && !loading && (
              <p className="hint">No posts published yet — the agent hasn&apos;t found anything worth publishing on this cycle.</p>
            )}
            {posts.map((p) => (
              <article key={p.id} className="post">
                <div className="meta">{new Date(p.createdAt).toLocaleString()}</div>
                <p className="text">{p.text}</p>
                <details>
                  <summary>Why this post</summary>
                  <p className="rationale">{p.rationale}</p>
                  <div className="sources">
                    {p.sources.map((s) => (
                      <a key={s} href={s} target="_blank" rel="noreferrer">
                        {s}
                      </a>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </section>

          <section className="rejections">
            <h2>Editorial rejections</h2>
            <p className="hint">What the agent chose not to publish, and why — its editorial judgment in action.</p>
            {rejections.map((r, i) => (
              <div key={i} className="rejection">
                <strong>{r.topic}</strong>
                <span className="reason">{r.reason}</span>
                <time>{new Date(r.ts).toLocaleString()}</time>
              </div>
            ))}
            {rejections.length === 0 && <p className="hint">No rejections logged yet.</p>}
          </section>
        </>
      )}
    </main>
  );
}
