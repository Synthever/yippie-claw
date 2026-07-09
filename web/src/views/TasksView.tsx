import { useEffect, useState } from 'react'
import { api, type CronJob, type CronRun, fmtTs } from '../api'

interface ModalState { mode: 'create' | 'edit'; job?: CronJob }

export default function TasksView() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [runs, setRuns] = useState<{ [id: string]: CronRun[] }>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.cronList()
      setJobs(Array.isArray(data) ? data : Object.values(data as any))
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadRuns(id: string) {
    if (runs[id]) { setExpanded(expanded === id ? null : id); return }
    setActionBusy(id)
    try {
      const data = await api.cronRuns(id)
      setRuns((r) => ({ ...r, [id]: Array.isArray(data) ? data : [] }))
      setExpanded(id)
    } catch {}
    setActionBusy(null)
  }

  async function runNow(id: string) {
    setActionBusy('run-' + id)
    try { await api.cronRun(id); await load() }
    catch (e: any) { alert(e.message) }
    setActionBusy(null)
  }

  async function deleteJob(id: string) {
    if (!confirm(`Delete cron job "${id}"?`)) return
    try { await api.cronDelete(id); await load() }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tasks &amp; Cron</div>
          <div className="page-subtitle">{jobs.length} scheduled job{jobs.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn primary" onClick={() => setModal({ mode: 'create' })}>
          + Add Job
        </button>
      </div>

      <div className="page-body">
        {error && <div className="badge danger mb-16">{error}</div>}
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⏱</div>
            <div>No cron jobs configured</div>
            <button className="btn primary mt-16" onClick={() => setModal({ mode: 'create' })}>
              Create first job
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Last Run</th>
                  <th>Next Run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.flatMap((job) => [
                  <tr key={job.id}>
                    <td className="text-mono">{job.id}</td>
                    <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{job.name ?? '—'}</td>
                    <td className="text-mono text-muted">{job.schedule ?? '—'}</td>
                    <td>
                      <span className={`badge ${
                        job.enabled === false ? 'neutral' :
                        job.status === 'running' ? 'info' :
                        job.status === 'failed' ? 'danger' :
                        job.status === 'completed' ? 'success' : 'neutral'
                      }`}>
                        {job.enabled === false ? 'disabled' : (job.status ?? 'idle')}
                      </span>
                    </td>
                    <td className="text-muted text-sm">{fmtTs(job.lastRun)}</td>
                    <td className="text-muted text-sm">{fmtTs(job.nextRun)}</td>
                    <td>
                      <div className="flex-row">
                        <button
                          className="btn sm success"
                          disabled={actionBusy === 'run-' + job.id}
                          onClick={() => runNow(job.id)}
                          title="Run now"
                        >▶ Run</button>
                        <button
                          className="btn sm"
                          onClick={() => loadRuns(job.id)}
                          disabled={actionBusy === job.id}
                        >
                          {actionBusy === job.id ? <span className="spinner" /> : (expanded === job.id ? '▲ Runs' : '▼ Runs')}
                        </button>
                        <button className="btn sm" onClick={() => setModal({ mode: 'edit', job })}>Edit</button>
                        <button className="btn sm danger" onClick={() => deleteJob(job.id)}>✕</button>
                      </div>
                    </td>
                  </tr>,
                  // Expanded runs sub-table
                  expanded === job.id && runs[job.id] && (
                    <tr key={`${job.id}-runs`}>
                      <td colSpan={7} style={{ padding: 0, background: 'var(--bg)' }}>
                        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
                          <div className="card-title mb-16" style={{ marginBottom: 10 }}>Run History</div>
                          {runs[job.id].length === 0 ? (
                            <div className="text-muted text-sm">No runs recorded</div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  {['Started', 'Ended', 'Status', 'Output'].map((h) => (
                                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {runs[job.id].map((run, i) => (
                                  <tr key={i}>
                                    <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtTs(run.startedAt)}</td>
                                    <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtTs(run.endedAt)}</td>
                                    <td style={{ padding: '5px 10px' }}>
                                      <span className={`badge ${run.status === 'completed' || run.status === 'success' ? 'success' : run.status === 'failed' ? 'danger' : 'neutral'}`}>
                                        {run.status ?? '—'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '5px 10px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {run.output ?? '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ])}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <CronModal
          mode={modal.mode}
          job={modal.job}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.mode === 'create') await api.cronAdd(data)
            else await api.cronUpdate(modal.job!.id, data)
            setModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// ── CronJob modal ─────────────────────────────────────────────────────────────
interface CronModalProps {
  mode: 'create' | 'edit'
  job?: CronJob
  onClose: () => void
  onSave: (data: Partial<CronJob>) => Promise<void>
}

function CronModal({ mode, job, onClose, onSave }: CronModalProps) {
  const [form, setForm] = useState({
    name: job?.name ?? '',
    schedule: job?.schedule ?? '0 * * * *',
    enabled: job?.enabled !== false,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit() {
    setBusy(true); setErr('')
    try { await onSave(form) }
    catch (e: any) { setErr(e.message); setBusy(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'create' ? 'New Cron Job' : `Edit: ${job?.id}`}</h3>
        {err && <div className="badge danger mb-16">{err}</div>}
        <div className="form-field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="daily-report" />
        </div>
        <div className="form-field">
          <label>Schedule (cron expression)</label>
          <input value={form.schedule} onChange={(e) => set('schedule', e.target.value)} placeholder="0 * * * *" />
        </div>
        <div className="form-field">
          <label style={{ flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            Enabled
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={submit}>
            {busy ? <span className="spinner" /> : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
