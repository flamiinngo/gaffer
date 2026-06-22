import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const EVM_RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";

const pk =
  process.env.PRIVATE_KEY ||
  JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;
const provider = new ethers.JsonRpcProvider(EVM_RPC);
const signer = new ethers.Wallet(pk, provider);
const indexer = new Indexer(INDEXER_RPC);

console.log("Wallet:", signer.address);
console.log("Balance:", ethers.formatEther(await provider.getBalance(signer.address)), "OG");

// A real decision artifact — exactly what a gaffer would store.
const decision = {
  manager: signer.address,
  contestId: 1,
  match: "Argentina vs Austria",
  formation: "4-3-3",
  captain: "Lionel Messi",
  reasoning:
    "Captaining Lionel Messi maximizes our attacking bias by leveraging his exceptional skills.",
  xi: ["Emiliano Martínez", "Nahuel Molina", "Cristian Romero", "Lisandro Martínez", "Gonzalo Montiel", "Enzo Fernández", "Alexis Mac Allister", "Rodrigo De Paul", "Julián Álvarez", "Lionel Messi"],
  model: "qwen/qwen2.5-omni-7b",
  ts: new Date().toISOString(),
};

const bytes = new TextEncoder().encode(JSON.stringify(decision));
const file = new MemData(bytes);

const [tree, terr] = await file.merkleTree();
if (terr) throw terr;
const rootHash = tree.rootHash();
console.log("\nDecision bytes:", bytes.length);
console.log("0G Storage root hash:", rootHash);

console.log("\nUploading to 0G Storage (testnet)…");
const [tx, uerr] = await indexer.upload(file, EVM_RPC, signer);
if (uerr) throw uerr;
console.log("✅ Uploaded. tx:", tx);

// Read it back and verify byte-identical.
const out = join(here, ".storage-readback.json");
try { rmSync(out, { force: true }); } catch {}
console.log("\nDownloading by root hash (with proof)…");
const derr = await indexer.download(rootHash, out, true);
if (derr) throw derr;

const back = readFileSync(out, "utf8");
const match = back === JSON.stringify(decision);
console.log("✅ Downloaded. Byte-identical:", match);
console.log("Captain read back from 0G:", JSON.parse(back).captain);
rmSync(out, { force: true });
console.log("\n0G STORAGE ROUND-TRIP:", match ? "PASS ✔" : "MISMATCH ✘");
