export type PlatformId =
  | "skills-sh"
  | "github"
  | "mcp-market"
  | "smithery"
  | "agentskills-in";

export type SortKey = "trending" | "downloads" | "stars" | "newest" | "updated";

export type Category =
  | "Coding"
  | "Browser Automation"
  | "Data Analysis"
  | "MCP"
  | "Agent Workflow"
  | "Productivity"
  | "Research";

export interface Skill {
  id: string;
  name: string;
  description: string;
  platform: PlatformId;
  sourceUrl: string;
  tags: string[];
  category: Category;
  downloads: number;
  installs: number;
  stars: number;
  views: number;
  createdAt: string;
  updatedAt: string;
  rankDelta: number;
  isNewEntrant: boolean;
  trendingScore: number;
}

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  domain: string;
  iconUrl: string;
  accent: string;
}
