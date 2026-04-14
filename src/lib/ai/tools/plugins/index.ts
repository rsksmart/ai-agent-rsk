import { ToolPluginManifest } from "../../types";
import { clientToolsManifest } from "./client-tools.manifest";
import { serverToolsManifest } from "./server-tools.manifest";

export const pluginManifests: ToolPluginManifest[] = [
  clientToolsManifest,
  serverToolsManifest,
];
