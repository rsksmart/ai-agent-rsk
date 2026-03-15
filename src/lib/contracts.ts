/**
 * Contract addresses deployed on Rootstock Testnet (Chain ID: 31)
 * These addresses are from the deployment on Rootstock Testnet
 */
export const CONTRACTS = {
  // Rootstock Testnet (Chain ID: 31)
  rskTestnet: {
    LENDING_POOL: "0x70cF2C2703D2Dc02f5c0A1C3b9B430F1A1E9D359" as `0x${string}`,
    MOCK_USDT0: "0x73FA80d19edFDb4E28c870940dca83d990808391" as `0x${string}`,
    ORACLE: "0x5844e8fbcF680f047bA11A54f088419D79e14d35" as `0x${string}`,
  },
  // Add mainnet addresses here when deployed
  rskMainnet: {
    LENDING_POOL: "" as `0x${string}`,
    MOCK_USDT0: "" as `0x${string}`,
    ORACLE: "" as `0x${string}`,
  },
} as const;

/**
 * Get contract address for the current chain
 */
export function getContractAddress(
  chainId: number,
  contract: "LENDING_POOL" | "MOCK_USDT0" | "ORACLE"
): `0x${string}` {
  if (chainId === 31) {
    return CONTRACTS.rskTestnet[contract];
  } else if (chainId === 30) {
    return CONTRACTS.rskMainnet[contract];
  }
  throw new Error(`Unsupported chain ID: ${chainId}`);
}







