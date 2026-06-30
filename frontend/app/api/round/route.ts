import { NextResponse } from "next/server";
import { getRoundStatus, hasFootballKey } from "@/lib/server/football";

export const revalidate = 60;

export async function GET() {
  if (!hasFootballKey()) return NextResponse.json({ round: null, nations: {} });
  try {
    const data = (await getRoundStatus()) ?? { round: null, nations: {} };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ round: null, nations: {}, error: (err as Error).message }, { status: 502 });
  }
}
