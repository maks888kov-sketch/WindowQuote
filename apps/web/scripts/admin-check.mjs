import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !service) {
      return res.status(500).json({
        ok: false,
        error: 'ENV missing'
      })
    }

    const supabase = createClient(url, service)

    const { data, error } =
      await supabase.auth.admin.listUsers()

    if (error) {
      return res.status(500).json({
        ok: false,
        error
      })
    }

    return res.json({
      ok: true,
      count: data.users.length,
      users: data.users.map(u => ({
        email: u.email,
        confirmed: !!u.email_confirmed_at
      }))
    })

  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    })
  }
}
