import { Tool } from "../types";
import { z } from "zod";

export const balanceTool: Tool = {
  type: 'client',
  argsSchema: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    token1: z.string().min(1).max(20),
  }),
  definition: {
    type: "function",
    function: {
      name: "balance",
      description: "Check the balance of a specific token (TRBTC, DOC, RIF) for a given address. Only use this if the user explicitly asks for a balance check.",
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
  },
};
