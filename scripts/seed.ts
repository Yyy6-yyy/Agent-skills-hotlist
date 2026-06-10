import { sampleSkills } from "../lib/sample-data";
import { openWritableDb, upsertSkills } from "./db";

const db = openWritableDb();
upsertSkills(db, sampleSkills);
db.close();

console.log(`Seeded ${sampleSkills.length} skills.`);
