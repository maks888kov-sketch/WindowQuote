import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon || !service) {
  console.error('Missing env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, service, { auth: { persistSession: false } })

async function makeUser(email) {
  const password = 'Passw0rd!' + Math.random().toString(16).slice(2)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return { userId: data.user.id, password }
}

async function makeAuthedClient(email, password) {
  const c = createClient(url, anon, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

async function rpcCreateOrg(client, name) {
  const { data, error } = await client.rpc('create_org', { org_name: name })
  if (error) throw error
  // Подстрой под твой return: либо {id}, либо uuid напрямую
  const orgId = typeof data === 'string' ? data : (data?.id ?? data?.org_id)
  if (!orgId) throw new Error('create_org did not return org id: ' + JSON.stringify(data))
  return orgId
}

async function main() {
  // 1) создаём 2 юзера
  const aEmail = `a_${Date.now()}@test.local`
  const bEmail = `b_${Date.now()}@test.local`

  const userA = await makeUser(aEmail)
  const userB = await makeUser(bEmail)

  const A = await makeAuthedClient(aEmail, userA.password)
  const B = await makeAuthedClient(bEmail, userB.password)

  // 2) создаём 2 org
  const orgA = await rpcCreateOrg(A, 'Org A')
  const orgB = await rpcCreateOrg(B, 'Org B')

  // 3) A добавляет customer "AAA" в orgA
  const insA = await A.from('customers').insert({ org_id: orgA, name: 'AAA' }).select().single()
  if (insA.error) throw insA.error
  const customerAAA = insA.data

  // 4) B не должен видеть "AAA"
  const selB = await B.from('customers').select('id,name,org_id').eq('name', 'AAA')
  if (selB.error) throw selB.error
  if (selB.data.length !== 0) {
    throw new Error('FAIL: User B can see customer AAA from orgA')
  }

  // 5) B пытается вставить customer в orgA — должно упасть (RLS)
  const insB = await B.from('customers').insert({ org_id: orgA, name: 'HACK' }).select()
  if (!insB.error) {
    throw new Error('FAIL: User B could insert into чужую orgA')
  }
  // ожидаем что это именно RLS/permission
  console.log('Insert blocked as expected:', insB.error.message)

  console.log('✅ OK: tenant isolation works')
  console.log({ orgA, orgB, customerAAA: customerAAA.id })
}

main().catch((e) => {
  console.error('❌ TEST FAILED:', e)
  process.exit(1)
})
