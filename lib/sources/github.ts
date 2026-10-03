import { Candidate } from "../types";

/**
 * GitHub's public search API (unauthenticated, rate-limited but free) —
 * surfaces new or recently updated tools/repos relevant to the domain.
 */
export async function fetchGithubTrending(domain: string): Promise<Candidate[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const query = encodeURIComponent(`${domain} in:name,description,readme created:>${since}`);
  const url = `https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=10`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "autonomous-ai-creator",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(
      (r: any): Candidate => ({
        title: `${r.full_name}: ${r.description || "new or recently updated repository"}`,
        url: r.html_url,
        summary: r.description || r.full_name,
        publishedAt: r.updated_at || r.created_at || new Date().toISOString(),
        source: "GitHub",
      })
    );
  } catch {
    return [];
  }
}
