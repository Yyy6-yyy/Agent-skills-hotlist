import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Skill } from "../lib/types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "skills.db");

export function openWritableDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    create table if not exists skills (
      id text primary key,
      name text not null,
      description text not null,
      platform text not null,
      source_url text not null,
      tags text not null,
      category text not null,
      downloads integer not null,
      installs integer not null,
      stars integer not null,
      views integer not null,
      created_at text not null,
      updated_at text not null,
      rank_delta integer not null,
      is_new_entrant integer not null,
      trending_score integer not null,
      last_seen_at text not null
    );

    create table if not exists daily_snapshots (
      snapshot_date text not null,
      skill_id text not null,
      rank integer not null,
      trending_score integer not null,
      downloads integer not null,
      installs integer not null,
      stars integer not null,
      views integer not null,
      primary key (snapshot_date, skill_id)
    );
  `);
  return db;
}

export function upsertSkills(db: Database.Database, skills: Skill[]) {
  const statement = db.prepare(`
    insert into skills (
      id, name, description, platform, source_url, tags, category, downloads, installs,
      stars, views, created_at, updated_at, rank_delta, is_new_entrant, trending_score, last_seen_at
    ) values (
      @id, @name, @description, @platform, @sourceUrl, @tags, @category, @downloads, @installs,
      @stars, @views, @createdAt, @updatedAt, @rankDelta, @isNewEntrant, @trendingScore, @lastSeenAt
    )
    on conflict(id) do update set
      name = excluded.name,
      description = excluded.description,
      source_url = excluded.source_url,
      tags = excluded.tags,
      category = excluded.category,
      downloads = excluded.downloads,
      installs = excluded.installs,
      stars = excluded.stars,
      views = excluded.views,
      updated_at = excluded.updated_at,
      rank_delta = excluded.rank_delta,
      is_new_entrant = excluded.is_new_entrant,
      trending_score = excluded.trending_score,
      last_seen_at = excluded.last_seen_at
  `);

  const snapshot = db.prepare(`
    insert or replace into daily_snapshots (
      snapshot_date, skill_id, rank, trending_score, downloads, installs, stars, views
    ) values (
      @snapshotDate, @skillId, @rank, @trendingScore, @downloads, @installs, @stars, @views
    )
  `);

  const today = new Date().toISOString().slice(0, 10);
  const lastSeenAt = new Date().toISOString();
  const ranked = [...skills].sort((a, b) => b.trendingScore - a.trendingScore);

  const transaction = db.transaction(() => {
    for (const skill of ranked) {
      statement.run({
        ...skill,
        tags: JSON.stringify(skill.tags),
        isNewEntrant: skill.isNewEntrant ? 1 : 0,
        lastSeenAt
      });
    }

    ranked.forEach((skill, index) => {
      snapshot.run({
        snapshotDate: today,
        skillId: skill.id,
        rank: index + 1,
        trendingScore: skill.trendingScore,
        downloads: skill.downloads,
        installs: skill.installs,
        stars: skill.stars,
        views: skill.views
      });
    });
  });

  transaction();
}
