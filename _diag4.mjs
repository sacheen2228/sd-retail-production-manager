import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(
  fs.readFileSync('/home/sachin/Desktop/workspace/.env', 'utf8').split('\n')
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
)
const email = 'diag' + Date.now() + '@gmail.com'
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: su, error: sue } = await sb.auth.signUp({ email, password: 'TempPass123!' })
if (sue) { console.log('signUp ERR', sue.message); process.exit() }
console.log('signed up (confirmation needed?', su.session ? 'no' : 'yes', ')')
if (!su.session) { const { data, error } = await sb.auth.signInWithPassword({ email, password: 'TempPass123!' }); if (error) { console.log('signIn ERR', error.message); process.exit() } }
// signed in now; SELECT * is allowed for authenticated
const { data, error } = await sb.from('retailers').select('*').limit(1)
if (error) { console.log('select ERR', error.message); process.exit() }
console.log('retailers one row keys:', Object.keys(data[0] || {}).join(', '))
console.log('row:', JSON.stringify(data[0]))
