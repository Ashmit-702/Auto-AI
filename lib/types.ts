export interface PersonaDoc {
  name: string;
  domain: string;
  systemPrompt: string;
  foundedAt: string;
}

export interface Candidate {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  source: string;
}

export interface Post {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
}

export interface Rejection {
  topic: string;
  url: string;
  reason: string;
  ts: string;
}
