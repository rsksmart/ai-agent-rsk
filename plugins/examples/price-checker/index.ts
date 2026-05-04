/**
 * Example Plugin: Price Checker
 * 
 * This is an example plugin that demonstrates how to create a custom plugin
 * for the Rootstock AI Agent. This plugin checks token prices.
 * 
 * To use this plugin:
 * 1. Import it in your application
 * 2. Register it using: loadPlugin(priceCheckerPlugin)
 * 3. The AI will automatically be able to use the "checkPrice" function
 */

import { IPlugin, PluginMetadata, PluginFunction, PluginContext, PluginResult } from "@/plugins/types";
import { logger } from "@/lib/logger";

const metadata: PluginMetadata = {
  name: "price-checker",
  version: "1.0.0",
  description: "Check token prices on Rootstock testnet",
  author: "Example Developer",
  repository: "https://github.com/example/price-checker-plugin",
};

const functions: PluginFunction[] = [
  {
    name: "checkPrice",
    description: "Check the current price of a token on Rootstock testnet",
    parameters: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "Token symbol to check price for (e.g., TRBTC, DOC, RIF)",
        },
      },
      required: ["token"],
    },
  },
];

export const priceCheckerPlugin: IPlugin = {
  metadata,
  functions,

  async init(context: PluginContext): Promise<void> {
    logger.info("Price Checker plugin initialized");
  },

  async execute(
    functionName: string,
    args: Record<string, unknown>,
    context: PluginContext
  ): Promise<PluginResult> {
    if (functionName !== "checkPrice") {
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
      };
    }

    try {
      const token = typeof args.token === "string" ? args.token : undefined;

      if (!token) {
        return {
          success: false,
          error: "Missing required parameter: token",
        };
      }

      // Example/stub implementation: replace with a real price feed.
      const mockPrice = 0;

      return {
        success: true,
        data: {
          token: token.toUpperCase(),
          price: mockPrice,
          currency: "USD",
        },
        display: {
          kind: "markdown",
          markdown: `**Stub** price for **${token.toUpperCase()}**: \`$${mockPrice}\` (replace with real API)`,
        },
      };
    } catch (error) {
      logger.error("Price check failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to check price";
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  async cleanup(): Promise<void> {
    logger.info("Price Checker plugin cleaned up");
  },
};

