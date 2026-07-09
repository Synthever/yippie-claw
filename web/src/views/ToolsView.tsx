import { useEffect, useState } from 'react'
import { api, type Tool } from '../api'

export default function ToolsView() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.tools()
      .then((data) => {
        const arr = Array.isArray(data)
          ? data
          : typeof data === 'object' && data !== null
            ? Object.values(data as Record<string, Tool>)
            : []
        setTools(arr as Tool[])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = ['all', ...Array.from(new Set(tools.map((t) => t.category ?? 'uncategorized')))]

  const filtered = tools.filter((t) => {
    const matchSearch = !search ||
      [t.name, t.description, t.category].some((f) =>
        String(f ?? '').toLowerCase().includes(search.toLowerCase())
      )
    const matchCat = filter === 'all' || (t.category ?? 'uncategorized') === filter
    return matchSearch && matchCat
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tools Catalog</div>
          <div className="page-subtitle">{tools.length} tools available</div>
        </div>
        <div className="flex-row">
          <select
            className="search-bar"
            style={{ width: 160 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
            ))}
          </select>
          <input
            className="search-bar"
            placeholder="Search tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="page-body">
        {error && <div className="badge danger mb-16">{error}</div>}
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔧</div>
            <div>No tools found</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tool, i) => (
                  <tr key={tool.name ?? i}>
                    <td className="text-mono" style={{ color: 'var(--text-h)', whiteSpace: 'nowrap' }}>
                      {tool.name}
                    </td>
                    <td>
                      {tool.category ? (
                        <span className="badge info">{tool.category}</span>
                      ) : '—'}
                    </td>
                    <td className="text-muted" style={{
                      maxWidth: 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {tool.description ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${tool.enabled !== false ? 'success' : 'neutral'}`}>
                        {tool.enabled !== false ? 'Yes' : 'No'}
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
