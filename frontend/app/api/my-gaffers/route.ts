import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { readUserGaffers } from "@/lib/server/contract";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json({ gaffers: [], error: "bad address" }, { status: 400 });
  }
  try {
    const gaffers = await readUserGaffers(address as `0x${string}`);
    return NextResponse.json({ gaffers });
  } catch (err) {
    return NextResponse.json({ gaffers: [], error: (err as Error).message }, { status: 502 });
  }
}
