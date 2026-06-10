import { hydrateScore } from "./scoring";
import type { Category, PlatformId, Skill } from "./types";

type RawSkill = Omit<Skill, "trendingScore">;

interface CollectorResult {
  platform: PlatformId;
  skills: Skill[];
  status: "ok" | "skipped" | "failed";
  message: string;
}

interface Collector {
  platform: PlatformId;
  collect: () => Promise<CollectorResult>;
}

const now = () => new Date().toISOString();

function asCategory(input = ""): Category {
  const text = input.toLowerCase();
  if (text.includes("browser") || text.includes("web scraping")) return "Browser Automation";
  if (text.includes("data") || text.includes("analytics") || text.includes("search")) return "Data Analysis";
  if (text.includes("mcp") || text.includes("server")) return "MCP";
  if (text.includes("workflow") || text.includes("agent")) return "Agent Workflow";
  if (text.includes("productivity") || text.includes("collaboration")) return "Productivity";
  if (text.includes("research") || text.includes("documentation")) return "Research";
  return "Coding";
}

function numberFromCompact(value?: string | number | null) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const normalized = value.toString().trim().replaceAll(",", "");
  const match = normalized.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!match) return Number(normalized.replace(/[^\d.]/g, "")) || 0;
  const base = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "k") return Math.round(base * 1_000);
  return Math.round(base);
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isAgentSkillRelevant(item: { name?: string; full_name?: string; description?: string | null; topics?: string[]; tags?: string[] }) {
  const haystack = [item.name, item.full_name, item.description, ...(item.topics ?? []), ...(item.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (haystack.includes("prompts.chat") || haystack.includes("chatgpt prompts")) return false;
  const hasCoreSignal = /\b(agent|agents|skill|skills|mcp|claude|codex|cursor|copilot|opencode|gemini cli|browser automation|ai assistant)\b/.test(
    haystack
  );
  const isPromptOnly = /\b(prompt|prompts)\b/.test(haystack) && !/\b(agent|agents|skill|skills|mcp|claude|codex)\b/.test(haystack);
  const isGenericAwesome = /\bawesome\b/.test(haystack) && !/\b(agent|agents|skill|skills|mcp|claude|codex)\b/.test(haystack);
  return hasCoreSignal && !isPromptOnly && !isGenericAwesome;
}

function frontmatterDescription(markdown = "") {
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/);
  const description = frontmatter?.[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (description) return description.replace(/^["']|["']$/g, "");
  return stripHtml(markdown).slice(0, 260);
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "agent-skills-hotlist/0.1 (+https://github.com)",
      Accept: "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function skill(raw: RawSkill) {
  return hydrateScore(raw);
}

async function collectSkillsSh(): Promise<CollectorResult> {
  const token = process.env.VERCEL_OIDC_TOKEN ?? process.env.SKILLS_SH_TOKEN;
  const collectedAt = now();

  if (token) {
    const data = await fetchJson<{
      data: Array<{
        id: string;
        slug: string;
        name: string;
        source: string;
        installs: number;
        installUrl: string | null;
        url: string;
      }>;
    }>("https://skills.sh/api/v1/skills?view=trending&per_page=100", {
      Authorization: `Bearer ${token}`
    });

    const details = await Promise.all(
      data.data.slice(0, 50).map(async (item) => {
        try {
          const detail = await fetchJson<{ files?: Array<{ path: string; contents: string }> }>(
            `https://skills.sh/api/v1/skills/${item.id}`,
            { Authorization: `Bearer ${token}` }
          );
          return [item.id, frontmatterDescription(detail.files?.find((file) => file.path.endsWith("SKILL.md"))?.contents)] as const;
        } catch {
          return [item.id, "A real Skills.sh leaderboard entry fetched from the authenticated Skills.sh API."] as const;
        }
      })
    );
    const descriptions = new Map(details);

    return {
      platform: "skills-sh",
      status: "ok",
      message: `Fetched ${data.data.length} skills from the official Skills.sh API.`,
      skills: data.data.map((item) =>
        skill({
          id: `skills-sh-${item.id}`,
          name: item.name || item.slug,
          description: descriptions.get(item.id) ?? "A real Skills.sh leaderboard entry fetched from the authenticated Skills.sh API.",
          platform: "skills-sh",
          sourceUrl: item.url,
          tags: ["skills.sh", item.source.split("/")[0], item.source.split("/")[1]].filter(Boolean),
          category: asCategory(`${item.name} ${item.source}`),
          downloads: item.installs,
          installs: item.installs,
          stars: 0,
          views: item.installs,
          createdAt: collectedAt,
          updatedAt: collectedAt,
          rankDelta: 0,
          isNewEntrant: false
        })
      )
    };
  }

  const html = await fetchText("https://www.skills.sh/trending");
  const matches = [...html.matchAll(/href="(\/[^"]+\/[^"]+\/[^"]+)"[^>]*>([^<]+)\s+([^<]+\/[^<]+)\s+([\d.]+[KM]?|\d+)/g)];
  const seen = new Set<string>();
  const skills = matches
    .map((match) => {
      const [, href, name, source, installs] = match;
      if (href.includes("?") || href.includes(".svg") || href.includes(".png") || href.includes(".ico")) return null;
      const parts = href.split("/").filter(Boolean);
      if (parts[0] === "agent" || parts[0] === "agents" || parts[0] === "_next") return null;
      const url = `https://www.skills.sh${href}`;
      if (seen.has(url)) return null;
      seen.add(url);
      return skill({
        id: `skills-sh-${source}/${name}`,
        name: name.trim(),
        description: `A real Skills.sh trending entry from ${source.trim()}, scraped from the public leaderboard because no Vercel OIDC token was configured.`,
        platform: "skills-sh",
        sourceUrl: url,
        tags: ["skills.sh", ...source.trim().split("/")],
        category: asCategory(`${name} ${source}`),
        downloads: numberFromCompact(installs),
        installs: numberFromCompact(installs),
        stars: 0,
        views: numberFromCompact(installs),
        createdAt: collectedAt,
        updatedAt: collectedAt,
        rankDelta: 0,
        isNewEntrant: false
      });
    })
    .filter((item): item is Skill => Boolean(item))
    .slice(0, 100);

  return {
    platform: "skills-sh",
    status: skills.length ? "ok" : "failed",
    message: skills.length
      ? `Scraped ${skills.length} Skills.sh rows from the public trending page. Configure VERCEL_OIDC_TOKEN for official API details.`
      : "Skills.sh scrape returned no rows.",
    skills
  };
}

async function collectSmithery(): Promise<CollectorResult> {
  const apiKey = process.env.SMITHERY_API_KEY;
  if (!apiKey) {
    return {
      platform: "smithery",
      status: "skipped",
      message: "Set SMITHERY_API_KEY to use the official Smithery registry API.",
      skills: []
    };
  }

  const collectedAt = now();
  const data = await fetchJson<{
    servers: Array<{
      qualifiedName: string;
      slug: string;
      displayName: string;
      description: string;
      iconUrl?: string;
      useCount?: number;
      createdAt?: string;
      homepage?: string;
      verified?: boolean;
      score?: number;
    }>;
  }>("https://registry.smithery.ai/servers?pageSize=100&topK=500", {
    Authorization: `Bearer ${apiKey}`
  });

  return {
    platform: "smithery",
    status: "ok",
    message: `Fetched ${data.servers.length} servers from the official Smithery API.`,
    skills: data.servers.map((item) =>
      skill({
        id: `smithery-${item.qualifiedName}`,
        name: item.displayName || item.slug,
        description: item.description || "A real public Smithery registry server.",
        platform: "smithery",
        sourceUrl: `https://smithery.ai/server/${item.qualifiedName}`,
        tags: ["smithery", item.verified ? "verified" : "community"],
        category: asCategory(`${item.displayName} ${item.description}`),
        downloads: item.useCount ?? 0,
        installs: item.useCount ?? 0,
        stars: 0,
        views: item.useCount ?? Math.round((item.score ?? 0) * 1000),
        createdAt: item.createdAt ?? collectedAt,
        updatedAt: collectedAt,
        rankDelta: 0,
        isNewEntrant: false
      })
    )
  };
}

async function collectMcpMarket(): Promise<CollectorResult> {
  const html = await fetchText("https://mcpmarket.com/");
  const collectedAt = now();
  const linkMatches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const seen = new Set<string>();
  const skills: Skill[] = [];

  for (const [, href, body] of linkMatches) {
    if (!href.includes("/server/") && !href.includes("/skill/")) continue;
    const text = stripHtml(body);
    const metric = text.match(/([\d.]+[kKmM]?|\d+)\s*$/)?.[1];
    const cleaned = metric ? text.replace(metric, "").trim() : text;
    const words = cleaned.split(/\s+/);
    const name = words.slice(0, Math.min(4, words.length)).join(" ");
    if (!name || seen.has(href)) continue;
    seen.add(href);

    skills.push(
      skill({
        id: `mcp-market-${href}`,
        name,
        description: cleaned || "A real MCP Market listing scraped from the public leaderboard.",
        platform: "mcp-market",
        sourceUrl: href.startsWith("http") ? href : `https://mcpmarket.com${href}`,
        tags: ["mcp-market", "mcp"],
        category: asCategory(cleaned),
        downloads: numberFromCompact(metric),
        installs: numberFromCompact(metric),
        stars: 0,
        views: numberFromCompact(metric),
        createdAt: collectedAt,
        updatedAt: collectedAt,
        rankDelta: 0,
        isNewEntrant: false
      })
    );
  }

  return {
    platform: "mcp-market",
    status: skills.length ? "ok" : "failed",
    message: skills.length ? `Scraped ${skills.length} MCP Market listings from public pages.` : "MCP Market scrape returned no rows.",
    skills: skills.slice(0, 100)
  };
}

async function collectGithub(): Promise<CollectorResult> {
  const token = process.env.GITHUB_TOKEN;
  const collectedAt = now();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const data = await fetchJson<{
    items: Array<{
      id: number;
      name: string;
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      watchers_count: number;
      forks_count: number;
      created_at: string;
      updated_at: string;
      topics?: string[];
    }>;
  }>(
    `https://api.github.com/search/repositories?q=${encodeURIComponent('"agent skills" OR "claude skills" OR "mcp server" OR "codex skill" in:readme,description')}&sort=stars&order=desc&per_page=50`,
    headers
  );

  return {
    platform: "github",
    status: "ok",
    message: `Fetched ${data.items.length} repositories from the GitHub Search API.`,
    skills: data.items.filter(isAgentSkillRelevant).map((item) =>
      skill({
        id: `github-${item.id}`,
        name: item.full_name,
        description: item.description || "A GitHub repository discovered through the GitHub Search API for agent skill related terms.",
        platform: "github",
        sourceUrl: item.html_url,
        tags: ["github", ...(item.topics ?? []).slice(0, 4)],
        category: asCategory(`${item.name} ${item.description ?? ""} ${(item.topics ?? []).join(" ")}`),
        downloads: 0,
        installs: 0,
        stars: item.stargazers_count,
        views: item.watchers_count + item.forks_count,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        rankDelta: 0,
        isNewEntrant: false
      })
    )
  };
}

async function collectAgentSkillsIn(): Promise<CollectorResult> {
  const html = await fetchText("https://www.agentskills.in/marketplace");
  const collectedAt = now();
  const jsonMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const text = stripHtml(html);
  const skills: Skill[] = [];

  for (const match of jsonMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const name = item.name || item.headline;
        if (!name) continue;
        skills.push(
          skill({
            id: `agentskills-in-${name}`,
            name,
            description: item.description || "A real AgentSkills.in marketplace item extracted from page metadata.",
            platform: "agentskills-in",
            sourceUrl: item.url || "https://www.agentskills.in/marketplace",
            tags: ["agentskills.in"],
            category: asCategory(`${name} ${item.description ?? ""}`),
            downloads: 0,
            installs: 0,
            stars: 0,
            views: 0,
            createdAt: collectedAt,
            updatedAt: collectedAt,
            rankDelta: 0,
            isNewEntrant: false
          })
        );
      }
    } catch {
      continue;
    }
  }

  if (!skills.length && text.includes("175,000+ skills")) {
    return {
      platform: "agentskills-in",
      status: "skipped",
      message: "AgentSkills.in marketplace is client-rendered; use its CLI/API integration when available.",
      skills: []
    };
  }

  return {
    platform: "agentskills-in",
    status: skills.length ? "ok" : "failed",
    message: skills.length ? `Extracted ${skills.length} AgentSkills.in marketplace rows.` : "AgentSkills.in scrape returned no rows.",
    skills: skills.slice(0, 100)
  };
}

export const collectors: Collector[] = [
  { platform: "skills-sh", collect: collectSkillsSh },
  { platform: "smithery", collect: collectSmithery },
  { platform: "mcp-market", collect: collectMcpMarket },
  { platform: "github", collect: collectGithub },
  { platform: "agentskills-in", collect: collectAgentSkillsIn }
];

export async function collectAllSkills() {
  const results = await Promise.allSettled(collectors.map((collector) => collector.collect()));
  const skills: Skill[] = [];

  results.forEach((result, index) => {
    const platform = collectors[index].platform;
    if (result.status === "fulfilled") {
      console.log(`[${platform}] ${result.value.status}: ${result.value.message}`);
      skills.push(...result.value.skills);
    } else {
      console.warn(`[${platform}] failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });

  return skills.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 250);
}
