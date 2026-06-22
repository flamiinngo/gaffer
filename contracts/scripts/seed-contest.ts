import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Seeds the canonical World Cup 2026 contests onchain so the app has real
 * contract state to read from launch. Idempotent-ish: it just appends contests.
 */
async function main() {
  const dep = JSON.parse(
    readFileSync(resolve(__dirname, "..", "deployments", "galileo.json"), "utf8")
  );
  const contract = await ethers.getContractAt("ManagerAI", dep.address);
  console.log(`ManagerAI @ ${dep.address} on ${network.name}`);

  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  const contests = [
    {
      name: "World Cup 2026 — Knockout Special",
      entryFee: ethers.parseEther("0.02"),
      startTime: now + 2 * 3600, // entries open ~2h
      endTime: now + 14 * day,
    },
    {
      name: "World Cup 2026 — Group Stage Open",
      entryFee: ethers.parseEther("0.01"),
      startTime: now + 6 * 3600,
      endTime: now + 21 * day,
    },
  ];

  for (const c of contests) {
    const tx = await contract.createContest(c.name, c.entryFee, c.startTime, c.endTime);
    const rcpt = await tx.wait();
    console.log(`✅ "${c.name}"  fee=${ethers.formatEther(c.entryFee)} OG  tx=${rcpt?.hash}`);
  }

  const next = await contract.nextContestId();
  console.log(`nextContestId now ${next} (created ${contests.length} contests)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
