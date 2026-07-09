import { Component, useEffect, useState, type ReactNode } from 'react'
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

const TITLES: Record<View, string> = {
  dashboard: 'Overview', system: 'System', logs: 'Logs', agents: 'Agents',
  activity: 'Live Activity', tasks: 'Tasks & Cron', models: 'Models', tools: 'Tools',
}

// Keep one crashing view from blanking the whole app.
class ErrorBoundary extends Component<{ view: View; children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {}
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidUpdate(prev: { view: View }) {
    if (prev.view !== this.props.view && this.state.err) this.setState({ err: undefined })
  }
  render() {
    if (this.state.err) {
      return (
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <div>This view hit an error.</div>
          <div className="text-muted text-sm mt-8">{this.state.err.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [gwOk, setGwOk] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const check = () =>
      api.health()
        .then(() => setGwOk(true))
        .catch(() => setGwOk(false))
    check()
    const t = setInterval(check, 15_000)
    return () => clearInterval(t)
  }, [])

  const VIEW_MAP: Record<View, ReactNode> = {
    dashboard: <DashboardView />,
    system:    <SystemView />,
    logs:      <LogsView />,
    agents:    <AgentsView />,
    activity:  <ActivityView />,
    tasks:     <TasksView />,
    models:    <ModelsView />,
    tools:     <ToolsView />,
  }

  function go(v: View) { setView(v); setNavOpen(false) }

  return (
    <div className="app-shell">
      <Sidebar active={view} onChange={go} gwOk={gwOk} open={navOpen} />
      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}
      <main className="main-content">
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="Open menu">☰</button>
          <span className="mobile-title">{TITLES[view]}</span>
        </div>
        <ErrorBoundary view={view}>{VIEW_MAP[view]}</ErrorBoundary>
      </main>
    </div>
  )
}
