import { hydrateScore } from "./scoring";
import type { Skill } from "./types";

const now = new Date("2026-06-09T00:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const knownSkillUrls: Record<string, string> = {
  "browser-use": "https://skills.sh/browser-use/browser-use/browser-use",
  "sequential-thinking": "https://smithery.ai/skills/samhvw8/sequential-thinking",
  "filesystem-mcp": "https://mcpmarket.com/server/filesystem-21",
  "playwright-agent": "https://github.com/microsoft/playwright",
  "excel-formula-copilot": "https://github.com/topics/excel-formula-copilot"
};

const skillUrl = (platform: string, slug: string) => {
  if (knownSkillUrls[slug]) return knownSkillUrls[slug];
  if (platform === "github") return `https://github.com/topics/${slug}`;
  if (platform === "skills-sh") return `https://www.skills.sh/?q=${slug}`;
  if (platform === "smithery") return `https://smithery.ai/search?q=${slug}`;
  if (platform === "mcp-market") return `https://mcpmarket.com/search?q=${slug}`;
  return `https://agentskills.in/search?q=${slug}`;
};

const detailedDescription = (name: string, category: string, platform: string) =>
  `${name} is a ${category.toLowerCase()} skill used by agent teams to run repeatable tasks with clearer inputs, observable outputs, and reusable handoff logs. It includes practical workflow defaults, source links, and integration hints so builders can evaluate whether the skill fits coding agents, MCP servers, automation pipelines, or daily operations before installing it from ${platform}.`;

const baseSkills = [
  ["browser-use", "Browser Automation", "Browser-use gives agents a browser control layer for multi-step web work, including page observation, form filling, navigation history, screenshots, and task memory. It is useful for QA, research collection, and operational workflows where a human would normally click through several pages.", "github", "https://github.com/browser-use/browser-use", ["browser", "automation", "web"], 934000, 302000, 77400, 1800000, 400, 2, false],
  ["sequential-thinking", "MCP", "Sequential Thinking helps agents break a large request into visible reasoning steps, revise assumptions, and keep a structured trace of intermediate decisions. It is especially useful for MCP-based workflows that need auditable planning before code, data, or browser actions run.", "smithery", skillUrl("smithery", "sequential-thinking"), ["mcp", "reasoning", "workflow"], 622000, 211000, 26200, 950000, 220, -1, false],
  ["github-repo-agent", "Coding", "GitHub Repo Agent indexes repository structure, summarizes changed files, prepares review notes, and helps agents create implementation plans tied to real branches or pull requests. It is designed for teams that want faster coding handoffs without losing context from issues, commits, and docs.", "skills-sh", skillUrl("skills-sh", "github-repo-agent"), ["coding", "github", "review"], 410000, 161000, 33400, 733000, 120, 8, false],
  ["filesystem-mcp", "MCP", "Filesystem MCP exposes scoped local file operations for agents, with permission boundaries, directory-aware reads, and safer write flows. It works well as a foundation skill for coding assistants, document processors, and agents that need to inspect project artifacts before acting.", "mcp-market", skillUrl("mcp-market", "filesystem-mcp"), ["mcp", "files", "productivity"], 390000, 142000, 18900, 620000, 60, 4, false],
  ["dataframe-analyst", "Data Analysis", "Dataframe Analyst turns spreadsheet, CSV, and database-style inputs into repeatable analysis steps, including cleaning suggestions, summaries, charts, and code-backed calculations. It is aimed at agent workflows where users need both quick insights and a traceable path from raw data to conclusions.", "agentskills-in", skillUrl("agentskills-in", "dataframe-analyst"), ["data", "charts", "python"], 292000, 99000, 15700, 510000, 20, 16, true],
  ["playwright-agent", "Browser Automation", "Playwright Agent wraps browser testing and visual verification into agent-friendly commands for navigation, assertions, screenshots, and trace review. It is strongest when product teams want agents to reproduce bugs, inspect UI states, or run smoke checks across desktop and mobile views.", "github", "https://github.com/microsoft/playwright", ["browser", "testing", "automation"], 820000, 281000, 72800, 1500000, 500, 1, false],
  ["postgres-memory", "MCP", "Postgres Memory stores durable agent notes, entity records, and workflow snapshots in PostgreSQL so long-running assistants can retrieve prior decisions with full text search. It is useful for support, research, and coding agents that need memory beyond a single session.", "smithery", skillUrl("smithery", "postgres-memory"), ["mcp", "memory", "database"], 183000, 78000, 9300, 312000, 45, 11, false],
  ["research-scout", "Research", "Research Scout collects candidate sources, compares claims across pages, and prepares concise citation-ready briefs with freshness notes. It is built for agents that need to gather evidence before answering, drafting reports, or recommending tools.", "skills-sh", skillUrl("skills-sh", "research-scout"), ["research", "citations", "web"], 174000, 72000, 12500, 284000, 14, 22, true],
  ["meilisearch-rag", "Data Analysis", "Meilisearch RAG connects agents to fast keyword and semantic retrieval over private indexes, making it easier to ground answers in internal docs, product catalogs, or support archives. It focuses on practical retrieval controls, ranking signals, and predictable response latency.", "mcp-market", skillUrl("mcp-market", "meilisearch-rag"), ["search", "rag", "data"], 164000, 68000, 8700, 251000, 30, 3, false],
  ["notion-workflow", "Productivity", "Notion Workflow lets agents read, create, update, and audit workspace pages, databases, and project notes. It is useful for teams that keep plans, meeting notes, and task trackers in Notion and want agents to keep those systems current.", "smithery", skillUrl("smithery", "notion-workflow"), ["notion", "workflow", "productivity"], 151000, 61000, 7400, 236000, 90, -4, false],
  ["openapi-skill-builder", "Agent Workflow", "OpenAPI Skill Builder converts API specifications into agent-ready tools with typed inputs, validation hints, and example calls. It helps builders quickly turn existing product APIs into reusable skills without hand-writing every tool wrapper.", "agentskills-in", skillUrl("agentskills-in", "openapi-skill-builder"), ["openapi", "tools", "workflow"], 132000, 54000, 6700, 205000, 8, 31, true],
  ["slack-ops-agent", "Productivity", "Slack Ops Agent summarizes channel activity, extracts decisions, creates tickets, and drafts incident updates for busy operational teams. It is designed for agents that need to move between chat context, project systems, and follow-up reminders.", "skills-sh", skillUrl("skills-sh", "slack-ops-agent"), ["slack", "ops", "workflow"], 128000, 52000, 6200, 190000, 50, 7, false],
  ["excel-formula-copilot", "Data Analysis", "Excel Formula Copilot helps agents build formulas, reconcile tables, generate pivots, and explain spreadsheet logic in plain language. It is useful for finance, operations, and analytics teams that need transparent calculations rather than one-off spreadsheet guesses.", "github", "https://github.com/topics/excel-formula-copilot", ["spreadsheet", "data", "analysis"], 119000, 50000, 5900, 182000, 70, -3, false],
  ["figma-ui-inspector", "Coding", "Figma UI Inspector extracts layout details, component names, color tokens, and implementation notes from design files so frontend agents can produce more faithful UI changes. It is tuned for handoffs where design intent needs to survive translation into code.", "mcp-market", skillUrl("mcp-market", "figma-ui-inspector"), ["figma", "frontend", "coding"], 98000, 41000, 5200, 156000, 12, 18, true],
  ["calendar-agent", "Productivity", "Calendar Agent coordinates availability, meeting creation, reminder scheduling, and follow-up tasks across agent workflows. It is useful when assistants need to reason about time windows, participants, and next actions without leaving scheduling context behind.", "smithery", skillUrl("smithery", "calendar-agent"), ["calendar", "workflow", "productivity"], 96000, 38000, 4800, 149000, 110, -8, false]
] as const;

const platforms = ["skills-sh", "github", "mcp-market", "smithery", "agentskills-in"] as const;
const categorySeeds = ["Coding", "Browser Automation", "Data Analysis", "MCP", "Agent Workflow", "Productivity", "Research"] as const;
const names = [
  "cli-command-router",
  "jira-triage",
  "pdf-contract-reader",
  "vector-db-loader",
  "kubernetes-debugger",
  "api-smoke-tester",
  "docs-changelog-writer",
  "email-digest-agent",
  "sql-query-planner",
  "image-asset-pipeline",
  "customer-support-skill",
  "terminal-session-memory",
  "web-scrape-cleaner",
  "python-notebook-runner",
  "crm-enrichment-agent",
  "prompt-regression-suite",
  "cloud-cost-reviewer",
  "linear-project-agent",
  "obsidian-knowledge-sync",
  "release-note-agent"
];

export const sampleSkills: Skill[] = [
  ...baseSkills.map((item, index) =>
    hydrateScore({
      id: `${item[3]}-${item[0]}`,
      name: item[0],
      category: item[1],
      description: item[2],
      platform: item[3],
      sourceUrl: item[4],
      tags: [...item[5]],
      downloads: item[6],
      installs: item[7],
      stars: item[8],
      views: item[9],
      createdAt: daysAgo(item[10]),
      updatedAt: daysAgo(index + 1),
      rankDelta: item[11],
      isNewEntrant: item[12]
    })
  ),
  ...Array.from({ length: 85 }, (_, index) => {
    const platform = platforms[index % platforms.length];
    const category = categorySeeds[index % categorySeeds.length];
    const name = names[index % names.length];
    const serial = index + 16;
    return hydrateScore({
      id: `${platform}-${name}-${serial}`,
      name: `${name}-${serial}`,
      description: detailedDescription(`${name}-${serial}`, category, platform),
      platform,
      sourceUrl: skillUrl(platform, `${name}-${serial}`),
      tags: [category.toLowerCase().replaceAll(" ", "-"), platform, index % 3 === 0 ? "mcp" : "workflow"],
      downloads: Math.max(1800, 95000 - index * 910),
      installs: Math.max(700, 38000 - index * 420),
      stars: Math.max(120, 4600 - index * 49),
      views: Math.max(2400, 138000 - index * 1200),
      createdAt: daysAgo(30 + index * 5),
      updatedAt: daysAgo((index % 28) + 1),
      rankDelta: index % 6 === 0 ? 12 : index % 5 === 0 ? -7 : index % 4,
      isNewEntrant: index % 19 === 0
    });
  })
].sort((a, b) => b.trendingScore - a.trendingScore);

export const categories = Array.from(new Set(sampleSkills.map((skill) => skill.category)));
