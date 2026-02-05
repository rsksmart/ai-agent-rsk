import { readContract } from "@wagmi/core";
import { type Config } from "wagmi";
import { formatEther, formatUnits } from "viem";
import { getContractAddress } from "./contracts";
import LendingPoolABI from "./abis/LendingPool.json";

/**
 * Portfolio data structure returned from LendingPool.getAccountData()
 */
export interface PortfolioData {
  // Formatted values for display (JSON-serializable)
  collateralRBTC: string; // Formatted RBTC amount
  debtUSDT0: string; // Formatted USDT0 amount (6 decimals)
  collateralUSD: string; // Formatted USD value
  debtUSD: string; // Formatted USD value
  maxBorrowableUSD: string; // Formatted USD value
  healthFactor: number; // Health factor as number (e.g., 1.5 = 150% safe)
  
  // Calculated ratios
  ltvRatio: number; // Loan-to-Value ratio (debt/collateral) as percentage (e.g., 50 = 50%)
  collateralizationRatio: number; // Collateralization ratio (collateral/debt) as percentage
  
  // Status indicators
  isHealthy: boolean; // Health factor > 1.0
  isAtRisk: boolean; // Health factor < 1.5
  hasPosition: boolean; // Has collateral or debt
}

/**
 * Fetch portfolio data for a user from the LendingPool contract
 * @param config - Wagmi config
 * @param userAddress - User's wallet address
 * @param chainId - Chain ID (31 for testnet, 30 for mainnet)
 * @returns Portfolio data or null if error
 */
export async function fetchPortfolioData(
  config: Config,
  userAddress: `0x${string}`,
  chainId: number
): Promise<PortfolioData | null> {
  try {
    const lendingPoolAddress = getContractAddress(chainId, "LENDING_POOL");

    // Call getAccountData function
    const result = await readContract(config, {
      address: lendingPoolAddress,
      abi: LendingPoolABI,
      functionName: "getAccountData",
      args: [userAddress],
    });

    // Extract values from the result tuple
    const [
      collRbtcWei,
      debtUsdt0,
      collUsdE18,
      debtUsdE18,
      maxDebtUsdE18,
      healthFactorE18,
    ] = result as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];

    // Format values
    const collateralRBTC = formatEther(collRbtcWei); // RBTC has 18 decimals
    const debtUSDT0 = formatUnits(debtUsdt0, 6); // USDT0 has 6 decimals
    const collateralUSD = formatEther(collUsdE18); // USD values in 18 decimals
    const debtUSD = formatEther(debtUsdE18);
    const maxBorrowableUSD = formatEther(maxDebtUsdE18);
    
    // Health factor: contract returns in 1e18 format (1e18 = 1.0, 2e18 = 2.0)
    const healthFactor = Number(healthFactorE18) / 1e18;
    
    // Check if health factor is max (no debt)
    const hasNoDebt = healthFactorE18 === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    const actualHealthFactor = hasNoDebt ? Infinity : healthFactor;

    // Calculate collateral ratios
    const collUSDNum = parseFloat(collateralUSD);
    const debtUSDNum = parseFloat(debtUSD);
    
    // LTV Ratio: (Debt / Collateral) × 100%
    // Example: $50 debt / $100 collateral = 50% LTV
    const ltvRatio = collUSDNum > 0 ? (debtUSDNum / collUSDNum) * 100 : 0;
    
    // Collateralization Ratio: (Collateral / Debt) × 100%
    // Example: $100 collateral / $50 debt = 200% collateralization
    const collateralizationRatio = debtUSDNum > 0 ? (collUSDNum / debtUSDNum) * 100 : Infinity;

    return {
      // Formatted values (JSON-serializable)
      collateralRBTC,
      debtUSDT0,
      collateralUSD,
      debtUSD,
      maxBorrowableUSD,
      healthFactor: actualHealthFactor === Infinity ? 999999 : actualHealthFactor, // Use large number for Infinity
      
      // Calculated ratios
      ltvRatio,
      collateralizationRatio: collateralizationRatio === Infinity ? 999999 : collateralizationRatio,
      
      // Status indicators
      isHealthy: actualHealthFactor > 1.0,
      isAtRisk: actualHealthFactor < 1.5 && actualHealthFactor !== Infinity,
      hasPosition: collRbtcWei > 0n || debtUsdt0 > 0n,
    };
  } catch (error) {
    console.error("Error fetching portfolio data:", error);
    return null;
  }
}

