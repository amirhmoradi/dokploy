/**
 * Plugin Service - v2.0.0
 * Handles plugin loading, lifecycle, and hook execution
 */

import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import type {
  Plugin,
  PluginManifest,
  PluginHook,
  PluginEvent,
  PluginContext,
  PluginLogger,
  PluginStorage,
  Migration,
  MigrationItem,
} from "../types";

export class PluginService {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private hooks: Map<PluginEvent, HookHandler[]> = new Map();
  private pluginsDir: string;
  private storage: Map<string, Map<string, unknown>> = new Map();

  constructor(pluginsDir: string = "./plugins") {
    this.pluginsDir = pluginsDir;
    this.initializeHookMaps();
  }

  /**
   * Initialize hook event maps
   */
  private initializeHookMaps(): void {
    const events: PluginEvent[] = [
      "migration.beforeAnalyze",
      "migration.afterAnalyze",
      "migration.beforeExecute",
      "migration.afterExecute",
      "item.beforeMigrate",
      "item.afterMigrate",
      "transform.beforeTransform",
      "transform.afterTransform",
      "notification.beforeSend",
      "report.beforeGenerate",
      "backup.beforeCreate",
      "backup.afterRestore",
    ];

    for (const event of events) {
      this.hooks.set(event, []);
    }
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadPlugins(): Promise<void> {
    try {
      const entries = await readdir(this.pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = join(this.pluginsDir, entry.name);
          await this.loadPlugin(pluginPath);
        }
      }
    } catch (error) {
      console.log("No plugins directory found or empty");
    }
  }

  /**
   * Load a single plugin from a directory
   */
  async loadPlugin(pluginPath: string): Promise<Plugin | null> {
    try {
      const manifestPath = join(pluginPath, "package.json");
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Validate manifest
      if (!this.validateManifest(manifest)) {
        console.error(`Invalid manifest for plugin at ${pluginPath}`);
        return null;
      }

      // Load the plugin module
      const mainPath = join(pluginPath, manifest.main);
      const pluginModule = await import(mainPath);

      const plugin: Plugin = {
        id: manifest.name,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        license: "MIT",
        enabled: false,
        config: manifest.config?.defaults || {},
        hooks: manifest.hooks.map((h) => ({
          event: h.event,
          handler: h.handler,
          priority: h.priority || 10,
          async: true,
        })),
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Store loaded plugin
      const loadedPlugin: LoadedPlugin = {
        plugin,
        module: pluginModule,
        path: pluginPath,
      };

      this.plugins.set(plugin.id, loadedPlugin);

      return plugin;
    } catch (error) {
      console.error(`Failed to load plugin at ${pluginPath}:`, error);
      return null;
    }
  }

  /**
   * Enable a plugin and register its hooks
   */
  async enablePlugin(pluginId: string): Promise<boolean> {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) return false;

    loaded.plugin.enabled = true;

    // Register hooks
    for (const hook of loaded.plugin.hooks) {
      this.registerHook(hook.event, {
        pluginId,
        handler: hook.handler,
        priority: hook.priority,
        async: hook.async,
      });
    }

    // Call plugin's onEnable if exists
    if (loaded.module.onEnable) {
      await loaded.module.onEnable(this.createContext(loaded.plugin));
    }

    return true;
  }

  /**
   * Disable a plugin and unregister its hooks
   */
  async disablePlugin(pluginId: string): Promise<boolean> {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) return false;

    // Call plugin's onDisable if exists
    if (loaded.module.onDisable) {
      await loaded.module.onDisable(this.createContext(loaded.plugin));
    }

    // Unregister hooks
    for (const [event, handlers] of this.hooks) {
      this.hooks.set(
        event,
        handlers.filter((h) => h.pluginId !== pluginId)
      );
    }

    loaded.plugin.enabled = false;

    return true;
  }

  /**
   * Uninstall a plugin completely
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    await this.disablePlugin(pluginId);
    this.plugins.delete(pluginId);
    this.storage.delete(pluginId);
    return true;
  }

  /**
   * Execute hooks for an event
   */
  async executeHooks(
    event: PluginEvent,
    context: Partial<PluginContext>
  ): Promise<void> {
    const handlers = this.hooks.get(event) || [];

    // Sort by priority (lower = higher priority)
    const sortedHandlers = [...handlers].sort((a, b) => a.priority - b.priority);

    for (const handler of sortedHandlers) {
      const loaded = this.plugins.get(handler.pluginId);
      if (!loaded || !loaded.plugin.enabled) continue;

      try {
        const fullContext = this.createContext(loaded.plugin, context);
        const handlerFn = loaded.module[handler.handler];

        if (typeof handlerFn === "function") {
          if (handler.async) {
            await handlerFn(fullContext);
          } else {
            handlerFn(fullContext);
          }
        }
      } catch (error) {
        console.error(
          `Plugin ${handler.pluginId} hook ${handler.handler} failed:`,
          error
        );
      }
    }
  }

  /**
   * Get all plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map((p) => p.plugin);
  }

  /**
   * Get plugin by ID
   */
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id)?.plugin;
  }

  /**
   * Update plugin configuration
   */
  updateConfig(pluginId: string, config: Record<string, unknown>): boolean {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) return false;

    loaded.plugin.config = { ...loaded.plugin.config, ...config };
    loaded.plugin.updatedAt = new Date().toISOString();

    return true;
  }

  // Private methods

  private validateManifest(manifest: PluginManifest): boolean {
    if (!manifest.name || !manifest.version || !manifest.main) {
      return false;
    }

    if (!manifest.hooks || !Array.isArray(manifest.hooks)) {
      return false;
    }

    return true;
  }

  private registerHook(event: PluginEvent, handler: HookHandler): void {
    const handlers = this.hooks.get(event) || [];
    handlers.push(handler);
    this.hooks.set(event, handlers);
  }

  private createContext(
    plugin: Plugin,
    partial?: Partial<PluginContext>
  ): PluginContext {
    return {
      migration: partial?.migration,
      item: partial?.item,
      sourceData: partial?.sourceData,
      transformedData: partial?.transformedData,
      config: plugin.config || {},
      logger: this.createLogger(plugin.id),
      storage: this.createStorage(plugin.id),
    };
  }

  private createLogger(pluginId: string): PluginLogger {
    const prefix = `[Plugin:${pluginId}]`;
    return {
      debug: (msg: string, data?: unknown) =>
        console.debug(prefix, msg, data || ""),
      info: (msg: string, data?: unknown) =>
        console.info(prefix, msg, data || ""),
      warn: (msg: string, data?: unknown) =>
        console.warn(prefix, msg, data || ""),
      error: (msg: string, data?: unknown) =>
        console.error(prefix, msg, data || ""),
    };
  }

  private createStorage(pluginId: string): PluginStorage {
    if (!this.storage.has(pluginId)) {
      this.storage.set(pluginId, new Map());
    }

    const store = this.storage.get(pluginId)!;

    return {
      get: async (key: string) => store.get(key),
      set: async (key: string, value: unknown) => {
        store.set(key, value);
      },
      delete: async (key: string) => {
        store.delete(key);
      },
      list: async (prefix?: string) => {
        const keys = Array.from(store.keys());
        return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
      },
    };
  }
}

interface LoadedPlugin {
  plugin: Plugin;
  module: PluginModule;
  path: string;
}

interface PluginModule {
  onEnable?: (context: PluginContext) => Promise<void>;
  onDisable?: (context: PluginContext) => Promise<void>;
  [handler: string]: unknown;
}

interface HookHandler {
  pluginId: string;
  handler: string;
  priority: number;
  async: boolean;
}

// Export singleton
export const pluginService = new PluginService();
