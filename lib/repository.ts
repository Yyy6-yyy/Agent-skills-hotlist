import path from "node:path";
import type { Skill } from "./types";

const dbPath = path.join(process.cwd(), "data", "skills.db");
const latestJsonPath = path.join(process.cwd(), "data", "skills-latest.json");

export async function getSkills(): Promise<Skill[]> {
  try {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db
      .prepare(
        `select id, name, description, platform, source_url as sourceUrl, tags, category,
          downloads, installs, stars, views, created_at as createdAt, updated_at as updatedAt,
          rank_delta as rankDelta, is_new_entrant as isNewEntrant, trending_score as trendingScore
        from skills
        order by trending_score desc
        limit 100`
      )
      .all() as Array<Omit<Skill, "tags" | "isNewEntrant"> & { tags: string; isNewEntrant: 0 | 1 }>;
    db.close();

    return rows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags),
      isNewEntrant: Boolean(row.isNewEntrant)
    }));
  } catch {
    try {
      const fs = await import("node:fs/promises");
      const snapshot = JSON.parse(await fs.readFile(latestJsonPath, "utf8")) as { skills?: Skill[] };
      return snapshot.skills?.slice(0, 100) ?? [];
    } catch {
      return [];
    }
  }
}

export function getSnapshotStats(skills: Skill[]) {
  const newEntrants = skills.filter((skill) => skill.isNewEntrant).length;
  const biggestMovers = skills.filter((skill) => skill.rankDelta >= 10).length;
  const totalDownloads = skills.reduce((total, skill) => total + skill.downloads, 0);

  return {
    totalSkills: skills.length,
    newEntrants,
    biggestMovers,
    totalDownloads
  };
}
