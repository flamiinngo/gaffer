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

/** Deployed GafferArena (v2) contract on 0G Galileo — agents are NFTs with careers + marketplace. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0xc9Ee85F2b3D2e905a5Ea32718d11410843d0b309") as `0x${string}`;

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}
export function explorerAddress(addr: string) {
  return `${EXPLORER_URL}/address/${addr}`;
}
export function shortAddr(addr: string, size = 4) {
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}
