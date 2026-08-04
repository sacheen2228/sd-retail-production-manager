import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(
  fs.readFileSync('/home/sachin/Desktop/workspace/.env', 'utf8').split('\n')
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
)
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function cols(table) {
  const { data, error } = await sb.from('information_schema.columns')
    .select('column_name,data_type,column_default,is_nullable')
    .eq('table_name', table)
  if (error) { console.log(table, 'ERR', error.message); return }
  console.log(`\n=== ${table} ===`)
  for (const c of data) console.log(`${c.column_name}: ${c.data_type}${c.is_nullable==='NO'?' NOT NULL':''}${c.column_default? ' def='+c.column_default : ''}`)
}
for (const t of ['retailers','vendors','fabrics','audit_log']) await cols(t)
