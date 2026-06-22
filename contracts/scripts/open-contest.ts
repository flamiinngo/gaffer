import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/** Creates a free, long-open contest so anyone can deploy a gaffer into it during the demo. */
async function main() {
  const dep = JSON.parse(readFileSync(resolve(__dirname, "..", "deployments", "galileo.json"), "utf8"));
  const c = await ethers.getContractAt("ManagerAI", dep.address);
  const id = await c.nextContestId();
  const now = Math.floor(Date.now() / 1000);
  const tx = await c.createContest("World Cup 2026 — Open Trials", 0n, now + 7 * 86400, now + 30 * 86400);
  console.log("createContest tx:", tx.hash);
  // robust wait against testnet receipt lag
  for (let i = 0; i < 40; i++) {
    const r = await ethers.provider.getTransactionReceipt(tx.hash).catch(() => null);
    if (r) break;
    await new Promise((res) => setTimeout(res, 2000));
  }
  console.log(`✅ Open contest #${id} created (free entry, open 7 days).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
