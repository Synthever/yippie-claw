import { useEffect, useState } from 'react'
import { useSystem } from '../hooks/useSystem'
import Sparkline from '../components/Sparkline'
import { api, fmtBytes, fmtUptime } from '../api'

function pct(n: number) { return n.toFixed(0) + '%' }
function fillClass(v: number) { return v > 80 ? 'high' : v > 60 ? 'medium' : 'low' }

interface GwStatus { version?: string; agents?: number; sessions?: number; [k: string]: unknown }
interface UsageData { status?: { tokensUsed?: number; cost?: number }; cost?: unknown }
interface ChannelData { name?: string; status?: string; type?: string; [k: string]: unknown }

export default function DashboardView() {
  const { snap, history } = useSystem()
  const [gwStatus, setGwStatus] = useState<GwStatus | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [channels, setChannels] = useState<ChannelData[]>([])
  const [sessions, setSessions] = useState<unknown[]>([])

  useEffect(() => {
    api.status().then(setGwStatus as any).catch(() => null)
    api.usage().then(setUsage as any).catch(() => null)
    api.channels().then((d) => setChannels(Array.isArray(d) ? d as ChannelData[] : Object.values(d as any))).catch(() => null)
    api.sessionsList().then(setSessions).catch(() => null)
  }, [])

  const cpuH = history.map((h) => h.cpu)
  const memH = history.map((h) => (h.memUsed / (h.memTotal || 1)) * 100)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">System health &amp; activity at a glance</div>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* System stat cards */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon">🖥</div>
            <div className="stat-label">CPU Usage</div>
            <div className="stat-value">{snap ? pct(snap.cpu) : '—'}</div>
            <div className="progress-bar mt-4">
              <div className={`fill ${snap ? fillClass(snap.cpu) : 'low'}`}
                style={{ width: snap ? `${snap.cpu}%` : '0%' }} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💾</div>
            <div className="stat-label">Memory</div>
            <div className="stat-value">
              {snap ? pct((snap.memUsed / snap.memTotal) * 100) : '—'}
            </div>
            <div className="stat-sub">{snap ? `${fmtBytes(snap.memUsed)} / ${fmtBytes(snap.memTotal)}` : ''}</div>
            <div className="progress-bar mt-4">
              <div className={`fill ${snap ? fillClass((snap.memUsed / snap.memTotal) * 100) : 'low'}`}
                style={{ width: snap ? `${(snap.memUsed / snap.memTotal) * 100}%` : '0%' }} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💿</div>
            <div className="stat-label">Disk Used</div>
            <div className="stat-value">
              {snap ? pct((snap.diskUsed / snap.diskTotal) * 100) : '—'}
            </div>
            <div className="stat-sub">{snap ? `${fmtBytes(snap.diskUsed)} / ${fmtBytes(snap.diskTotal)}` : ''}</div>
            <div className="progress-bar mt-4">
              <div className={`fill ${snap ? fillClass((snap.diskUsed / snap.diskTotal) * 100) : 'low'}`}
                style={{ width: snap ? `${(snap.diskUsed / snap.diskTotal) * 100}%` : '0%' }} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⏱</div>
            <div className="stat-label">Uptime</div>
            <div className="stat-value">{snap ? fmtUptime(snap.uptime) : '—'}</div>
            <div className="stat-sub">
              {snap?.loadAvg ? `Load: ${snap.loadAvg.map((l: number) => l.toFixed(2)).join(' ')}` : ''}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📡</div>
            <div className="stat-label">Sessions</div>
            <div className="stat-value">{sessions.length}</div>
            <div className="stat-sub">active sessions</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🔌</div>
            <div className="stat-label">Channels</div>
            <div className="stat-value">{channels.length}</div>
            <div className="stat-sub">
              {channels.filter((c) => c.status === 'running' || c.status === 'connected').length} active
            </div>
          </div>
        </div>

        {/* CPU + Mem sparklines */}
        <div className="two-col">
          <div className="card">
            <div className="card-header">
              <span className="card-title">CPU History</span>
              <span className="text-muted text-sm">{snap ? pct(snap.cpu) : '—'}</span>
            </div>
            <Sparkline values={cpuH} width={400} height={52} color="#aa3bff" />
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Memory History</span>
              <span className="text-muted text-sm">{snap ? pct((snap.memUsed / snap.memTotal) * 100) : '—'}</span>
            </div>
            <Sparkline values={memH} width={400} height={52} color="#3b82f6" />
          </div>
        </div>

        {/* Gateway status + Channels */}
        <div className="two-col">
          <div className="card">
            <div className="card-header"><span className="card-title">Gateway Status</span></div>
            {gwStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(gwStatus).slice(0, 10).map(([k, v]) => (
                  <div key={k} className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <span className="text-muted text-sm">{k}</span>
                    <span className="text-mono" style={{ color: 'var(--text-h)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state" style={{ padding: '20px 0' }}>Loading…</div>}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Channels</span></div>
            {channels.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>No channels</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {channels.map((ch, i) => (
                  <div key={i} className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-h)', fontSize: 13 }}>{ch.name ?? ch.type ?? `#${i}`}</span>
                    <span className={`badge ${ch.status === 'running' || ch.status === 'connected' ? 'success' : 'neutral'}`}>
                      {ch.status ?? 'unknown'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Usage */}
        {usage && (
          <div className="card">
            <div className="card-header"><span className="card-title">Usage</span></div>
            <div style={{ display: 'flex', gap: 32 }}>
              {usage.status && Object.entries(usage.status).slice(0, 6).map(([k, v]) => (
                <div key={k}>
                  <div className="text-muted text-sm">{k}</div>
                  <div style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: 16 }}>
                    {typeof v === 'number' ? v.toLocaleString() : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
