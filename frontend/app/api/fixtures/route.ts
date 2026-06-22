import { NextResponse } from "next/server";
import { getUpcomingFixtures, hasFootballKey } from "@/lib/server/football";

export const revalidate = 60;

export async function GET() {
  if (!hasFootballKey()) {
    return NextResponse.json({ fixtures: [], source: "none" });
  }
  try {
    const fixtures = (await getUpcomingFixtures(6)) ?? [];
    return NextResponse.json({ fixtures, source: "sofascore" });
  } catch (err) {
    return NextResponse.json({ fixtures: [], error: (err as Error).message }, { status: 502 });
  }
}
