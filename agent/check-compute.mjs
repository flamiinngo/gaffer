import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const pk =
  process.env.PRIVATE_KEY ||
  JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(pk, provider);
console.log("Wallet:", wallet.address);
console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "OG");

const broker = await createZGComputeNetworkBroker(wallet);
console.log("\nBroker created. Listing inference services on testnet…\n");

const services = await broker.inference.listService();
for (const s of services) {
  console.log(
    `• model=${s.model}  type=${s.serviceType}  provider=${s.provider}  url=${s.url ?? s.endpoint ?? "?"}`
  );
}

try {
  const ledger = await broker.ledger.getLedger();
  console.log("\nLedger balance:", ledger?.toString?.() ?? ledger);
} catch (e) {
  console.log("\nNo ledger yet (not funded):", e.message);
}
