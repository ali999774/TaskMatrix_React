import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('tasks').select('*').ilike('title', '%Apples%')
  if (error) {
    console.log('Error:', error)
  } else {
    console.log('Tasks:', data ? data.length : 0)
    if (data && data.length > 0) {
      console.log('First 3:', data.slice(0, 3).map(d => ({id: d.id, status: d.status, deleted_at: d.deleted_at, due_date: d.due_date, created_at: d.created_at})))
    }
  }
}
run()
