import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('tasks').select('title, status, deleted_at').limit(20)
  if (error) {
    console.log('Error:', error)
  } else {
    console.log('Total Tasks in result:', data ? data.length : 0)
    if (data && data.length > 0) {
      console.log(data)
    }
  }
}
run()
