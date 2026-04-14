import { Tool } from "../types";
import { z } from "zod";

export const transferTool: Tool = {
  type: 'client',
  argsSchema: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
    token1: z.string().min(1).max(20),
    amount: z.union([z.string(), z.number()]),
  }),
  definition: {
    type: "function",
    function: {
      name: "transfer",
      description: "Transfer tokens from the user's wallet to another address",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Recipient wallet address",
          },
          token1: {
            type: "string",
            description: "Token symbol to transfer (e.g., TRBTC, DOC, RIF)",
          },
          amount: {
            type: "number",
            description: "Amount of tokens to transfer",
          },
        },
        required: ["address", "token1", "amount"],
      },
    },
  },
};
