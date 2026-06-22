import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const dep = JSON.parse(
    readFileSync(resolve(__dirname, "..", "deployments", "galileo.json"), "utf8")
  );
  const c = await ethers.getContractAt("ManagerAI", dep.address);
  const next = await c.nextContestId();
  console.log("nextContestId:", next.toString());
  for (let i = 1n; i < next; i++) {
    const x = await c.getContest(i);
    console.log(`#${i}: "${x[1]}" fee=${ethers.formatEther(x[3])} OG participants=${x[7]} resolved=${x[6]}`);
  }
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
