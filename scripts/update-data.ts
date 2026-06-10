import { collectAllSkills } from "../lib/collectors";
import { openWritableDb, upsertSkills } from "./db";
import { writeStaticOutputs } from "./static-preview";

const skills = await collectAllSkills();
if (!skills.length) {
  throw new Error("No real skills were collected. Check network access, API keys, or scraper selectors.");
}

const db = openWritableDb();
upsertSkills(db, skills);
db.close();
writeStaticOutputs(skills);

console.log(`Updated ${skills.length} real skills at ${new Date().toISOString()}.`);
