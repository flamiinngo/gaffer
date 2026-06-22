import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseEther, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ogGalileo } from "@/lib/chain";

export const runtime = "nodejs";

const MIN_GAS = parseEther("0.003"); // enough to send a couple of txs
const DRIP = parseEther("0.02");

/** Sponsors a tiny amount of OG to a new (web2) wallet so it can deploy onchain. */
export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!isAddress(address)) return NextResponse.json({ error: "bad address" }, { status: 400 });

    const key = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
    if (!key) return NextResponse.json({ funded: false, reason: "no sponsor configured" });

    const pub = createPublicClient({ chain: ogGalileo, transport: http() });
    const bal = await pub.getBalance({ address });
    if (bal >= MIN_GAS) return NextResponse.json({ funded: false, reason: "already funded" });

    const account = privateKeyToAccount(key);
    const wallet = createWalletClient({ account, chain: ogGalileo, transport: http() });
    const hash = await wallet.sendTransaction({ to: address, value: DRIP });
    await pub.waitForTransactionReceipt({ hash });
    return NextResponse.json({ funded: true, hash });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
