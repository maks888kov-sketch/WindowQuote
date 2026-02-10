import { createClient } from '@supabase/supabase-js';

function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(res, 500, {
        ok: false,
        error: 'MISSING_ENV',
        missing: [
          !SUPABASE_URL ? 'SUPABASE_URL' : null,
          !SERVICE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY (fallback: SUPABASE_SERVICE_ROLE)' : null,
        ].filter(Boolean),
      });
    }

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';

    // ВАЖНО: если токена нет — это не orgId ошибка, это 401
    if (!token) {
      return json(res, 401, { ok: false, error: 'MISSING_AUTH' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Проверяем, что токен вообще валидный (пользователь залогинен)
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(res, 401, { ok: false, error: 'INVALID_AUTH', details: userErr?.message });
    }

    // Список пользователей (без orgId)
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

    if (error) {
      return json(res, 500, { ok: false, error: 'LIST_USERS_FAILED', details: error.message });
    }

    return json(res, 200, { ok: true, users: data?.users ?? [] });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'UNHANDLED', details: String(e?.message || e) });
  }
}
