import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:   ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} OG`);

  if (balance === 0n) {
    throw new Error("Deployer has 0 OG. Fund it at https://faucet.0g.ai before deploying.");
  }

  const Factory = await ethers.getContractFactory("ManagerAI");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅ ManagerAI deployed: ${address}`);
  console.log(`   Explorer: https://chainscan-galileo.0g.ai/address/${address}`);

  // Write a deployment record both apps can read.
  const record = {
    network: network.name,
    chainId: network.config.chainId,
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const outDir = resolve(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "galileo.json"), JSON.stringify(record, null, 2));
  console.log(`   Saved deployments/galileo.json`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
