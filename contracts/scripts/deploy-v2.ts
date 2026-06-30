import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

/** Deploys GafferArena (v2: agents-as-NFTs + marketplace + permissionless contests).
 *  Writes deployments/galileo-v2.json so the live ManagerAI reference stays intact until cutover. */
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:   ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} OG`);
  if (balance === 0n) throw new Error("Deployer has 0 OG. Fund it at https://faucet.0g.ai.");

  const Factory = await ethers.getContractFactory("GafferArena");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅ GafferArena deployed: ${address}`);
  console.log(`   Explorer: https://chainscan-galileo.0g.ai/address/${address}`);

  const record = {
    network: network.name,
    chainId: network.config.chainId,
    address,
    deployer: deployer.address,
    contract: "GafferArena",
    deployedAt: new Date().toISOString(),
  };
  const outDir = resolve(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "galileo-v2.json"), JSON.stringify(record, null, 2));
  console.log(`   Saved deployments/galileo-v2.json`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
