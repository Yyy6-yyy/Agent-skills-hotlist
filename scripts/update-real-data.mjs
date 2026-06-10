import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.resolve(root, "..", "..", "outputs");
const dataDir = path.join(root, "data");
const publicDir = path.join(root, "public");

const platforms = {
  "skills-sh": ["Skills.sh", "skills.sh"],
  github: ["GitHub", "github.com"],
  "mcp-market": ["MCP Market", "mcpmarket.com"],
  smithery: ["Smithery", "smithery.ai"],
  "agentskills-in": ["AgentSkills.in", "agentskills.in"]
};

const now = () => new Date().toISOString();
const compactNumber = (value) => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const text = String(value).replaceAll(",", "").trim();
  const match = text.match(/^([\d.]+)\s*([kKmM])?/);
  if (!match) return Number(text.replace(/[^\d.]/g, "")) || 0;
  const n = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  if (suffix === "m") return Math.round(n * 1_000_000);
  if (suffix === "k") return Math.round(n * 1_000);
  return Math.round(n);
};
const stripHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const category = (text = "") => {
  const value = text.toLowerCase();
  if (value.includes("browser") || value.includes("playwright")) return "Browser Automation";
  if (value.includes("data") || value.includes("search") || value.includes("analytics")) return "Data Analysis";
  if (value.includes("mcp") || value.includes("server") || value.includes("filesystem")) return "MCP";
  if (value.includes("workflow") || value.includes("agent")) return "Agent Workflow";
  if (value.includes("research") || value.includes("docs")) return "Research";
  return "Coding";
};
const isAgentSkillRelevant = (item) => {
  const haystack = [
    item.name,
    item.full_name,
    item.description,
    ...(item.topics || []),
    ...(item.tags || [])
  ]
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
};
const score = (item) =>
  Math.round(
    (Math.log10((item.downloads || 0) + 10) * 28 +
      Math.log10((item.installs || 0) + 10) * 24 +
      Math.log10((item.stars || 0) + 10) * 21 +
      Math.log10((item.views || 0) + 10) * 16) *
      10
  );
const skill = (item) => ({
  ...item,
  id: item.id || `${item.platform}-${item.name}-${item.sourceUrl}`,
  createdAt: item.createdAt || now(),
  updatedAt: item.updatedAt || now(),
  rankDelta: 0,
  isNewEntrant: false,
  trendingScore: score(item)
});
const fetchText = async (url) => {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "agent-skills-hotlist/0.1",
      Accept: "text/html,application/json"
    }
  });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.text();
};
const fetchJson = async (url, headers = {}) => {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
};
const extractJsonLd = (html) => {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  return blocks.flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1]);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });
};
const skillsShInstallCount = async (url) => {
  try {
    const html = await fetchText(url);
    for (const item of extractJsonLd(html)) {
      const stat = item.interactionStatistic;
      if (stat?.userInteractionCount) return Number(stat.userInteractionCount) || 0;
    }
  } catch {}
  return 0;
};

async function collectSkillsSh() {
  const token = process.env.SKILLS_SH_TOKEN || process.env.VERCEL_OIDC_TOKEN;
  if (token) {
    const json = await fetchJson("https://skills.sh/api/v1/skills?view=trending&per_page=100", {
      Authorization: `Bearer ${token}`
    });
    return (json.data || []).map((item) =>
      skill({
        name: item.name || item.slug,
        description: `Real Skills.sh API result from ${item.source}.`,
        platform: "skills-sh",
        sourceUrl: item.url,
        tags: ["skills.sh", ...(item.source || "").split("/")].filter(Boolean),
        category: category(`${item.name} ${item.source}`),
        downloads: item.installs || 0,
        installs: item.installs || 0,
        stars: 0,
        views: item.installs || 0
      })
    );
  }

  const html = await fetchText("https://www.skills.sh/trending");
  const seen = new Set();
  const hrefs = [...html.matchAll(/href="(\/[^"]+\/[^"]+[^"]*)"/g)].map((m) => m[1]);
  const candidates = [];
  for (const href of hrefs) {
    if (href.includes("/docs") || href.includes("/api") || seen.has(href)) continue;
    if (href.includes("?") || href.includes(".svg") || href.includes(".png") || href.includes(".ico")) continue;
    const parts = href.split("/").filter(Boolean);
    if (parts.length < 2 || parts.length > 3) continue;
    if (parts[0] === "agent" || parts[0] === "agents" || parts[0] === "_next") continue;
    seen.add(href);
    candidates.push({ href, parts, name: parts.at(-1), sourceUrl: `https://skills.sh${href}` });
    if (candidates.length >= 60) break;
  }

  const rows = await Promise.all(
    candidates.map(async ({ href, parts, name, sourceUrl }) => {
      const installs = await skillsShInstallCount(sourceUrl);
      return skill({
        name,
        description: `Real Skills.sh listing at ${href}. Installs are parsed from the page's public schema.org InstallAction metadata.`,
        platform: "skills-sh",
        sourceUrl,
        tags: ["skills.sh", ...parts.slice(0, 2)],
        category: category(parts.join(" ")),
        downloads: installs,
        installs,
        stars: 0,
        views: installs,
        metricEvidence: {
          installs: { source: "Skills.sh JSON-LD", url: sourceUrl },
          downloads: { source: "Skills.sh installs used as install/download signal", url: sourceUrl }
        }
      });
    })
  );

  return rows.slice(0, 60);
}

async function collectGithub() {
  const q = encodeURIComponent('"agent skills" OR "claude skills" OR "mcp server" OR "codex skill" in:readme,description');
  const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const json = await fetchJson(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=50`, headers);
  return (json.items || [])
    .filter(isAgentSkillRelevant)
    .map((item) =>
      skill({
        name: item.full_name,
        description: item.description || "Real GitHub Search API result for agent skill related terms.",
        platform: "github",
        sourceUrl: item.html_url,
        tags: ["github", ...(item.topics || []).slice(0, 4)],
        category: category(`${item.name} ${item.description || ""} ${(item.topics || []).join(" ")}`),
        downloads: 0,
        installs: 0,
        stars: item.stargazers_count || 0,
        views: (item.watchers_count || 0) + (item.forks_count || 0),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        metricEvidence: {
          stars: { source: "GitHub Search API stargazers_count", url: item.html_url }
        }
      })
    );
}

async function collectSmithery() {
  if (!process.env.SMITHERY_API_KEY) return collectSmitheryPublic();
  const json = await fetchJson("https://registry.smithery.ai/servers?pageSize=100&topK=500", {
    Authorization: `Bearer ${process.env.SMITHERY_API_KEY}`
  });
  return (json.servers || []).map((item) =>
    skill({
      name: item.displayName || item.qualifiedName,
      description: item.description || "Real Smithery registry API server.",
      platform: "smithery",
      sourceUrl: item.homepage || `https://smithery.ai/server/${item.qualifiedName}`,
      tags: ["smithery", item.verified ? "verified" : "community"],
      category: category(`${item.displayName} ${item.description}`),
      downloads: item.useCount || 0,
      installs: item.useCount || 0,
      stars: 0,
      views: item.useCount || 0,
      createdAt: item.createdAt,
      metricEvidence: {
        installs: { source: "Smithery API useCount", url: item.homepage || `https://smithery.ai/server/${item.qualifiedName}` },
        downloads: { source: "Smithery API useCount", url: item.homepage || `https://smithery.ai/server/${item.qualifiedName}` }
      }
    })
  );
}

async function collectSmitheryPublic() {
  const html = await fetchText("https://smithery.ai/servers");
  const rows = [];
  const seen = new Set();
  const pattern = /qualifiedName\\":\\"([^"\\]+)[\s\S]{0,1200}?displayName\\":\\"([^"\\]*)[\s\S]{0,1200}?description\\":\\"([^"\\]*)[\s\S]{0,1200}?useCount\\":(\d+)/g;
  for (const match of html.matchAll(pattern)) {
    const [, qualifiedName, displayName, description, useCountText] = match;
    if (seen.has(qualifiedName)) continue;
    seen.add(qualifiedName);
    const useCount = Number(useCountText) || 0;
    const url = `https://smithery.ai/server/${qualifiedName}`;
    rows.push(
      skill({
        name: displayName || qualifiedName,
        description: description.replaceAll('\\"', '"') || "Real Smithery public listing parsed from the servers page.",
        platform: "smithery",
        sourceUrl: url,
        tags: ["smithery", "mcp"],
        category: category(`${displayName} ${description}`),
        downloads: useCount,
        installs: useCount,
        stars: 0,
        views: useCount,
        metricEvidence: {
          installs: { source: "Smithery public page useCount", url },
          downloads: { source: "Smithery public page useCount", url }
        }
      })
    );
  }
  return rows.slice(0, 100);
}

async function collectMcpMarket() {
  const html = await fetchText("https://mcpmarket.com/");
  const rows = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]+href="([^"]*(?:\/server\/|\/skill\/)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = match[1];
    if (seen.has(href)) continue;
    seen.add(href);
    const text = stripHtml(match[2]);
    if (!text || text.length < 3) continue;
    rows.push(
      skill({
        name: text.split(/\s+/).slice(0, 5).join(" "),
        description: text.slice(0, 320) || "Real MCP Market public listing.",
        platform: "mcp-market",
        sourceUrl: href.startsWith("http") ? href : `https://mcpmarket.com${href}`,
        tags: ["mcp-market", "mcp"],
        category: category(text),
        downloads: compactNumber(text.match(/([\d.]+[kKmM]?)\s*$/)?.[1]),
        installs: 0,
        stars: 0,
        views: 0
      })
    );
  }
  return rows.slice(0, 100);
}

async function collectAgentSkillsIn() {
  const html = await fetchText("https://www.agentskills.in/marketplace");
  const rows = [];
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        const name = item.name || item.headline;
        if (!name) continue;
        rows.push(
          skill({
            name,
            description: item.description || "Real AgentSkills.in marketplace metadata item.",
            platform: "agentskills-in",
            sourceUrl: item.url || "https://www.agentskills.in/marketplace",
            tags: ["agentskills.in"],
            category: category(`${name} ${item.description || ""}`),
            downloads: 0,
            installs: 0,
            stars: 0,
            views: 0
          })
        );
      }
    } catch {}
  }
  return rows.slice(0, 100);
}

function html(skills) {
  const generatedAt = now();
  const platformJson = JSON.stringify(platforms);
  const skillsJson = JSON.stringify(skills).replaceAll("</script", "<\\/script");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Agent Skills Hotlist</title><style>*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,rgba(15,118,110,.12),transparent 34%),linear-gradient(215deg,rgba(226,95,75,.12),transparent 30%),#f7f7f4;color:#111827}.wrap{max-width:1240px;margin:auto;padding:22px}.head{display:grid;gap:20px;grid-template-columns:1.1fr .9fr;align-items:end;border-bottom:1px solid rgba(17,24,39,.1);padding-bottom:22px}.eyebrow{color:#0f766e;font-weight:750;font-size:14px}.head h1{margin:10px 0;font-size:48px;line-height:1.04}.head p{max-width:780px;color:rgba(17,24,39,.7);line-height:1.75}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.bar,.row{border:1px solid rgba(17,24,39,.1);border-radius:8px;background:rgba(255,255,255,.86)}.stat{padding:12px}.stat span{display:block;color:rgba(17,24,39,.45);font-size:12px;font-weight:750;text-transform:uppercase}.stat strong{display:block;margin-top:4px;font-size:24px}.bar{display:grid;grid-template-columns:1.4fr .8fr .8fr .8fr auto;gap:10px;padding:12px;margin:18px 0;box-shadow:0 18px 60px rgba(17,24,39,.08)}input,select,button{font:inherit}input,select{width:100%;height:44px;border:1px solid rgba(17,24,39,.1);border-radius:7px;background:#f7f7f4;padding:0 12px;color:#111827}.toggle{display:grid;grid-template-columns:1fr 1fr;background:#f7f7f4;border:1px solid rgba(17,24,39,.1);border-radius:7px;padding:4px}button{border:0;border-radius:5px;background:transparent;font-weight:750;color:rgba(17,24,39,.62);cursor:pointer}.on{background:#111827;color:white}.list{display:grid;gap:12px}.row{display:grid;grid-template-columns:72px 1fr 220px 52px;gap:14px;align-items:center;padding:16px;background:#fff}.rank{width:44px;height:44px;border-radius:7px;display:grid;place-items:center;font-weight:850;background:rgba(17,24,39,.05);color:rgba(17,24,39,.7)}.rank.top{background:#e25f4b;color:white}.rank.ten{background:rgba(217,162,27,.2);color:#111827}.title{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.title h2{font-size:18px;margin:0;overflow-wrap:anywhere}.desc{margin:6px 0 9px;color:rgba(17,24,39,.66);line-height:1.55}.tag{display:inline-block;border:1px solid rgba(17,24,39,.1);border-radius:5px;padding:4px 8px;margin:2px;color:rgba(17,24,39,.55);font-size:12px;font-weight:650}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{background:#f7f7f4;border-radius:6px;padding:8px}.metric small{display:block;color:rgba(17,24,39,.42);font-size:11px;text-transform:uppercase;font-weight:800}.metric b{color:#6d3c74}.plat{display:flex;align-items:center;gap:7px;color:rgba(17,24,39,.55);font-size:12px;font-weight:800}.plat img{width:24px;height:24px;border:1px solid rgba(17,24,39,.1);border-radius:6px;background:#f7f7f4;padding:3px}.open{width:42px;height:42px;border:1px solid rgba(17,24,39,.1);border-radius:7px;display:grid;place-items:center;text-decoration:none;color:#111827}@media(max-width:900px){.head,.bar,.row{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.head h1{font-size:36px}.metrics{grid-template-columns:repeat(4,1fr)}}@media(max-width:520px){.wrap{padding:14px}.metrics{grid-template-columns:repeat(2,1fr)}.head h1{font-size:30px}}</style></head><body><main class="wrap"><section class="head"><div><div class="eyebrow">Daily real-data agent skill ranking</div><h1>AI Agent Skills 热度聚合榜</h1><p>真实数据源：Skills.sh、GitHub Search API、MCP Market、Smithery Registry API、AgentSkills.in。更新时间：${generatedAt}</p></div><div class="stats"><div class="stat"><span>Skills</span><strong id="s-count">0</strong></div><div class="stat"><span>Signals</span><strong id="s-down">0</strong></div><div class="stat"><span>Platforms</span><strong id="s-platforms">0</strong></div><div class="stat"><span>Updated</span><strong>${generatedAt.slice(5,10)}</strong></div></div></section><section class="bar"><input id="q" placeholder="Search name, description, tags, platform"><select id="platform"><option value="all">All platforms</option></select><select id="category"><option value="all">All categories</option></select><select id="sort"><option value="trending">Trending</option><option value="downloads">Downloads</option><option value="stars">Stars</option><option value="newest">Newest</option><option value="updated">Updated</option></select><div class="toggle"><button id="top50" class="on">Top 50</button><button id="top100">Top 100</button></div></section><section id="list" class="list"></section></main><script>const plats=${platformJson};const skills=${skillsJson};let limit=50;const fmt=n=>Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(n||0);const cats=[...new Set(skills.map(s=>s.category))].sort();for(const [id,p] of Object.entries(plats)) platform.add(new Option(p[0],id));for(const c of cats) category.add(new Option(c,c));document.getElementById("s-count").textContent=skills.length;document.getElementById("s-down").textContent=fmt(skills.reduce((a,s)=>a+s.downloads+s.installs+s.stars+s.views,0));document.getElementById("s-platforms").textContent=new Set(skills.map(s=>s.platform)).size;top50.onclick=()=>{limit=50;top50.className="on";top100.className="";render()};top100.onclick=()=>{limit=100;top100.className="on";top50.className="";render()};q.oninput=platform.onchange=category.onchange=sort.onchange=render;function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function render(){const term=q.value.toLowerCase().trim();let rows=skills.filter(s=>(!term||[s.name,s.description,s.category,plats[s.platform]?.[0],s.platform,...s.tags].join(" ").toLowerCase().includes(term))&&(platform.value==="all"||s.platform===platform.value)&&(category.value==="all"||s.category===category.value));rows.sort((a,b)=>sort.value==="downloads"?b.downloads-a.downloads:sort.value==="stars"?b.stars-a.stars:sort.value==="newest"?new Date(b.createdAt)-new Date(a.createdAt):sort.value==="updated"?new Date(b.updatedAt)-new Date(a.updatedAt):b.trendingScore-a.trendingScore);list.innerHTML=rows.slice(0,limit).map((s,i)=>\`<article class="row"><div class="rank \${i<3?"top":i<10?"ten":""}">#\${i+1}</div><div><div class="title"><h2>\${esc(s.name)}</h2></div><p class="desc">\${esc(s.description)}</p><span class="tag">\${esc(s.category)}</span>\${s.tags.slice(0,3).map(t=>\`<span class="tag">\${esc(t)}</span>\`).join("")}</div><div class="metrics"><div class="metric"><small>Score</small><b>\${fmt(s.trendingScore)}</b></div><div class="metric"><small>Downloads</small><b>\${fmt(s.downloads)}</b></div><div class="metric"><small>Installs</small><b>\${fmt(s.installs)}</b></div><div class="metric"><small>Stars</small><b>\${fmt(s.stars)}</b></div></div><div><div class="plat"><img src="https://www.google.com/s2/favicons?domain=\${esc(plats[s.platform]?.[1]||'github.com')}&sz=64" alt="">\${esc(plats[s.platform]?.[0]||s.platform)}</div><a class="open" href="\${esc(s.sourceUrl)}" target="_blank" rel="noreferrer">↗</a></div></article>\`).join("")}render();</script></body></html>`;
}

function htmlWithEvidence(skills, unrankedCount) {
  const generatedAt = now();
  const platformJson = JSON.stringify(platforms);
  const skillsJson = JSON.stringify(skills).replaceAll("</script", "<\\/script");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AI Agent Skills Hotlist</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7f7f4;color:#111827}.wrap{max-width:1240px;margin:auto;padding:22px}.head{display:grid;gap:20px;grid-template-columns:1.1fr .9fr;align-items:end;border-bottom:1px solid rgba(17,24,39,.1);padding-bottom:22px}.eyebrow{color:#0f766e;font-weight:750;font-size:14px}.head h1{margin:10px 0;font-size:48px;line-height:1.04}.head p{max-width:840px;color:rgba(17,24,39,.7);line-height:1.7}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.bar,.row,.note{border:1px solid rgba(17,24,39,.1);border-radius:8px;background:rgba(255,255,255,.9)}.stat{padding:12px}.stat span{display:block;color:rgba(17,24,39,.45);font-size:12px;font-weight:750;text-transform:uppercase}.stat strong{display:block;margin-top:4px;font-size:24px}.bar{display:grid;grid-template-columns:1.4fr .8fr .8fr .8fr auto;gap:10px;padding:12px;margin:18px 0}.note{padding:12px 14px;color:rgba(17,24,39,.68);font-size:13px;line-height:1.6}input,select,button{font:inherit}input,select{width:100%;height:44px;border:1px solid rgba(17,24,39,.1);border-radius:7px;background:#f7f7f4;padding:0 12px;color:#111827}.toggle{display:grid;grid-template-columns:1fr 1fr;background:#f7f7f4;border:1px solid rgba(17,24,39,.1);border-radius:7px;padding:4px}button{border:0;border-radius:5px;background:transparent;font-weight:750;color:rgba(17,24,39,.62);cursor:pointer}.on{background:#111827;color:white}.list{display:grid;gap:12px}.row{display:grid;grid-template-columns:72px minmax(0,1fr) 420px 52px;gap:14px;align-items:center;padding:16px;background:#fff}.rank{width:44px;height:44px;border-radius:7px;display:grid;place-items:center;font-weight:850;background:rgba(17,24,39,.05);color:rgba(17,24,39,.7)}.rank.top{background:#e25f4b;color:white}.rank.ten{background:rgba(217,162,27,.2);color:#111827}.title{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.title h2{font-size:18px;margin:0;overflow-wrap:anywhere}.desc{margin:6px 0 9px;color:rgba(17,24,39,.66);line-height:1.55}.tag{display:inline-block;border:1px solid rgba(17,24,39,.1);border-radius:5px;padding:4px 8px;margin:2px;color:rgba(17,24,39,.55);font-size:12px;font-weight:650}.meta-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{background:#f7f7f4;border-radius:6px;padding:8px;min-height:62px}.metric small{display:block;color:rgba(17,24,39,.42);font-size:11px;text-transform:uppercase;font-weight:800}.metric b{color:#6d3c74}.metric em{display:block;margin-top:2px;color:rgba(17,24,39,.46);font-style:normal;font-size:10px;line-height:1.25}.metric.muted b{color:rgba(17,24,39,.35)}.plat{display:inline-flex;align-items:center;gap:7px;color:rgba(17,24,39,.55);font-size:12px;font-weight:800;border:1px solid rgba(17,24,39,.1);border-radius:6px;padding:4px 8px;background:#f7f7f4}.plat img{width:18px;height:18px}.open{width:42px;height:42px;border:1px solid rgba(17,24,39,.1);border-radius:7px;display:grid;place-items:center;text-decoration:none;color:#111827}@media(max-width:1100px){.row{grid-template-columns:60px minmax(0,1fr)}.metrics{grid-column:2;grid-template-columns:repeat(4,1fr)}.open{grid-column:2;justify-self:start}}@media(max-width:900px){.head,.bar{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.head h1{font-size:36px}.row{grid-template-columns:1fr}.metrics{grid-column:auto;grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.wrap{padding:14px}.head h1{font-size:30px}}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="head">
      <div><div class="eyebrow">Daily real-data agent skill ranking</div><h1>AI Agent Skills 热度聚合榜</h1><p>排名只使用可证明指标：Skills.sh installs/download signal、GitHub stars、Smithery useCount、MCP Market downloads。没有任何指标的条目不会进入排行榜。更新时间：${generatedAt}</p></div>
      <div class="stats"><div class="stat"><span>Ranked</span><strong id="s-count">0</strong></div><div class="stat"><span>Signals</span><strong id="s-down">0</strong></div><div class="stat"><span>Platforms</span><strong id="s-platforms">0</strong></div><div class="stat"><span>Unranked</span><strong>${unrankedCount}</strong></div></div>
    </section>
    <section class="note">MCP Market / Smithery 如果没有出现在榜单，不代表它们热度低，只代表本次抓取被限流或缺少可公开读取的指标。当前只把有 downloads、installs 或 stars 的条目纳入排名。</section>
    <section class="bar"><input id="q" placeholder="Search name, description, tags, platform"><select id="platform"><option value="all">All platforms</option></select><select id="category"><option value="all">All categories</option></select><select id="sort"><option value="trending">Trending</option><option value="downloads">Downloads</option><option value="stars">Stars</option><option value="newest">Newest</option><option value="updated">Updated</option></select><div class="toggle"><button id="top50" class="on">Top 50</button><button id="top100">Top 100</button></div></section>
    <section id="list" class="list"></section>
  </main>
  <script>
    const plats=${platformJson};const skills=${skillsJson};let limit=50;
    const fmt=n=>Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(n||0);
    const cats=[...new Set(skills.map(s=>s.category))].sort();
    for(const [id,p] of Object.entries(plats)) platform.add(new Option(p[0],id)); for(const c of cats) category.add(new Option(c,c));
    document.getElementById("s-count").textContent=skills.length; document.getElementById("s-down").textContent=fmt(skills.reduce((a,s)=>a+s.downloads+s.installs+s.stars,0)); document.getElementById("s-platforms").textContent=new Set(skills.map(s=>s.platform)).size;
    top50.onclick=()=>{limit=50;top50.className="on";top100.className="";render()}; top100.onclick=()=>{limit=100;top100.className="on";top50.className="";render()};
    q.oninput=platform.onchange=category.onchange=sort.onchange=render;
    function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
    function source(s,key){return s.metricEvidence?.[key]?.source || ""}
    function metric(s,key){if(key==="stars")return s.stars?fmt(s.stars):"N/A"; if(key==="installs")return s.installs?fmt(s.installs):"N/A"; if(key==="downloads")return s.downloads?fmt(s.downloads):"N/A"; return fmt(s.trendingScore)}
    function mbox(s,key,label){const val=metric(s,key);return '<div class="metric '+(val==="N/A"?'muted':'')+'"><small>'+label+'</small><b>'+val+'</b><em>'+esc(source(s,key)||'not available')+'</em></div>'}
    function render(){const term=q.value.toLowerCase().trim();let rows=skills.filter(s=>(!term||[s.name,s.description,s.category,plats[s.platform]?.[0],s.platform,...s.tags].join(" ").toLowerCase().includes(term))&&(platform.value==="all"||s.platform===platform.value)&&(category.value==="all"||s.category===category.value));rows.sort((a,b)=>sort.value==="downloads"?b.downloads-a.downloads:sort.value==="stars"?b.stars-a.stars:sort.value==="newest"?new Date(b.createdAt)-new Date(a.createdAt):sort.value==="updated"?new Date(b.updatedAt)-new Date(a.updatedAt):b.trendingScore-a.trendingScore);list.innerHTML=rows.slice(0,limit).map((s,i)=>\`<article class="row"><div class="rank \${i<3?"top":i<10?"ten":""}">#\${i+1}</div><div><div class="title"><h2>\${esc(s.name)}</h2></div><p class="desc">\${esc(s.description)}</p><div class="meta-line"><span class="plat"><img src="https://www.google.com/s2/favicons?domain=\${esc(plats[s.platform]?.[1]||'github.com')}&sz=64" alt="">\${esc(plats[s.platform]?.[0]||s.platform)}</span><span class="tag">\${esc(s.category)}</span>\${s.tags.slice(0,3).map(t=>\`<span class="tag">\${esc(t)}</span>\`).join("")}</div></div><div class="metrics"><div class="metric"><small>Score</small><b>\${fmt(s.trendingScore)}</b><em>weighted formula</em></div>\${mbox(s,"downloads","Downloads")}\${mbox(s,"installs","Installs")}\${mbox(s,"stars","Stars")}</div><a class="open" href="\${esc(s.sourceUrl)}" target="_blank" rel="noreferrer">↗</a></article>\`).join("")}
    render();
  </script>
</body>
</html>`;
}

const collectors = [
  ["skills-sh", collectSkillsSh],
  ["github", collectGithub],
  ["mcp-market", collectMcpMarket],
  ["smithery", collectSmithery],
  ["agentskills-in", collectAgentSkillsIn]
];

const all = [];
for (const [name, collect] of collectors) {
  try {
    const rows = await collect();
    console.log(`[${name}] ${rows.length} rows`);
    all.push(...rows);
  } catch (error) {
    console.warn(`[${name}] ${error.message}`);
  }
}

const hasRankingMetric = (item) => (item.downloads || 0) + (item.installs || 0) + (item.stars || 0) > 0;
const unranked = [...new Map(all.map((item) => [item.sourceUrl, item])).values()].filter((item) => !hasRankingMetric(item));
const deduped = [...new Map(all.map((item) => [item.sourceUrl, item])).values()]
  .filter(hasRankingMetric)
  .sort((a, b) => b.trendingScore - a.trendingScore)
  .slice(0, 250);
if (!deduped.length) throw new Error("No rankable rows collected. Configure SKILLS_SH_TOKEN, SMITHERY_API_KEY, or GITHUB_TOKEN.");

const generatedAt = now();
const snapshot = { generatedAt, count: deduped.length, unrankedCount: unranked.length, rankingRule: "Only rows with downloads, installs, or stars greater than 0 are ranked.", skills: deduped };
fs.mkdirSync(path.join(dataDir, "snapshots"), { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "skills-latest.json"), JSON.stringify(snapshot, null, 2));
fs.writeFileSync(path.join(dataDir, "snapshots", `${generatedAt.slice(0, 10)}.json`), JSON.stringify(snapshot, null, 2));
fs.writeFileSync(path.join(publicDir, "index.html"), htmlWithEvidence(deduped, unranked.length));
fs.writeFileSync(path.join(outputDir, "ai-agent-skills-hotlist-preview.html"), htmlWithEvidence(deduped, unranked.length));
console.log(`Wrote ${deduped.length} rankable real skills. Excluded ${unranked.length} rows with no ranking metric.`);
