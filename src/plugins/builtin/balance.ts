
import { IPlugin, PluginMetadata, PluginFunction, PluginContext, PluginResult } from "../types";
import { getBalance, readContract } from "@wagmi/core";
import { erc20Abi, checksumAddress, isAddress, formatEther, formatUnits } from "viem";
import { findToken, isValidWalletAddress } from "@/lib/utils";
import { logger } from "@/lib/logger";

const metadata: PluginMetadata = {
  name: "balance",
  version: "1.0.0",
  description: "Check token balance for an address",
  author: "Rootstock AI Agent",
};

const functions: PluginFunction[] = [
  {
    name: "balance",
    description: "Check token balance for an address",
    parameters: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Wallet address to check (defaults to user's wallet if empty)",
        },
        token1: {
          type: "string",
          description: "Token symbol to check balance for (e.g., TRBTC, DOC, RIF)",
        },
      },
      required: ["token1"],
    },
  },
];

export const balancePlugin: IPlugin = {
  metadata,
  functions,

  async execute(functionName: string, args: Record<string, unknown>, context: PluginContext): Promise<PluginResult> {
    if (functionName !== "balance") {
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
      };
    }

    try {
      const token1 = typeof args.token1 === "string" ? args.token1 : undefined;
      const address = typeof args.address === "string" ? args.address : undefined;

      if (!token1) {
        return {
          success: false,
          error: "Missing required parameter: token1",
        };
      }

      const tokenAdd =
        token1.toLowerCase() === "trbtc"
          ? "trbtc"
          : await findToken(token1);

      if (!tokenAdd && token1.toLowerCase() !== "trbtc") {
        return {
          success: false,
          error: "Token not found",
        };
      }

      const acc = address && isAddress(address) && isValidWalletAddress(address) ? address : context.address;

      if (!acc) {
        return {
          success: false,
          error: "No wallet address available",
        };
      }

      let balance;

      if (tokenAdd === "trbtc") {
        const queryBalance = await getBalance(context.config, {
          address: acc as `0x${string}`,
        });

        balance = {
          displayValue: Number(formatEther(queryBalance.value)),
          symbol: "tRBTC",
        };
      } else {
        const tokenContract = checksumAddress(tokenAdd as `0x${string}`) as `0x${string}`;

        const [queryBalance, decimals] = await Promise.all([
          readContract(context.config, {
            abi: erc20Abi,
            address: tokenContract,
            functionName: "balanceOf",
            args: [acc as `0x${string}`],
          }),
          readContract(context.config, {
            abi: erc20Abi,
            address: tokenContract,
            functionName: "decimals",
          }),
        ]);

        balance = {
          displayValue: Number(formatUnits(queryBalance as bigint, Number(decimals))),
          symbol: token1 as string,
        };
      }

      return {
        success: true,
        data: balance,
        display: {
          kind: "balance",
          displayValue: balance.displayValue,
          symbol: balance.symbol,
        },
      };
    } catch (error) {
      logger.error("Failed to fetch balance:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch balance";
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

