import { ToolPluginManifest } from "../../types";
import { balanceTool } from "../balance";
import { transferTool } from "../transfer";

export const clientToolsManifest: ToolPluginManifest = {
  id: "core-client-tools",
  enabled: true,
  loadTools: async () => [transferTool, balanceTool],
};
