/**
 * PM2 config for Timeweb VPS.
 * Run from apps/web: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "windowquote",
      cwd: __dirname,
      script: "server/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
