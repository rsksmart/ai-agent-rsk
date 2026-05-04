
import { loadPlugins } from "./loader";
import { transferPlugin } from "./builtin/transfer";
import { balancePlugin } from "./builtin/balance";

export async function initializePlugins() {
  await loadPlugins([transferPlugin, balancePlugin]);
}
export { pluginRegistry } from "./registry";
export { loadPlugins, loadPlugin, unloadPlugin, reloadPlugin } from "./loader";
export type {
  IPlugin,
  PluginMetadata,
  PluginFunction,
  PluginContext,
  PluginResult,
  PluginRegistration,
} from "./types";

