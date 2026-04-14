import { Tool } from "../types";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 10_000;

export const rskStatsTool: Tool = {
  type: 'server',
  argsSchema: z.object({}),
  definition: {
    type: "function",
    function: {
      name: "get_rsk_stats",
      description: "Get current statistics for the Rootstock testnet (average block time, total transactions, market cap, etc.)",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  handler: async () => {
    try {
      const response = await fetch("https://rootstock-testnet.blockscout.com/api/v2/stats", {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json() as Record<string, unknown>;
      return {
        average_block_time: data.average_block_time,
        total_transactions: data.total_transactions,
        total_addresses: data.total_addresses,
        total_blocks: data.total_blocks,
        coin_price: data.coin_price,
        market_cap: data.market_cap,
      };
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      return { error: "Failed to fetch stats" };
    }
  },
};
