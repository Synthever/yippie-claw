import { type View } from '../App'

interface NavItem {
  id: View
  icon: string
  label: string
  section?: string
}

const NAV: NavItem[] = [
  { id: 'dashboard',  icon: '◈',  label: 'Overview',       section: 'Monitor' },
  { id: 'system',     icon: '⬡',  label: 'System',         },
  { id: 'logs',       icon: '📋', label: 'Logs',           },
  { id: 'agents',     icon: '🤖', label: 'Agents',         section: 'Manage' },
  { id: 'activity',   icon: '💬', label: 'Live Activity',  },
  { id: 'tasks',      icon: '⏱',  label: 'Tasks & Cron',  },
  { id: 'models',     icon: '🧠', label: 'Models',         section: 'Catalog' },
  { id: 'tools',      icon: '🔧', label: 'Tools',          },
]

interface Props {
  active: View
  onChange: (v: View) => void
  gwOk: boolean
  open?: boolean
}

export default function Sidebar({ active, onChange, gwOk, open }: Props) {
  return (
    <nav className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">🐾</div>
        <span>Yippie-Claw</span>
      </div>

      <div className="sidebar-nav">
        {NAV.map((item) => (
          <div key={item.id}>
            {item.section && (
              <div className="nav-section-label">{item.section}</div>
            )}
            <button
              className={`nav-item${active === item.id ? ' active' : ''}`}
              onClick={() => onChange(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="conn-badge">
          <div className={`conn-dot ${gwOk ? 'ok' : 'err'}`} />
          {gwOk ? 'Gateway connected' : 'Gateway offline'}
        </div>
      </div>
    </nav>
  )
}
