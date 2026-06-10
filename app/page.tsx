import { HotlistApp } from "@/components/hotlist-app";
import { getSkills, getSnapshotStats } from "@/lib/repository";

export default async function Page() {
  const skills = await getSkills();
  const stats = getSnapshotStats(skills);

  return <HotlistApp initialSkills={skills} stats={stats} />;
}
