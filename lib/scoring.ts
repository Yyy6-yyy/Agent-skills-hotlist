import type { Skill } from "./types";

export function computeTrendingScore(
  metrics: Pick<Skill, "downloads" | "installs" | "stars" | "views" | "updatedAt" | "createdAt">
) {
  const updatedAgeDays = Math.max(
    1,
    (Date.now() - new Date(metrics.updatedAt).getTime()) / 86_400_000
  );
  const createdAgeDays = Math.max(
    1,
    (Date.now() - new Date(metrics.createdAt).getTime()) / 86_400_000
  );
  const freshnessBoost = 1 / Math.sqrt(updatedAgeDays);
  const launchBoost = createdAgeDays <= 30 ? 0.18 : 0;

  return Math.round(
    (Math.log10(metrics.downloads + 10) * 28 +
      Math.log10(metrics.installs + 10) * 24 +
      Math.log10(metrics.stars + 10) * 21 +
      Math.log10(metrics.views + 10) * 16) *
      (1 + freshnessBoost + launchBoost) *
      10
  );
}

export function hydrateScore<T extends Omit<Skill, "trendingScore">>(skill: T): T & Pick<Skill, "trendingScore"> {
  return {
    ...skill,
    trendingScore: computeTrendingScore(skill)
  };
}
