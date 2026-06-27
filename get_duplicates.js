import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('tasks').select('id, title, status, deleted_at, created_at, recurring, due_date').ilike('title', '%Apples%')
  console.log(JSON.stringify(data, null, 2))
}
run()
