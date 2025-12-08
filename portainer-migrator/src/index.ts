/**
 * Portainer Migrator - Main Entry Point
 *
 * A standalone tool to migrate from Portainer to Dokploy.
 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { config, isDevelopment } from "./config.js";
import { initializeDatabase, closeDatabase } from "./db/index.js";
import { app as apiRoutes } from "./api/routes.js";

// Initialize database
console.log("Initializing database...");
initializeDatabase();

// Create main app
const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: config.corsOrigins === "*" ? "*" : config.corsOrigins.split(","),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-License-Key"],
  })
);

// Mount API routes
app.route("/", apiRoutes);

// Serve static files for frontend (in production)
if (!isDevelopment()) {
  app.use("/assets/*", serveStatic({ root: "./frontend/dist" }));
  app.get("*", serveStatic({ root: "./frontend/dist", path: "index.html" }));
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down...");
  closeDatabase();
  process.exit(0);
});

// Start server
console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   Portainer Migrator v1.0.0                                   ║
║   Migrate from Portainer to Dokploy with ease                 ║
║                                                                ║
║   Server running at http://${config.host}:${config.port}                      ║
║   Environment: ${config.nodeEnv.padEnd(46)}║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
});

export { app };
