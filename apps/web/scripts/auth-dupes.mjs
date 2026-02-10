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
].map(e => e.toLowerCase());

async function admin(path) {
  const url = `${SUPABASE_URL}/auth/v1${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

(async () => {
  let page = 1;
  const perPage = 100;
  const matches = [];

  while (page <= 30) {
    const r = await admin(`/admin/users?page=${page}&per_page=${perPage}`);
    if (!r.ok) throw new Error(`admin/users failed: ${r.status}`);
    const users = Array.isArray(r.json?.users) ? r.json.users : (Array.isArray(r.json) ? r.json : []);
    if (!users.length) break;

    for (const u of users) {
      const em = (u.email || "").toLowerCase();
      if (emails.includes(em)) {
        matches.push({
          email: u.email,
          id: u.id,
          confirmed_at: u.confirmed_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
    }
    page += 1;
  }

  console.log("Matches:");
  console.table(matches);

  const byEmail = matches.reduce((acc, x) => {
    acc[x.email] = (acc[x.email] || 0) + 1;
    return acc;
  }, {});
  console.log("Counts:", byEmail);
})().catch(e => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
