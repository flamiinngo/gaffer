import { NextResponse } from "next/server";
import { readAllContests } from "@/lib/server/contract";

export const revalidate = 15;

export async function GET() {
  try {
    const contests = await readAllContests();
    return NextResponse.json({ contests });
  } catch (err) {
    return NextResponse.json(
      { contests: [], error: (err as Error).message },
      { status: 502 }
    );
  }
}
