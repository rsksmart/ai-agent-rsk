import { ToolPluginManifest } from "../../types";
import { rskStatsTool } from "../rsk_stats";
import { recentTransactionsTool } from "../transactions";

export const serverToolsManifest: ToolPluginManifest = {
  id: "core-server-tools",
  enabled: true,
  loadTools: async () => [rskStatsTool, recentTransactionsTool],
};
