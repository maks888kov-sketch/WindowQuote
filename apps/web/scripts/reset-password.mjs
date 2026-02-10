import "dotenv/config";

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error("Missing env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/reset-password.mjs <email>");
  process.exit(1);
}

// важно: redirectTo должен совпадать с Redirect URLs в Supabase
const redirectTo = "https://window-quote.vercel.app/auth";

const res = await fetch(`${URL}/auth/v1/recover`, {
  method: "POST",
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, redirect_to: redirectTo }),
});

const text = await res.text();
console.log("status:", res.status, res.statusText);
console.log("body:", text);
