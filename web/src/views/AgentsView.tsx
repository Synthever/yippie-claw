import { useEffect, useState } from 'react'
import { api, type Agent } from '../api'

interface ModalState {
  mode: 'create' | 'edit'
  agent?: Agent
}

export default function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [search, setSearch] = useState('')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.agentsList()
      setAgents(Array.isArray(data) ? data : Object.values(data as any))
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteAgent(id: string) {
    if (!confirm(`Delete agent ${id}?`)) return
    setActionBusy(id)
    try { await api.agentsDelete(id); await load() }
    catch (e: any) { alert(e.message) }
    setActionBusy(null)
  }

  const filtered = agents.filter((a) =>
    !search || [a.id, a.name, a.description].some((f) => String(f ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Agents</div>
          <div className="page-subtitle">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</div>
        </div>
        <div className="flex-row">
          <input
            className="search-bar"
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn primary" onClick={() => setModal({ mode: 'create' })}>
            + New Agent
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="badge danger mb-16">{error}</div>}
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <div>No agents found</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => (
                  <tr key={agent.id}>
                    <td className="text-mono">{agent.id}</td>
                    <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{agent.name ?? '—'}</td>
                    <td className="text-mono text-muted">{agent.model ?? '—'}</td>
                    <td>
                      <span className={`badge ${
                        agent.status === 'running' ? 'success' :
                        agent.status === 'paused' ? 'warning' :
                        agent.status === 'stopped' ? 'danger' : 'neutral'
                      }`}>
                        {agent.status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="text-muted" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.description ?? '—'}
                    </td>
                    <td>
                      <div className="flex-row">
                        <button
                          className="btn sm"
                          onClick={() => setModal({ mode: 'edit', agent })}
                        >Edit</button>
                        <button
                          className="btn sm danger"
                          disabled={actionBusy === agent.id}
                          onClick={() => deleteAgent(agent.id)}
                        >
                          {actionBusy === agent.id ? <span className="spinner" /> : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <AgentModal
          mode={modal.mode}
          agent={modal.agent}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.mode === 'create') {
              await api.agentsCreate(data)
            } else {
              await api.agentsUpdate(modal.agent!.id, data)
            }
            setModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// ── Agent create/edit modal ────────────────────────────────────────────────────
interface AgentModalProps {
  mode: 'create' | 'edit'
  agent?: Agent
  onClose: () => void
  onSave: (data: Partial<Agent>) => Promise<void>
}

function AgentModal({ mode, agent, onClose, onSave }: AgentModalProps) {
  const [form, setForm] = useState({
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    model: agent?.model ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit() {
    setBusy(true); setErr('')
    try { await onSave(form) }
    catch (e: any) { setErr(e.message); setBusy(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'create' ? 'New Agent' : `Edit Agent: ${agent?.id}`}</h3>
        {err && <div className="badge danger mb-16">{err}</div>}
        <div className="form-field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="my-agent" />
        </div>
        <div className="form-field">
          <label>Model</label>
          <input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="e.g. gpt-4o" />
        </div>
        <div className="form-field">
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
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
