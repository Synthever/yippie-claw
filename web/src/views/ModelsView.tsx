import { useEffect, useState } from 'react'
import { api, type Model, fmtTs } from '../api'
import { asList, pick } from '../lib/data'

export default function ModelsView() {
  const [models, setModels] = useState<Model[]>([])
  const [auth, setAuth] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [m, a] = await Promise.allSettled([api.models(), api.modelsAuth()])
        if (m.status === 'fulfilled') setModels(Array.isArray(m.value) ? m.value : Object.values(m.value as any))
        if (a.status === 'fulfilled') setAuth(a.value as any)
      } catch (e: any) { setError(e.message) }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = models.filter((m) =>
    !search || [m.id, m.alias].some((f) => String(f ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  const available = models.filter((m) => m.available !== false).length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Models</div>
          <div className="page-subtitle">{models.length} models · {available} available</div>
        </div>
        <input
          className="search-bar"
          placeholder="Search models…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && <div className="badge danger">{error}</div>}

        {/* Auth status */}
        {auth && <AuthCard auth={auth} />}

        {/* Model table */}
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧠</div>
            <div>No models found</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Model ID</th>
                  <th>Alias</th>
                  <th>Context Window</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((model) => (
                  <tr key={model.id}>
                    <td className="text-mono" style={{ color: 'var(--text-h)' }}>{model.id}</td>
                    <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{model.alias ?? '—'}</td>
                    <td className="text-muted">
                      {model.contextWindow
                        ? (model.contextWindow >= 1000
                            ? `${(model.contextWindow / 1000).toFixed(0)}K`
                            : String(model.contextWindow))
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge ${model.available !== false ? 'success' : 'danger'}`}>
                        {model.available !== false ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AuthCard({ auth }: { auth: Record<string, unknown> }) {
  // Shape seen from Gateway: { ts, providers: [{ provider, display, authenticated|ok, ... }] }
  const providers = asList(pick(auth, 'providers') ?? auth)
  const ts = pick<number>(auth, 'ts', 'updatedAt', 'checkedAt')

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Provider Auth Status</span>
        {ts != null && <span className="text-muted text-sm">as of {fmtTs(ts)}</span>}
      </div>
      {providers.length === 0 ? (
        <div className="text-muted text-sm">No provider info reported.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {providers.map((p: any, i: number) => {
            const name = pick<string>(p, 'provider', 'name', 'id', 'display', '__key') ?? `#${i}`
            const authed = pick(p, 'authenticated', 'ok', 'authed', 'valid', 'value')
            const isOk = authed === true || /ok|authed|valid|active/i.test(String(authed ?? ''))
            const label = typeof authed === 'boolean'
              ? (authed ? 'authed' : 'not authed')
              : String(authed ?? 'unknown')
            return (
              <div key={i} className="flex-row" style={{ background: 'var(--bg-hover)', padding: '8px 14px', borderRadius: 8, gap: 10 }}>
                <span style={{ color: 'var(--text-h)', fontWeight: 500, fontSize: 13 }}>{name}</span>
                <span className={`badge ${isOk ? 'success' : 'neutral'}`}>{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
