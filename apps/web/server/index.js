/**
 * Express server for self-hosting (Timeweb, VPS, etc.)
 * Serves built Vite app and API routes.
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body parser for API
app.use(express.json({ limit: "10mb" }));

// CORS for API
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// API route definitions: [method, path, handlerModulePath]
const apiRoutes = [
  ["GET", "/api/admin/users", "admin/users/index.js"],
  ["POST", "/api/admin/users/invite", "admin/users/invite.js"],
  ["DELETE", "/api/admin/users/:userId", "admin/users/[userId].js"],
  ["POST", "/api/admin/org-members/set-role", "admin/org-members/set-role.js"],
  ["PATCH", "/api/admin/orgs", "admin/orgs/index.js"],
  ["GET", "/api/admin/audit", "admin/audit/index.js"],
  ["GET", "/api/org-members", "org-members/index.js"],
  ["POST", "/api/quote-calculate", "quote-calculate/index.js"],
  ["POST", "/api/quote-pdf", "quote-pdf/index.js"],
  ["POST", "/api/push-subscribe", "push-subscribe/index.js"],
  ["POST", "/api/push-send", "push-send/index.js"],
  ["POST", "/api/inventory-reserve", "inventory-reserve/index.js"],
  ["POST", "/api/pricing-publish", "pricing-publish/index.js"],
];

// Mount API handlers
for (const [method, route, modulePath] of apiRoutes) {
  const fullPath = path.join(rootDir, "api", modulePath);
  const importUrl = pathToFileURL(fullPath).href;
  app[method.toLowerCase()](route, async (req, res, next) => {
    try {
      const handlerModule = await import(importUrl);
      const handler = handlerModule.default;
      if (!handler) {
        res.status(500).json({ ok: false, error: "Handler not found" });
        return;
      }
      // Pass userId from params to query for [userId] handler
      if (req.params.userId) {
        req.query = req.query || {};
        req.query.userId = req.params.userId;
      }
      await handler(req, res);
    } catch (err) {
      console.error("[API]", route, err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

// Debug env (optional, disable in production)
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug/env", async (req, res) => {
    try {
      const url = pathToFileURL(path.join(rootDir, "api", "debug", "env.js")).href;
      const m = await import(url);
      await m.default(req, res);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

// Static files from Vite build
app.use(express.static(path.join(rootDir, "dist")));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`WindowQuote server running at http://localhost:${PORT}`);
});
