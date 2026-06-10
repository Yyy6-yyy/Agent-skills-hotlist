import fs from "node:fs";
import path from "node:path";
import { platforms } from "../lib/platforms";
import type { Skill } from "../lib/types";

const repoRoot = process.cwd();
const externalOutputsDir = path.resolve(repoRoot, "..", "..", "outputs");
const publicDir = path.join(repoRoot, "public");

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlTemplate(skills: Skill[], generatedAt: string) {
  const platformJson = JSON.stringify(Object.fromEntries(platforms.map((item) => [item.id, [item.label, item.domain]])));
  const skillsJson = JSON.stringify(skills).replaceAll("</script", "<\\/script");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI Agent Skills Hotlist</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,rgba(15,118,110,.12),transparent 34%),linear-gradient(215deg,rgba(226,95,75,.12),transparent 30%),#f7f7f4;color:#111827}.wrap{max-width:1240px;margin:auto;padding:22px}.head{display:grid;gap:20px;grid-template-columns:1.1fr .9fr;align-items:end;border-bottom:1px solid rgba(17,24,39,.1);padding-bottom:22px}.eyebrow{display:flex;gap:8px;align-items:center;color:#0f766e;font-weight:750;font-size:14px}.head h1{margin:10px 0;font-size:48px;line-height:1.04;letter-spacing:0}.head p{max-width:780px;color:rgba(17,24,39,.7);line-height:1.75}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.bar,.row{border:1px solid rgba(17,24,39,.1);border-radius:8px;background:rgba(255,255,255,.86)}.stat{padding:12px}.stat span{display:block;color:rgba(17,24,39,.45);font-size:12px;font-weight:750;text-transform:uppercase}.stat strong{display:block;margin-top:4px;font-size:24px}.bar{display:grid;grid-template-columns:1.4fr .8fr .8fr .8fr auto;gap:10px;padding:12px;margin:18px 0;box-shadow:0 18px 60px rgba(17,24,39,.08)}input,select,button{font:inherit}input,select{width:100%;height:44px;border:1px solid rgba(17,24,39,.1);border-radius:7px;background:#f7f7f4;padding:0 12px;color:#111827}.toggle{display:grid;grid-template-columns:1fr 1fr;background:#f7f7f4;border:1px solid rgba(17,24,39,.1);border-radius:7px;padding:4px}button{border:0;border-radius:5px;background:transparent;font-weight:750;color:rgba(17,24,39,.62);cursor:pointer}.on{background:#111827;color:white}.list{display:grid;gap:12px}.row{display:grid;grid-template-columns:72px 1fr 220px 52px;gap:14px;align-items:center;padding:16px;background:#fff}.rank{width:44px;height:44px;border-radius:7px;display:grid;place-items:center;font-weight:850;background:rgba(17,24,39,.05);color:rgba(17,24,39,.7)}.rank.top{background:#e25f4b;color:white}.rank.ten{background:rgba(217,162,27,.2);color:#111827}.title{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.title h2{font-size:18px;margin:0;overflow-wrap:anywhere}.desc{margin:6px 0 9px;color:rgba(17,24,39,.66);line-height:1.55}.tag{display:inline-block;border:1px solid rgba(17,24,39,.1);border-radius:5px;padding:4px 8px;margin:2px;color:rgba(17,24,39,.55);font-size:12px;font-weight:650}.pill{border-radius:5px;background:rgba(15,118,110,.1);color:#0f766e;padding:4px 7px;font-size:12px;font-weight:800}.move{border-radius:5px;background:rgba(17,24,39,.06);padding:4px 7px;font-size:12px;font-weight:800}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{background:#f7f7f4;border-radius:6px;padding:8px}.metric small{display:block;color:rgba(17,24,39,.42);font-size:11px;text-transform:uppercase;font-weight:800}.metric b{color:#6d3c74}.plat{display:flex;align-items:center;gap:7px;color:rgba(17,24,39,.55);font-size:12px;font-weight:800}.plat img{width:24px;height:24px;border:1px solid rgba(17,24,39,.1);border-radius:6px;background:#f7f7f4;padding:3px}.open{width:42px;height:42px;border:1px solid rgba(17,24,39,.1);border-radius:7px;display:grid;place-items:center;text-decoration:none;color:#111827}.empty{padding:24px;border:1px dashed rgba(17,24,39,.2);border-radius:8px;color:rgba(17,24,39,.65);background:rgba(255,255,255,.75)}@media(max-width:900px){.head,.bar,.row{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.head h1{font-size:36px}.metrics{grid-template-columns:repeat(4,1fr)}}@media(max-width:520px){.wrap{padding:14px}.metrics{grid-template-columns:repeat(2,1fr)}.head h1{font-size:30px}}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="head">
      <div><div class="eyebrow">Daily real-data agent skill ranking</div><h1>AI Agent Skills 热度聚合榜</h1><p>真实数据源：Skills.sh API/公开榜单、GitHub Search API、MCP Market 公开页面、Smithery Registry API、AgentSkills.in Marketplace。更新时间：${escapeHtml(generatedAt)}</p></div>
      <div class="stats"><div class="stat"><span>Skills</span><strong id="s-count">0</strong></div><div class="stat"><span>Signals</span><strong id="s-down">0</strong></div><div class="stat"><span>Platforms</span><strong id="s-platforms">0</strong></div><div class="stat"><span>Updated</span><strong>${escapeHtml(generatedAt.slice(5, 10))}</strong></div></div>
    </section>
    <section class="bar">
      <input id="q" placeholder="Search name, description, tags, platform" />
      <select id="platform"><option value="all">All platforms</option></select>
      <select id="category"><option value="all">All categories</option></select>
      <select id="sort"><option value="trending">Trending</option><option value="downloads">Downloads</option><option value="stars">Stars</option><option value="newest">Newest</option><option value="updated">Updated</option></select>
      <div class="toggle"><button id="top50" class="on">Top 50</button><button id="top100">Top 100</button></div>
    </section>
    <section id="list" class="list"></section>
  </main>
  <script>
    const plats=${platformJson};
    const skills=${skillsJson};
    let limit=50;
    const fmt=n=>Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(n||0);
    const cats=[...new Set(skills.map(s=>s.category))].sort();
    for(const [id,p] of Object.entries(plats)) platform.add(new Option(p[0],id)); for(const c of cats) category.add(new Option(c,c));
    document.getElementById("s-count").textContent=skills.length; document.getElementById("s-down").textContent=fmt(skills.reduce((a,s)=>a+s.downloads+s.installs+s.stars+s.views,0)); document.getElementById("s-platforms").textContent=new Set(skills.map(s=>s.platform)).size;
    top50.onclick=()=>{limit=50;top50.className="on";top100.className="";render()}; top100.onclick=()=>{limit=100;top100.className="on";top50.className="";render()};
    q.oninput=platform.onchange=category.onchange=sort.onchange=render;
    function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
    function render(){const term=q.value.toLowerCase().trim();let rows=skills.filter(s=>(!term||[s.name,s.description,s.category,plats[s.platform]?.[0],s.platform,...s.tags].join(" ").toLowerCase().includes(term))&&(platform.value==="all"||s.platform===platform.value)&&(category.value==="all"||s.category===category.value)); rows.sort((a,b)=>sort.value==="downloads"?b.downloads-a.downloads:sort.value==="stars"?b.stars-a.stars:sort.value==="newest"?new Date(b.createdAt)-new Date(a.createdAt):sort.value==="updated"?new Date(b.updatedAt)-new Date(a.updatedAt):b.trendingScore-a.trendingScore); if(!rows.length){list.innerHTML='<div class="empty">No real rows collected yet. Run npm run update:data with network access and API keys where required.</div>';return} list.innerHTML=rows.slice(0,limit).map((s,i)=>\`<article class="row"><div class="rank \${i<3?"top":i<10?"ten":""}">#\${i+1}</div><div><div class="title"><h2>\${esc(s.name)}</h2>\${s.isNewEntrant?'<span class="pill">New</span>':""}\${s.rankDelta?'<span class="move">'+(s.rankDelta>0?"↑":"↓")+' '+Math.abs(s.rankDelta)+'</span>':""}</div><p class="desc">\${esc(s.description)}</p><span class="tag">\${esc(s.category)}</span>\${s.tags.slice(0,3).map(t=>\`<span class="tag">\${esc(t)}</span>\`).join("")}</div><div class="metrics"><div class="metric"><small>Score</small><b>\${fmt(s.trendingScore)}</b></div><div class="metric"><small>Downloads</small><b>\${fmt(s.downloads)}</b></div><div class="metric"><small>Installs</small><b>\${fmt(s.installs)}</b></div><div class="metric"><small>Stars</small><b>\${fmt(s.stars)}</b></div></div><div><div class="plat"><img src="https://www.google.com/s2/favicons?domain=\${esc(plats[s.platform]?.[1]||'github.com')}&sz=64" alt="">\${esc(plats[s.platform]?.[0]||s.platform)}</div><a class="open" href="\${esc(s.sourceUrl)}" target="_blank" rel="noreferrer" aria-label="open">↗</a></div></article>\`).join("")}
    render();
  </script>
</body>
</html>`;
}

export function writeStaticOutputs(skills: Skill[]) {
  const generatedAt = new Date().toISOString();
  const ranked = [...skills].sort((a, b) => b.trendingScore - a.trendingScore);
  const snapshotDate = generatedAt.slice(0, 10);
  const snapshot = {
    generatedAt,
    count: ranked.length,
    skills: ranked
  };

  fs.mkdirSync(path.join(repoRoot, "data", "snapshots"), { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "data", "skills-latest.json"), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(repoRoot, "data", "snapshots", `${snapshotDate}.json`), JSON.stringify(snapshot, null, 2));

  const html = htmlTemplate(ranked, generatedAt);
  fs.writeFileSync(path.join(publicDir, "index.html"), html);

  try {
    fs.mkdirSync(externalOutputsDir, { recursive: true });
    fs.writeFileSync(path.join(externalOutputsDir, "ai-agent-skills-hotlist-preview.html"), html);
  } catch {
    // The external outputs directory only exists in the Codex desktop workspace.
  }
}
