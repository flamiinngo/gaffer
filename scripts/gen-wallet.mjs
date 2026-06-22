import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeFileSync, existsSync } from "node:fs";

const out = new URL("../.deployer-wallet.json", import.meta.url);

if (existsSync(out)) {
  console.error("Wallet file already exists — refusing to overwrite. Delete .deployer-wallet.json to regenerate.");
  process.exit(1);
}

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

const data = {
  address: account.address,
  privateKey,
  network: "0G-Galileo-Testnet",
  chainId: 16602,
  note: "TESTNET THROWAWAY WALLET. Never send mainnet funds here.",
  createdAt: new Date().toISOString(),
};

writeFileSync(out, JSON.stringify(data, null, 2));
console.log("\n=== 0G Testnet Deployer Wallet generated ===");
console.log("Address:    ", account.address);
console.log("Saved to:   ", out.pathname);
console.log("\nFund this address at https://faucet.0g.ai (paste the address above).\n");
