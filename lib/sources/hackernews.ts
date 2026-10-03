import { Candidate } from "../types";

/**
 * Hacker News via the free Algolia search API — no key required, strong
 * signal for AI/tech/security discussion.
 */
export async function fetchHackerNews(domain: string): Promise<Candidate[]> {
  const query = encodeURIComponent(`${domain} AI`);
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${query}&hitsPerPage=15`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits || [])
      .filter((h: any) => h.title && h.url)
      .map(
        (h: any): Candidate => ({
          title: h.title,
          url: h.url,
          summary: h.story_text || h.title,
          publishedAt: h.created_at || new Date().toISOString(),
          source: "Hacker News",
        })
      );
  } catch {
    return [];
  }
}
