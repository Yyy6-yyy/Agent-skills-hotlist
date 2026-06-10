import type { PlatformMeta, PlatformId } from "./types";

export const platforms: PlatformMeta[] = [
  {
    id: "skills-sh",
    label: "Skills.sh",
    domain: "skills.sh",
    iconUrl: "https://www.google.com/s2/favicons?domain=skills.sh&sz=64",
    accent: "#0f766e"
  },
  {
    id: "github",
    label: "GitHub",
    domain: "github.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=github.com&sz=64",
    accent: "#111827"
  },
  {
    id: "mcp-market",
    label: "MCP Market",
    domain: "mcpmarket.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=mcpmarket.com&sz=64",
    accent: "#6d3c74"
  },
  {
    id: "smithery",
    label: "Smithery",
    domain: "smithery.ai",
    iconUrl: "https://www.google.com/s2/favicons?domain=smithery.ai&sz=64",
    accent: "#d9a21b"
  },
  {
    id: "agentskills-in",
    label: "AgentSkills.in",
    domain: "agentskills.in",
    iconUrl: "https://www.google.com/s2/favicons?domain=agentskills.in&sz=64",
    accent: "#e25f4b"
  }
];

export const platformMap = new Map<PlatformId, PlatformMeta>(
  platforms.map((platform) => [platform.id, platform])
);
