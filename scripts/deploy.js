#!/usr/bin/env node
/**
 * Deploy: push to GitHub and print server update command.
 * Usage: node scripts/deploy.js [commit message]
 * Or: npm run deploy [-- "commit message"]
 */
const { execSync } = require("child_process");
const message = process.argv[2] || process.env.DEPLOY_MESSAGE || "update project";

try {
  execSync("git add .", { stdio: "inherit" });
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
  } catch (e) {
    if (e.status === 1) console.log("(nothing to commit)");
  }
  execSync("git push origin main", { stdio: "inherit" });
  console.log("\n--- На сервере выполни ---\n");
  console.log("cd /root/WindowQuote && git pull origin main && cd apps/web && npm install && npm run build && pm2 restart windowquote\n");
} catch (err) {
  process.exit(err.status || 1);
}
