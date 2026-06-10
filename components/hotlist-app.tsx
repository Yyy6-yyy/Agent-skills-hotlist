"use client";

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Filter,
  Flame,
  Github,
  Search,
  Sparkles
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { platformMap, platforms } from "@/lib/platforms";
import type { Skill, SortKey } from "@/lib/types";

interface Props {
  initialSkills: Skill[];
  stats: {
    totalSkills: number;
    newEntrants: number;
    biggestMovers: number;
    totalDownloads: number;
  };
}

const sortOptions: Array<{ label: string; value: SortKey }> = [
  { label: "Trending", value: "trending" },
  { label: "Downloads", value: "downloads" },
  { label: "Stars", value: "stars" },
  { label: "Newest", value: "newest" },
  { label: "Updated", value: "updated" }
];

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function HotlistApp({ initialSkills, stats }: Props) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("trending");
  const [limit, setLimit] = useState(50);

  const categories = useMemo(
    () => Array.from(new Set(initialSkills.map((skill) => skill.category))).sort(),
    [initialSkills]
  );

  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return initialSkills
      .filter((skill) => {
        const platformLabel = platformMap.get(skill.platform)?.label ?? skill.platform;
        const haystack = [
          skill.name,
          skill.description,
          skill.category,
          platformLabel,
          skill.platform,
          ...skill.tags
        ]
          .join(" ")
          .toLowerCase();

        return (
          (!normalized || haystack.includes(normalized)) &&
          (platform === "all" || skill.platform === platform) &&
          (category === "all" || skill.category === category)
        );
      })
      .sort((a, b) => {
        if (sort === "downloads") return b.downloads - a.downloads;
        if (sort === "stars") return b.stars - a.stars;
        if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        return b.trendingScore - a.trendingScore;
      })
      .slice(0, limit);
  }, [category, initialSkills, limit, platform, query, sort]);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="grid gap-4 border-b border-ink/10 pb-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal">
              <Flame className="h-4 w-4" aria-hidden="true" />
              Daily cross-platform agent skill ranking
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
              AI Agent Skills 热度聚合榜
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
              聚合 Skills.sh、GitHub、MCP Market、Smithery、AgentSkills.in，按下载量、安装量、Stars、访问热度和更新时间生成综合 Trending Score。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Skills" value={stats.totalSkills.toString()} />
            <Stat label="Downloads" value={formatCompact(stats.totalDownloads)} />
            <Stat label="New" value={stats.newEntrants.toString()} />
            <Stat label="Movers" value={stats.biggestMovers.toString()} />
          </div>
        </header>

        <section className="grid gap-3 rounded-md border border-ink/10 bg-white/80 p-3 shadow-soft backdrop-blur lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto]">
          <label className="flex h-11 items-center gap-2 rounded-md border border-ink/10 bg-paper px-3">
            <Search className="h-4 w-4 text-ink/50" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, description, tags, platform"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40"
            />
          </label>

          <Select label="Platform" icon={<Filter className="h-4 w-4" />} value={platform} onChange={setPlatform}>
            <option value="all">All platforms</option>
            {platforms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>

          <Select label="Category" value={category} onChange={setCategory}>
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>

          <Select label="Sort" value={sort} onChange={(value) => setSort(value as SortKey)}>
            {sortOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 rounded-md border border-ink/10 bg-paper p-1">
            {[50, 100].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLimit(value)}
                className={`h-9 rounded text-sm font-semibold transition ${
                  limit === value ? "bg-ink text-white" : "text-ink/60 hover:bg-ink/5"
                }`}
              >
                Top {value}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3">
          {filteredSkills.length ? (
            filteredSkills.map((skill, index) => <SkillRow key={skill.id} skill={skill} rank={index + 1} />)
          ) : (
            <div className="rounded-md border border-dashed border-ink/20 bg-white/80 p-6 text-sm leading-6 text-ink/65">
              No real data has been collected yet. Run npm run update:data with network access and API keys for sources that require authentication.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-white/80 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-normal text-ink/45">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function Select({
  label,
  icon,
  value,
  onChange,
  children
}: {
  label: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-md border border-ink/10 bg-paper px-3">
      {icon}
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function SkillRow({ skill, rank }: { skill: Skill; rank: number }) {
  const platform = platformMap.get(skill.platform);
  const rankColor =
    rank <= 3 ? "bg-coral text-white" : rank <= 10 ? "bg-saffron/20 text-ink" : "bg-ink/5 text-ink/70";

  return (
    <article className="grid gap-3 rounded-md border border-ink/10 bg-white p-4 shadow-sm transition hover:border-ink/20 md:grid-cols-[72px_1fr_220px_44px] md:items-center">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm font-bold ${rankColor}`}>
          #{rank}
        </div>
        <div className="md:hidden">
          <PlatformBadge skill={skill} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-lg font-semibold text-ink">{skill.name}</h2>
          {skill.isNewEntrant ? (
            <span className="inline-flex items-center gap-1 rounded bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              New
            </span>
          ) : null}
          {skill.rankDelta !== 0 ? (
            <span className="inline-flex items-center gap-1 rounded bg-ink/5 px-2 py-1 text-xs font-semibold text-ink/70">
              {skill.rankDelta > 0 ? <ArrowUp className="h-3 w-3 text-teal" /> : <ArrowDown className="h-3 w-3 text-coral" />}
              {Math.abs(skill.rankDelta)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-ink/65">{skill.description}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[skill.category, ...skill.tags.slice(0, 3)].map((tag) => (
            <span key={tag} className="rounded border border-ink/10 px-2 py-1 text-xs font-medium text-ink/55">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-sm md:grid-cols-2">
        <Metric label="Score" value={formatCompact(skill.trendingScore)} strong />
        <Metric label="Downloads" value={formatCompact(skill.downloads)} />
        <Metric label="Installs" value={formatCompact(skill.installs)} />
        <Metric label="Stars" value={formatCompact(skill.stars)} />
      </div>

      <div className="flex items-center justify-between gap-2 md:flex-col">
        <div className="hidden md:block">
          <PlatformBadge skill={skill} />
        </div>
        <a
          href={skill.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-ink/10 text-ink/70 transition hover:border-ink hover:text-ink"
          title={`Open ${skill.name}`}
          aria-label={`Open ${skill.name}`}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function PlatformBadge({ skill }: { skill: Skill }) {
  const platform = platformMap.get(skill.platform);
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/10 bg-paper"
        title={platform?.label}
      >
        {skill.platform === "github" ? (
          <Github className="h-5 w-5" aria-hidden="true" />
        ) : (
          <img src={platform?.iconUrl} alt="" className="h-5 w-5" />
        )}
      </span>
      <span className="hidden text-xs font-semibold text-ink/50 lg:inline">{platform?.label}</span>
    </div>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded bg-paper px-2 py-2">
      <div className="truncate text-[11px] font-semibold uppercase tracking-normal text-ink/40">{label}</div>
      <div className={`mt-0.5 truncate text-sm ${strong ? "font-bold text-plum" : "font-semibold text-ink/70"}`}>
        {value}
      </div>
    </div>
  );
}
