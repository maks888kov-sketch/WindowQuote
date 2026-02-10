import "dotenv/config";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const emails = [
  "ivan8kov@yandex.ru",
  "kovalenko.i@mmcc.kz",
];

// ВАЖНО: пароль должен быть >= 6 символов (по дефолту)
const password = "Test12345!";

async function signup(email) {
  const url = `${SUPABASE_URL}/auth/v1/signup`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  return { status: res.status, ok: res.ok, json, text };
}

(async () => {
  for (const email of emails) {
    const r = await signup(email);
    console.log(`\n--- signup ${email} ---`);
    console.log("status:", r.status, "ok:", r.ok);
    console.log("body:", r.json ?? r.text);
  }
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
