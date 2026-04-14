import { Tool } from "../types";
import { loadToolsFromManifests } from "./plugin-loader";
import { pluginManifests } from "./plugins";

export interface ToolRegistry {
  tools: Tool[];
  toolsMap: Record<string, Tool>;
}

let registryPromise: Promise<ToolRegistry> | null = null;

export async function getToolRegistry(): Promise<ToolRegistry> {
  if (!registryPromise) {
    registryPromise = loadToolsFromManifests(pluginManifests).then((tools) => {
      const toolsMap = tools.reduce((acc, tool) => {
        acc[tool.definition.function.name] = tool;
        return acc;
      }, {} as Record<string, Tool>);
      return { tools, toolsMap };
    });
  }
  return registryPromise;
}
