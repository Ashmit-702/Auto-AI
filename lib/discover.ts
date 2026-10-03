import { fetchHackerNews } from "./sources/hackernews";
import { fetchArxiv } from "./sources/arxiv";
import { fetchGithubTrending } from "./sources/github";
import { Candidate } from "./types";

/**
 * Topic discovery: pulls fresh candidates from three independent live
 * sources in parallel. Each source is wrapped so one failing (rate limit,
 * network hiccup) never takes down the whole tick.
 */
export async function discoverCandidates(domain: string): Promise<Candidate[]> {
  const [hn, arxiv, gh] = await Promise.all([
    fetchHackerNews(domain).catch(() => []),
    fetchArxiv(domain).catch(() => []),
    fetchGithubTrending(domain).catch(() => []),
  ]);
  return [...hn, ...arxiv, ...gh];
}
