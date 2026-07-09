import { useEffect, useState } from 'react'
import { useSystem } from '../hooks/useSystem'
import Sparkline from '../components/Sparkline'
import { api, fmtBytes, fmtUptime } from '../api'
import { asList, pick, fmtVal, KV } from '../lib/data'

function pct(n: number) { return n.toFixed(0) + '%' }
function fillClass(v: number) { return v > 80 ? 'high' : v > 60 ? 'medium' : 'low' }

interface UsageData { status?: unknown; cost?: unknown }

function channelStatus(ch: any): { label: string; ok: boolean } | null {
  if (typeof ch === 'string') return null
  const s = pick<string>(ch, 'status', 'state', 'health')
  const running = pick<boolean>(ch, 'running', 'connected', 'enabled', 'active')
  if (s != null) return { label: String(s), ok: /run|connect|ready|online|up|ok/i.test(String(s)) }
  if (typeof running === 'boolean') return { label: running ? 'running' : 'stopped', ok: running }
  return null
}

export default function DashboardView() {
  const { snap, history } = useSystem()
  const [gwStatus, setGwStatus] = useState<Record<string, unknown> | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [channels, setChannels] = useState<any[]>([])
  const [sessions, setSessions] = useState<unknown[]>([])

  useEffect(() => {
    api.status().then(setGwStatus as any).catch(() => null)
    api.usage().then(setUsage as any).catch(() => null)
    api.channels().then((d) => setChannels(asList(d))).catch(() => null)
    api.sessionsList().then((d) => setSessions(asList(d))).catch(() => null)
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
              {channels.filter((c) => channelStatus(c)?.ok).length} active
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
              <KV data={gwStatus} />
            ) : <div className="empty-state" style={{ padding: '20px 0' }}>Loading…</div>}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Channels</span></div>
            {channels.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>No channels</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {channels.map((ch, i) => {
                  const name = typeof ch === 'string'
                    ? ch
                    : (pick<string>(ch, 'name', 'id', 'type', 'channel', 'kind') ?? ch.__key ?? `#${i}`)
                  const st = channelStatus(ch)
                  const detail = typeof ch === 'string' ? '' : fmtVal({ ...ch, __key: undefined, name: undefined })
                  return (
                    <div key={i} className="flex-row" style={{ justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: 'var(--text-h)', fontSize: 13 }}>{name}</span>
                      {st ? (
                        <span className={`badge ${st.ok ? 'success' : 'neutral'}`}>{st.label}</span>
                      ) : (
                        <span className="text-muted text-sm" style={{ textAlign: 'right', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {detail || '—'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Usage */}
        {usage && <UsageCard usage={usage} />}
      </div>
    </div>
  )
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}

function UsageCard({ usage }: { usage: UsageData }) {
  const status = (usage.status ?? {}) as Record<string, unknown>
  // Scalar summary metrics (tokens, cost, requests…)
  const scalars = Object.entries(status).filter(([, v]) => typeof v === 'number' || typeof v === 'string')
  // Per-agent breakdown, whatever it is called
  const perAgentRaw = pick(status, 'byAgent', 'agents', 'perAgent', 'usage') ?? pick(usage as any, 'byAgent')
  const perAgent = perAgentRaw ? asList(perAgentRaw) : []

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Usage</span></div>

      {scalars.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: perAgent.length ? 18 : 0 }}>
          {scalars.slice(0, 8).map(([k, v]) => (
            <div key={k} className="stat-card" style={{ padding: '12px 14px' }}>
              <div className="stat-label">{k}</div>
              <div style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: 18 }}>
                {typeof v === 'number' ? v.toLocaleString() : String(v)}
              </div>
            </div>
          ))}
        </div>
      )}

      {perAgent.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Agent</th><th>Tokens</th><th>Input</th><th>Output</th><th>Cost</th></tr>
            </thead>
            <tbody>
              {perAgent.map((a: any, i: number) => {
                const name = pick<string>(a, 'agentId', 'agent', 'id', 'name') ?? a.__key ?? `#${i}`
                const total = num(pick(a, 'totalTokens', 'tokens', 'tokensUsed', 'value'))
                const input = num(pick(a, 'inputTokens', 'input', 'promptTokens'))
                const output = num(pick(a, 'outputTokens', 'output', 'completionTokens'))
                const cost = num(pick(a, 'cost', 'costUsd', 'usd'))
                return (
                  <tr key={i}>
                    <td className="text-mono" style={{ color: 'var(--text-h)' }}>{name}</td>
                    <td>{total != null ? total.toLocaleString() : '—'}</td>
                    <td className="text-muted">{input != null ? input.toLocaleString() : '—'}</td>
                    <td className="text-muted">{output != null ? output.toLocaleString() : '—'}</td>
                    <td className="text-muted">{cost != null ? `$${cost.toFixed(4)}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {scalars.length === 0 && perAgent.length === 0 && (
        <div className="text-muted text-sm">No usage data reported.</div>
      )}
    </div>
  )
}
