/**
 * Application Configuration
 */

import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(3001),
  host: z.string().default("0.0.0.0"),
  nodeEnv: z.enum(["development", "production", "test"]).default("production"),

  // Database
  databasePath: z.string().default("./data/migrator.db"),

  // License
  licenseKey: z.string().optional(),
  licenseServerUrl: z.string().url().optional(),

  // Dokploy Integration
  dokployUrl: z.string().url().optional(),
  dokployApiKey: z.string().optional(),

  // Security
  jwtSecret: z.string().min(32).default("change-this-secret-in-production-min-32-chars"),
  corsOrigins: z.string().default("*"),

  // Logging
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Features
  enableTelemetry: z.coerce.boolean().default(false),
  enableAutoUpdate: z.coerce.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const env = {
    port: process.env.PORT,
    host: process.env.HOST,
    nodeEnv: process.env.NODE_ENV,
    databasePath: process.env.DATABASE_PATH,
    licenseKey: process.env.LICENSE_KEY,
    licenseServerUrl: process.env.LICENSE_SERVER_URL,
    dokployUrl: process.env.DOKPLOY_URL,
    dokployApiKey: process.env.DOKPLOY_API_KEY,
    jwtSecret: process.env.JWT_SECRET,
    corsOrigins: process.env.CORS_ORIGINS,
    logLevel: process.env.LOG_LEVEL,
    enableTelemetry: process.env.ENABLE_TELEMETRY,
    enableAutoUpdate: process.env.ENABLE_AUTO_UPDATE,
  };

  const result = configSchema.safeParse(env);

  if (!result.success) {
    console.error("Configuration validation failed:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export function isDevelopment(): boolean {
  return config.nodeEnv === "development";
}

export function isProduction(): boolean {
  return config.nodeEnv === "production";
}
