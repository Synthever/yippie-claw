import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import DashboardView from './views/DashboardView'
import SystemView from './views/SystemView'
import LogsView from './views/LogsView'
import AgentsView from './views/AgentsView'
import ActivityView from './views/ActivityView'
import TasksView from './views/TasksView'
import ModelsView from './views/ModelsView'
import ToolsView from './views/ToolsView'
import { api } from './api'

export type View =
  | 'dashboard'
  | 'system'
  | 'logs'
  | 'agents'
  | 'activity'
  | 'tasks'
  | 'models'
  | 'tools'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [gwOk, setGwOk] = useState(false)

  useEffect(() => {
    const check = () =>
      api.health()
        .then(() => setGwOk(true))
        .catch(() => setGwOk(false))
    check()
    const t = setInterval(check, 15_000)
    return () => clearInterval(t)
  }, [])

  const VIEW_MAP: Record<View, React.ReactNode> = {
    dashboard: <DashboardView />,
    system:    <SystemView />,
    logs:      <LogsView />,
    agents:    <AgentsView />,
    activity:  <ActivityView />,
    tasks:     <TasksView />,
    models:    <ModelsView />,
    tools:     <ToolsView />,
  }

  return (
    <div className="app-shell">
      <Sidebar active={view} onChange={setView} gwOk={gwOk} />
      <main className="main-content">
        {VIEW_MAP[view]}
      </main>
    </div>
  )
}
