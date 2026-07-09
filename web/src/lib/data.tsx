// Shape-agnostic helpers. The Gateway returns loosely-typed payloads, so views
// normalize/pick instead of guessing one exact field name.

/** First defined/non-null value among candidate keys. */
export function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k]
    if (v != null && v !== '') return v as T
  }
  return undefined
}

const LIST_KEYS = [
  'items', 'list', 'data', 'results', 'entries',
  'tools', 'logs', 'lines', 'channels', 'agents', 'models', 'jobs', 'runs', 'sessions', 'providers',
]

/**
 * Normalize an arbitrary Gateway response into an array.
 * - array → as-is
 * - object with a known list field (e.g. { tools: [...] }) → that array
 * - plain object map → entries, each carrying its key as `__key`
 */
export function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const k of LIST_KEYS) if (Array.isArray(obj[k])) return obj[k] as any[]
    return Object.entries(obj).map(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? { __key: k, ...(v as object) }
        : { __key: k, value: v }
    )
  }
  return []
}

/** Compact, human-readable rendering of any value (no raw JSON blobs). */
export function fmtVal(v: unknown): string {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    return v.map((x) => (typeof x === 'object' ? fmtVal(x) : String(x))).join(', ')
  }
  if (typeof v === 'object') {
    const parts = Object.entries(v as object)
      .filter(([, x]) => x != null && x !== '')
      .map(([k, x]) => `${k}: ${typeof x === 'object' ? fmtVal(x) : x}`)
    return parts.length ? parts.join(' · ') : '—'
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}

/** Clean two-column key/value list for arbitrary objects. */
export function KV({ data }: { data: unknown }) {
  const entries =
    data && typeof data === 'object' && !Array.isArray(data)
      ? Object.entries(data as object)
      : [['value', data] as [string, unknown]]
  return (
    <div className="kv-list">
      {entries.map(([k, v]) => (
        <div className="kv-row" key={k}>
          <span className="kv-key">{k}</span>
          <span className="kv-val">{fmtVal(v)}</span>
        </div>
      ))}
    </div>
  )
}
