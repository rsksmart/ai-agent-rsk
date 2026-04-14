import { Tool, ToolPluginManifest } from "../types";

const ENABLED_PLUGIN_ALLOWLIST = new Set(
  (process.env.AI_TOOL_PLUGIN_ALLOWLIST || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

function shouldLoadPlugin(plugin: ToolPluginManifest): boolean {
  if (!plugin.enabled) {
    return false;
  }
  if (ENABLED_PLUGIN_ALLOWLIST.size === 0) {
    return true;
  }
  return ENABLED_PLUGIN_ALLOWLIST.has(plugin.id);
}

function validateTool(tool: Tool): void {
  const functionName = tool.definition.function.name;
  if (!functionName) {
    throw new Error("Tool is missing function name");
  }
  if (tool.type === "server" && typeof tool.handler !== "function") {
    throw new Error(`Server tool "${functionName}" must include a handler`);
  }
}

export async function loadToolsFromManifests(manifests: ToolPluginManifest[]): Promise<Tool[]> {
  const collectedTools: Tool[] = [];
  const toolNameSet = new Set<string>();

  for (const manifest of manifests) {
    if (!shouldLoadPlugin(manifest)) {
      continue;
    }

    const tools = await manifest.loadTools();
    for (const tool of tools) {
      validateTool(tool);
      const name = tool.definition.function.name;
      if (toolNameSet.has(name)) {
        throw new Error(`Duplicate tool name detected: ${name}`);
      }
      toolNameSet.add(name);
      collectedTools.push(tool);
    }
  }

  return collectedTools;
}
