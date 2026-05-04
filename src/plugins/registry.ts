import { IPlugin, PluginRegistration } from "./types";
import { logger } from "@/lib/logger";

class PluginRegistry {
  private plugins: Map<string, PluginRegistration> = new Map();
  private readonly reservedPluginNames = new Set(["transfer", "balance"]);
  private readonly reservedFunctionNames = new Set(["transfer", "balance"]);

  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.metadata.name)) {
      if (this.reservedPluginNames.has(plugin.metadata.name)) {
        throw new Error(`Cannot overwrite reserved plugin: ${plugin.metadata.name}`);
      }
      logger.warn(`Plugin ${plugin.metadata.name} is already registered. Overwriting...`);
    }

    const registration: PluginRegistration = {
      plugin,
      enabled: true,
      loadedAt: new Date(),
    };

    // Prevent collisions on core function names and ambiguous multi-plugin dispatch.
    for (const fn of plugin.functions) {
      if (this.reservedFunctionNames.has(fn.name) && plugin.metadata.name !== fn.name) {
        throw new Error(
          `Plugin ${plugin.metadata.name} cannot register reserved function: ${fn.name}`
        );
      }
      const existing = this.getPluginByFunction(fn.name);
      if (existing && existing.plugin.metadata.name !== plugin.metadata.name) {
        throw new Error(
          `Function name collision: ${fn.name} already provided by ${existing.plugin.metadata.name}`
        );
      }
    }

    this.plugins.set(plugin.metadata.name, registration);

    logger.info(`Plugin registered: ${plugin.metadata.name} v${plugin.metadata.version}`);
  }

  unregister(pluginName: string): void {
    const registration = this.plugins.get(pluginName);
    if (registration) {
      if (registration.plugin.cleanup) {
        const cleanupResult = registration.plugin.cleanup();
        if (cleanupResult instanceof Promise) {
          cleanupResult.catch((error: unknown) => {
            logger.error(`Failed to cleanup plugin ${pluginName}:`, error);
          });
        }
      }
      this.plugins.delete(pluginName);
      logger.info(`Plugin unregistered: ${pluginName}`);
    }
  }

  get(pluginName: string): IPlugin | undefined {
    const registration = this.plugins.get(pluginName);
    return registration?.enabled ? registration.plugin : undefined;
  }

  getPluginByFunction(functionName: string): { plugin: IPlugin; functionName: string } | null {
    for (const registration of this.plugins.values()) {
      if (!registration.enabled) continue;

      const hasFunction = registration.plugin.functions.some(
        (fn) => fn.name === functionName
      );
      if (hasFunction) {
        return { plugin: registration.plugin, functionName };
      }
    }
    return null;
  }

  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values())
      .filter((reg) => reg.enabled)
      .map((reg) => reg.plugin);
  }

  getAllFunctions(): Array<{
    plugin: string;
    function: {
      type: "function";
      function: { name: string; description: string; parameters: unknown };
    };
  }> {
    const functions: Array<{
      plugin: string;
      function: {
        type: "function";
        function: { name: string; description: string; parameters: unknown };
      };
    }> = [];

    for (const registration of this.plugins.values()) {
      if (!registration.enabled) continue;

      for (const fn of registration.plugin.functions) {
        functions.push({
          plugin: registration.plugin.metadata.name,
          function: {
            type: "function",
            function: {
              name: fn.name,
              description: fn.description,
              parameters: fn.parameters,
            },
          },
        });
      }
    }

    return functions;
  }

  setEnabled(pluginName: string, enabled: boolean): void {
    const registration = this.plugins.get(pluginName);
    if (registration) {
      registration.enabled = enabled;
      logger.info(`Plugin ${pluginName} ${enabled ? "enabled" : "disabled"}`);
    }
  }

  has(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  count(): number {
    return this.plugins.size;
  }
}

export const pluginRegistry = new PluginRegistry();

