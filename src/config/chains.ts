import { type Chain } from "viem";

const RPC_MAINNET = process.env.NEXT_PUBLIC_RPC_MAINNET || "";
// Default public RPC for Rootstock testnet if env var is not set
const RPC_TESTNET = process.env.NEXT_PUBLIC_RPC_TESTNET || "https://public-node.testnet.rsk.co";

export const rootstock = {
  id: 30,
  name: "Rootstock",
  nativeCurrency: { name: "Smart Bitcoin", symbol: "RBTC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [RPC_MAINNET],
    },
  },
  blockExplorers: {
    default: { name: "Rootstock Explorer", url: "https://explorer.rootstock.io/" },
  },
} as const satisfies Chain;

export const rootstockTestnet = {
    id: 31,
    name: "Rootstock Testnet",
    nativeCurrency: { name: "Smart Bitcoin Testnet", symbol: "tRBTC", decimals: 18 },
    rpcUrls: {
      default: {
        http: [RPC_TESTNET],
      },
    },
    blockExplorers: {
      default: { name: "Rootstock Testnet Explorer", url: "https://explorer.testnet.rootstock.io/" },
    },
  } as const satisfies Chain;
