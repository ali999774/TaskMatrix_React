import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")
  process.exit(1)
}

// Ensure you run this with the SERVICE ROLE key if RLS blocks read/delete,
// e.g.: VITE_SUPABASE_ANON_KEY=your_service_role_key npx ts-node scripts/cleanup_duplicates.ts
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Fetching active recurring tasks...")
  // Fetch active recurring tasks
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, deleted_at, due_date, created_at, recurring, recur_frequency, recur_days')
    .eq('status', 'todo')
    .is('deleted_at', null)
    .eq('recurring', true)

  if (error) {
    console.error("Error fetching tasks:", error)
    return
  }

  if (!data || data.length === 0) {
    console.log("No active recurring tasks found.")
    return
  }

  console.log(`Found ${data.length} active recurring tasks. Finding duplicates...`)

  // Group by "title|due_date|recur_frequency|recur_days"
  const groups = new Map()

  for (const task of data) {
    const key = `${task.title}|${task.due_date || 'null'}|${task.recur_frequency || 'null'}|${JSON.stringify(task.recur_days || null)}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(task)
  }

  let totalDeleted = 0

  for (const [key, tasks] of groups.entries()) {
    if (tasks.length > 1) {
      console.log(`\nFound group with ${tasks.length} duplicates: ${key}`)
      // Sort by created_at descending (newest first)
      tasks.sort((a, b) => {
        const timeA = a.created_at || ''
        const timeB = b.created_at || ''
        return timeB.localeCompare(timeA)
      })

      // Keep the newest one
      const keep = tasks[0]
      const toDelete = tasks.slice(1)
      console.log(`  Keeping: ${keep.id} (Created: ${keep.created_at})`)

      for (const t of toDelete) {
        console.log(`  Soft-deleting: ${t.id} (Created: ${t.created_at})`)
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', t.id)
        
        if (updateError) {
          console.error(`  Failed to delete ${t.id}:`, updateError)
        } else {
          totalDeleted++
        }
      }
    }
  }

  console.log(`\nCleanup complete. Soft-deleted ${totalDeleted} redundant tasks.`)
}

run()
