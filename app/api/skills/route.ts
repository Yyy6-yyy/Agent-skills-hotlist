import { NextResponse } from "next/server";
import { getSkills } from "@/lib/repository";

export async function GET() {
  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    skills: await getSkills()
  });
}
