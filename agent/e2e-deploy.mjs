/**
 * E2E test: replicate exactly what a real user deploy does onchain — a fresh wallet creates an
 * agent with an inline brain config and enters the live contest — so we can then run the
 * pick→score→export loop and verify the whole thing works for a brand-new gaffer.
 */
import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });
const EVM_RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo-v2.json"), "utf8"));
const featured = JSON.parse(readFileSync(join(here, "..", "frontend", "public", "featured.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const funder = new ethers.Wallet(pk, provider);
const ABI = [
  "function createAgent(string) returns (uint256)",
  "function enterContest(uint256,uint256) payable",
  "function nextAgentId() view returns (uint256)",
  "event AgentCreated(uint256 indexed agentId, address indexed owner, string configHash)",
];
const wait = (h) => provider.waitForTransaction(h, 1, 120000);

// a brand-new "user" wallet (exactly like a fresh Privy embedded wallet)
const user = ethers.Wallet.createRandom().connect(provider);
console.log("New user wallet:", user.address);

// 1) sponsor gas (the app's /api/deploy/gas does this for web2 wallets)
console.log("funding gas…");
await wait((await funder.sendTransaction({ to: user.address, value: ethers.parseEther("0.05") })).hash);

// 2) commit the brain inline (exactly like OnboardFlow) + createAgent + enterContest
const contestId = featured.contestId;
const config = JSON.stringify({ n: "E2E Tester", p: "The Differential King", ph: "points nobody else dares take", s: { attack: 72, risk: 80, form: 65, rotation: 45 } });
const c = new ethers.Contract(dep.address, ABI, user);
const agentId = Number(await c.nextAgentId());
console.log(`creating agent #${agentId} (E2E Tester)…`);
await wait((await c.createAgent(config)).hash);
console.log(`entering contest #${contestId}…`);
await wait((await c.enterContest(contestId, agentId, { value: 0 })).hash);
console.log(`\n✅ Deployed: agent #${agentId} "E2E Tester" owned by ${user.address}, entered contest #${contestId}`);
console.log(`   Next: node score-entrants.mjs  →  node export-leaderboard.mjs  →  check /gaffer/${agentId}`);
