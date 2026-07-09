import { useEffect, useRef } from 'react'
import { useLogs, type LogEntry } from '../hooks/useLogs'

function levelClass(level?: string): string {
  const l = (level ?? '').toLowerCase()
  if (l === 'error' || l === 'err') return 'error'
  if (l === 'warn' || l === 'warning') return 'warn'
  if (l === 'debug') return 'debug'
  return 'info'
}

function renderLine(entry: LogEntry, i: number) {
  const ts = entry.ts ?? entry.time ?? ''
  const level = entry.level ?? entry.lvl ?? ''
  const msg = entry.msg ?? entry.message ?? JSON.stringify(entry)
  const tsRaw = typeof ts === 'string' || typeof ts === 'number' ? ts : ''
  const tsStr = tsRaw ? new Date(tsRaw).toLocaleTimeString() : ''

  return (
    <div className="log-line" key={i}>
      <span className="log-ts">{tsStr}</span>
      <span className={`log-level ${levelClass(String(level))}`}>{String(level).toUpperCase().slice(0, 5)}</span>
      <span className="log-msg">{String(msg)}</span>
    </div>
  )
}

export default function LogsView() {
  const { lines, connected, clear } = useLogs()
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Logs</div>
          <div className="page-subtitle">Live tail from Gateway — {lines.length} entries</div>
        </div>
        <div className="flex-row">
          <span className={`badge ${connected ? 'success' : 'warning'}`}>
            {connected ? '● Live' : '○ Connecting…'}
          </span>
          <button className="btn sm" onClick={clear}>Clear</button>
          <label className="flex-row text-sm text-muted" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              defaultChecked
              onChange={(e) => { autoScrollRef.current = e.target.checked }}
            />
            Auto-scroll
          </label>
        </div>
      </div>

      <div style={{ flex: 1, padding: '14px 28px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          className="log-viewer"
          style={{ flex: 1 }}
          onScroll={(e) => {
            const el = e.currentTarget
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
            autoScrollRef.current = atBottom
          }}
        >
          {lines.length === 0 ? (
            <div className="text-muted text-sm">Waiting for log entries…</div>
          ) : (
            lines.map((l, i) => renderLine(l, i))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
