import { useTasks } from './hooks/useTasks'
import QuadrantPanel from './components/QuadrantPanel'
import type { Quadrant } from './types'

export default function App() {
  const { tasks, loading, addTask, toggleTask, deleteTask } = useTasks()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        Loading...
      </div>
    )
  }

  const quadrants: Quadrant[] = [1, 2, 3, 4]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">TaskMatrix</h1>
        <p className="text-sm text-slate-500 mt-1">Eisenhower Matrix</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {quadrants.map((q) => (
          <QuadrantPanel
            key={q}
            quadrant={q}
            tasks={tasks.filter((t) => t.quadrant === q)}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onAdd={addTask}
          />
        ))}
      </div>
    </div>
  )
}
