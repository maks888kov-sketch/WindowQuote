#!/usr/bin/env node

const adminUrl = (process.env.ADMIN_URL || "http://localhost:5173").replace(/\/$/, "");
const userId = process.argv[2] || process.env.USER_ID;
const token = process.env.ACCESS_TOKEN;

if (!userId) {
  console.error("Usage: ADMIN_URL=... ACCESS_TOKEN=... node scripts/admin-delete-test.mjs <userId>");
  process.exit(1);
}

if (!token) {
  console.error("Missing ACCESS_TOKEN. Set ACCESS_TOKEN with an admin Bearer token.");
  process.exit(1);
}

const endpoint = `${adminUrl}/api/admin/users/${encodeURIComponent(userId)}`;

const run = async () => {
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const rawBody = await response.text();
  let parsedBody = rawBody;

  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // keep raw text body
  }

  console.log("DELETE", endpoint);
  console.log("status:", response.status);
  console.log("ok:", response.ok);
  console.log("body:", parsedBody);
};

run().catch((error) => {
  console.error("Request failed:", error?.message ?? error);
  process.exit(1);
});
