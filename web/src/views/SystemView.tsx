import { useSystem } from '../hooks/useSystem'
import Sparkline from '../components/Sparkline'
import { fmtBytes, fmtUptime } from '../api'

function pct(n: number) { return n.toFixed(1) + '%' }
function fillClass(v: number) { return v > 80 ? 'high' : v > 60 ? 'medium' : 'low' }

export default function SystemView() {
  const { snap, history, connected } = useSystem()

  const cpuH  = history.map((h) => h.cpu)
  const memH  = history.map((h) => (h.memUsed / (h.memTotal || 1)) * 100)
  const diskH = history.map((h) => (h.diskUsed / (h.diskTotal || 1)) * 100)

  const memPct  = snap ? (snap.memUsed / snap.memTotal) * 100 : 0
  const diskPct = snap ? (snap.diskUsed / snap.diskTotal) * 100 : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">System Monitor</div>
          <div className="page-subtitle">Real-time OS metrics — updates every 2s</div>
        </div>
        <span className={`badge ${connected ? 'success' : 'danger'}`}>
          {connected ? '● Live' : '○ Connecting…'}
        </span>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Big metric rows */}
        <div className="three-col">
          {/* CPU */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">CPU</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-h)' }}>
                {snap ? pct(snap.cpu) : '—'}
              </span>
            </div>
            <div className="progress-bar">
              <div className={`fill ${snap ? fillClass(snap.cpu) : 'low'}`}
                style={{ width: snap ? `${snap.cpu}%` : '0%' }} />
            </div>
            <div className="mt-12" />
            <Sparkline values={cpuH} width={260} height={48} color="#aa3bff" />
            {snap?.loadAvg && (
              <div className="text-muted text-sm mt-8">
                Load avg: {snap.loadAvg.map((l: number) => l.toFixed(2)).join(' / ')}
              </div>
            )}
          </div>

          {/* Memory */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Memory</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-h)' }}>
                {snap ? pct(memPct) : '—'}
              </span>
            </div>
            <div className="progress-bar">
              <div className={`fill ${snap ? fillClass(memPct) : 'low'}`}
                style={{ width: `${memPct}%` }} />
            </div>
            <div className="mt-12" />
            <Sparkline values={memH} width={260} height={48} color="#3b82f6" />
            <div className="text-muted text-sm mt-8">
              {snap ? `${fmtBytes(snap.memUsed)} used / ${fmtBytes(snap.memTotal)} total` : ''}
            </div>
          </div>

          {/* Disk */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Disk (/)</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-h)' }}>
                {snap ? pct(diskPct) : '—'}
              </span>
            </div>
            <div className="progress-bar">
              <div className={`fill ${snap ? fillClass(diskPct) : 'low'}`}
                style={{ width: `${diskPct}%` }} />
            </div>
            <div className="mt-12" />
            <Sparkline values={diskH} width={260} height={48} color="#22c55e" />
            <div className="text-muted text-sm mt-8">
              {snap ? `${fmtBytes(snap.diskUsed)} used / ${fmtBytes(snap.diskTotal)} total` : ''}
            </div>
          </div>
        </div>

        {/* Summary table */}
        <div className="card">
          <div className="card-header"><span className="card-title">System Snapshot</span></div>
          {snap ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {[
                    ['Uptime', fmtUptime(snap.uptime)],
                    ['CPU Usage', pct(snap.cpu)],
                    ['Memory Used', fmtBytes(snap.memUsed)],
                    ['Memory Total', fmtBytes(snap.memTotal)],
                    ['Memory Free', fmtBytes(snap.memTotal - snap.memUsed)],
                    ['Disk Used', fmtBytes(snap.diskUsed)],
                    ['Disk Total', fmtBytes(snap.diskTotal)],
                    ['Disk Free', fmtBytes(snap.diskTotal - snap.diskUsed)],
                    ...(snap.loadAvg ? [['Load Avg (1/5/15m)', snap.loadAvg.map((l: number) => l.toFixed(2)).join(' / ')]] : []),
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="text-muted" style={{ width: '40%' }}>{k}</td>
                      <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="spinner" />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
