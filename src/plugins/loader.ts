
import { IPlugin } from "./types";
import { pluginRegistry } from "./registry";
import { logger } from "@/lib/logger";

const BUILTIN_PLUGINS = new Set(["transfer", "balance"]);

function isServerRuntime(): boolean {
  return typeof window === "undefined";
}

function isPluginAllowed(pluginName: string): boolean {
  // Safe-by-default: only built-ins are allowed unless explicitly enabled.
  if (BUILTIN_PLUGINS.has(pluginName)) return true;

  // NOTE: Community plugins are intentionally not supported in this project build,
  // because they cannot be safely sandboxed inside the Next.js server runtime.
  return false;
}

export async function loadPlugins(plugins: IPlugin[]): Promise<void> {
  for (const plugin of plugins) {
    try {
      if (!plugin.metadata || !plugin.functions || !plugin.execute) {
        throw new Error(
          `Invalid plugin structure: ${plugin.metadata?.name || "unknown"}`
        );
      }

      // Prevent untrusted plugins from running with server privileges by default.
      // Community plugins can be enabled explicitly via env flags (intended for local dev only).
      if (isServerRuntime() && !BUILTIN_PLUGINS.has(plugin.metadata.name)) {
        if (!isPluginAllowed(plugin.metadata.name)) {
          throw new Error(
            `Refusing to load non-builtin plugin on server: ${plugin.metadata.name}`
          );
        }
      } else {
        if (!isPluginAllowed(plugin.metadata.name)) {
          throw new Error(`Plugin not allowlisted: ${plugin.metadata.name}`);
        }
      }

      pluginRegistry.register(plugin);
    } catch (error) {
      logger.error(`Failed to load plugin:`, error);
    }
  }
}

export async function loadPlugin(plugin: IPlugin): Promise<void> {
  await loadPlugins([plugin]);
}

export function unloadPlugin(pluginName: string): void {
  pluginRegistry.unregister(pluginName);
}

export async function reloadPlugin(plugin: IPlugin): Promise<void> {
  unloadPlugin(plugin.metadata.name);
  await loadPlugin(plugin);
}



