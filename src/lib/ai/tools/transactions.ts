import { Tool } from "../types";
import { formatEther } from "viem";
import { isValidWalletAddress } from "../../utils";
import { z } from "zod";

interface TransactionItem {
  hash: string;
  from: { hash: string } | null;
  to: { hash: string } | null;
  value: string;
  timestamp: string;
  status: "ok" | "error";
}

interface BlockscoutResponse {
  items: TransactionItem[];
}

const argsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  limit: z.number().int().min(1).max(10).optional(),
});

const FETCH_TIMEOUT_MS = 10_000;

function safeFormatEther(value: string | null | undefined): string {
  try {
    return formatEther(BigInt(value || "0"));
  } catch {
    return "0";
  }
}

export const recentTransactionsTool: Tool = {
  argsSchema,
  definition: {
    type: "function",
    function: {
      name: "get_recent_transactions",
      description: "Fetch the recent transactions for a given Rootstock address. Use this when the user asks for a summary of their transactions, history, or recent activity.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The Rootstock address to fetch transactions for. If not provided, use the current user's address.",
          },
          limit: {
            type: "number",
            description: "The number of transactions to fetch (default: 5).",
          },
        },
        required: ["address"],
      },
    },
  },
  type: "server",
  handler: async (args: Record<string, unknown>) => {
    const parsedArgs = argsSchema.safeParse(args);
    if (!parsedArgs.success) {
      return { error: "Invalid arguments for get_recent_transactions" };
    }

    const { address } = parsedArgs.data;
    const limit = parsedArgs.data.limit ?? 5;

    try {
      if (!address) {
        return { error: "Address is required" };
      }

      if (!isValidWalletAddress(address)) {
        return { error: "Invalid address format" };
      }

      // Blockscout V2 API for Rootstock Testnet
      const response = await fetch(
        `https://rootstock-testnet.blockscout.com/api/v2/addresses/${address}/transactions`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
      );
      
      if (!response.ok) {
        throw new Error(`Blockscout API error: ${response.statusText}`);
      }

      const data = (await response.json()) as BlockscoutResponse;
      
      if (!data.items || !Array.isArray(data.items)) {
        return { message: "No recent transactions found for this address." };
      }

      const transactions = data.items.slice(0, limit).map((tx: TransactionItem) => {
        const valueInTrbtc = safeFormatEther(tx.value);
        const date = new Date(tx.timestamp).toLocaleString();
        const type = tx.from?.hash?.toLowerCase() === address.toLowerCase() ? "Sent" : "Received";
        
        return {
          type,
          amount: `${Number(valueInTrbtc).toFixed(6)} TRBTC`,
          date,
          from: tx.from?.hash || "Unknown",
          to: tx.to?.hash || "Contract Creation",
          status: tx.status === "ok" ? "Success" : "Failed",
          hash: tx.hash
        };
      });

      if (transactions.length === 0) {
        return { message: "No recent transactions found." };
      }

      return transactions;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return { error: "Failed to fetch transaction history. Please try again later." };
    }
  },
};
