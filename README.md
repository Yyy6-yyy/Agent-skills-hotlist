# AI Agent Skills Hotlist

一个网页版 AI Agent Skills 热度聚合平台，使用 Next.js、TypeScript、TailwindCSS 和 SQLite。数据更新链路使用真实 API 和公开页面爬虫，不再使用 mock 榜单数据。

## 功能

- 聚合 Skills.sh、GitHub、MCP Market、Smithery、AgentSkills.in。
- 展示 Top50 / Top100 热门 Skills。
- 每个 Skill 显示名称、简介、平台 icon、平台来源链接、标签、下载量、安装量、Stars、综合 Trending Score。
- 支持按 Name、Description、Tags、Platform 搜索。
- 支持 Platform、Category / Tags、Trending / Downloads / Stars / Newest / Updated 筛选排序。
- 支持新增入榜和排名上涨标记。
- 数据库保留 `daily_snapshots`，用于计算 New Entrants、Biggest Movers、Hot Skills Replaced。
- GitHub Actions 每日定时执行 `npm run update:data`。
- 每次更新会写入 SQLite、`data/skills-latest.json`、`data/snapshots/YYYY-MM-DD.json`，并生成可分享的 `public/index.html`。

## 本地运行

```bash
npm install
npm run update:data
npm run dev
```

打开 `http://localhost:3000`。

## 数据接入说明

`lib/collectors.ts` 已经接入真实来源：

- Skills.sh：优先官方 API；需要 `SKILLS_SH_TOKEN` 或 `VERCEL_OIDC_TOKEN`。没有 token 时尝试抓公开 trending 页面。
- GitHub：使用 GitHub Search API；建议设置 `GITHUB_TOKEN` 避免低限额。
- Smithery：使用官方 registry API；需要 `SMITHERY_API_KEY`。
- MCP Market：抓取公开页面里的 server/skill listing。
- AgentSkills.in：尝试解析 Marketplace 页面结构化数据；如果页面完全客户端渲染，会记录 skipped。

复制 `.env.example` 到 `.env.local` 后填入 key：

```bash
GITHUB_TOKEN=...
SKILLS_SH_TOKEN=...
SMITHERY_API_KEY=...
```

如果缺少某个平台的 key，更新任务不会造假；它会跳过该平台或使用公开页面爬虫，并在日志里说明。

## Trending Score

`lib/scoring.ts` 将 downloads、installs、stars、views、更新时间、新 Skill 加权为统一分数：

```ts
score = log(downloads) + log(installs) + log(stars) + log(views) + freshnessBoost
```

这个公式适合作为 MVP，后续可按平台可靠性、近 24 小时增长、7 日增长和去噪规则继续调参。

## GitHub Actions

`.github/workflows/update-skills.yml` 每天运行一次，并把 `public/index.html` 发布到 GitHub Pages。

在 GitHub 仓库里完成这些设置：

1. 进入 Settings -> Pages。
2. Source 选择 GitHub Actions。
3. 进入 Settings -> Secrets and variables -> Actions，按需配置下面的 secrets。

- `GITHUB_TOKEN`：GitHub Actions 默认提供，工作流已自动注入。
- `SKILLS_SH_TOKEN`：可选，用于 Skills.sh 官方 API。
- `SMITHERY_API_KEY`：可选，但 Smithery 官方 API 需要它。

任务成功后会提交：

- `data/skills.db`
- `data/skills-latest.json`
- `data/snapshots/*.json`
- `public/index.html`

部署成功后，别人访问 GitHub Pages 链接时看到的就是当天自动抓取后的真实数据，不需要你的电脑开机。
