import { Candidate } from "../types";

/**
 * arXiv's public Atom API — no key required. Gives real papers, which is
 * exactly the kind of "concrete technical substance" the persona's editorial
 * standards look for.
 */
export async function fetchArxiv(domain: string): Promise<Candidate[]> {
  const query = encodeURIComponent(`all:${domain}`);
  const url = `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=10`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1);

    return entries
      .map((chunk): Candidate | null => {
        const title = extractTag(chunk, "title");
        const summary = extractTag(chunk, "summary");
        const published = extractTag(chunk, "published");
        const idMatch = chunk.match(/<id>([\s\S]*?)<\/id>/);
        const url = idMatch ? idMatch[1].trim() : "";
        if (!title || !url) return null;
        return {
          title: title.replace(/\s+/g, " ").trim(),
          url,
          summary: (summary || "").replace(/\s+/g, " ").trim(),
          publishedAt: published || new Date().toISOString(),
          source: "arXiv",
        };
      })
      .filter((c): c is Candidate => c !== null);
  } catch {
    return [];
  }
}

function extractTag(chunk: string, tag: string): string | null {
  const match = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1] : null;
}
