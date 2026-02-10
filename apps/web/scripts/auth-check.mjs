import "dotenv/config";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const emails = [
  "ivan8kov@yandex.ru",
  "kovalenko.i@mmcc.kz",
];

// helper: call GoTrue admin API
async function admin(path, { method = "GET", body } = {}) {
  const url = `${SUPABASE_URL}/auth/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  return { ok: res.ok, status: res.status, json, text };
}

async function findUserByEmail(email) {
  // Pagination-safe search: iterate pages until found (limit 1000)
  let page = 1;
  const perPage = 100;
  while (page <= 10) {
    const q = `?page=${page}&per_page=${perPage}`;
    const r = await admin(`/admin/users${q}`);
    if (!r.ok) throw new Error(`admin list users failed: ${r.status} ${r.text}`);
    const users = Array.isArray(r.json?.users) ? r.json.users : (Array.isArray(r.json) ? r.json : []);
    if (!users.length) break;

    const hit = users.find(u => (u.email || "").toLowerCase() === email.toLowerCase());
    if (hit) return hit;

    page += 1;
  }
  return null;
}

function summarizeUser(u) {
  return {
    id: u.id,
    email: u.email,
    confirmed_at: u.confirmed_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
    created_at: u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
    identities: (u.identities || []).map(i => ({ provider: i.provider })),
  };
}

(async () => {
  console.log("Checking users in Supabase Auth...");
  for (const email of emails) {
    const u = await findUserByEmail(email);
    if (!u) {
      console.log(`\n❌ NOT FOUND: ${email}`);
      continue;
    }
    const s = summarizeUser(u);
    const confirmed = Boolean(s.confirmed_at || s.email_confirmed_at);
    console.log(`\n✅ FOUND: ${email}`);
    console.log("confirmed =", confirmed);
    console.log(s);
  }
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
