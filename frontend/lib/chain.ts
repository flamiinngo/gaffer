import { defineChain } from "viem";

/** 0G Galileo testnet — chainId verified live via eth_chainId (0x40da = 16602). */
export const OG_RPC_URL =
  process.env.NEXT_PUBLIC_OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_OG_EXPLORER ?? "https://chainscan-galileo.0g.ai";
export const GITHUB_URL = "https://github.com/flamiinngo/gaffer";

export const ogGalileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: [OG_RPC_URL] },
    public: { http: [OG_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "0G Chainscan", url: EXPLORER_URL },
  },
  testnet: true,
});

/** Deployed ManagerAI contract on 0G Galileo. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x42567B7FE168ff2509658Be72697e0277050306C") as `0x${string}`;

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}
export function explorerAddress(addr: string) {
  return `${EXPLORER_URL}/address/${addr}`;
}
export function shortAddr(addr: string, size = 4) {
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}
