// ── Generic fetch helpers ──────────────────────────────────────────────────────
async function get<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function put<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function del<T>(url: string): Promise<T> {
  const r = await fetch(url, { method: 'DELETE' })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  // Health
  health: () => get('/api/health'),
  status: () => get('/api/status'),

  // System
  system: () => get('/api/system'),

  // Usage
  usage: () => get('/api/usage'),

  // Channels
  channels: () => get<unknown[]>('/api/channels'),

  // Models
  models: () => get<Model[]>('/api/models'),
  modelsAuth: () => get('/api/models/auth'),

  // Agents
  agentsList: () => get<Agent[]>('/api/agents'),
  agentsCreate: (body: Partial<Agent>) => post<Agent>('/api/agents', body),
  agentsUpdate: (id: string, body: Partial<Agent>) => put<Agent>(`/api/agents/${id}`, body),
  agentsDelete: (id: string) => del(`/api/agents/${id}`),
  agentFiles: (id: string) => get<string[]>(`/api/agents/${id}/files`),
  agentFileGet: (id: string, path: string) => get<{ content: string }>(`/api/agents/${id}/files/${path}`),
  agentFileSet: (id: string, path: string, content: string) =>
    put(`/api/agents/${id}/files/${path}`, { content }),

  // Sessions
  sessionsList: () => get<Session[]>('/api/sessions'),
  sessionsDelete: (id: string) => del(`/api/sessions/${id}`),

  // Cron/Tasks
  cronList: () => get<CronJob[]>('/api/cron'),
  cronAdd: (body: Partial<CronJob>) => post<CronJob>('/api/cron', body),
  cronUpdate: (id: string, body: Partial<CronJob>) => put<CronJob>(`/api/cron/${id}`, body),
  cronDelete: (id: string) => del(`/api/cron/${id}`),
  cronRun: (id: string) => post(`/api/cron/${id}/run`),
  cronRuns: (id: string) => get<CronRun[]>(`/api/cron/${id}/runs`),

  // Tools
  tools: () => get<Tool[]>('/api/tools'),

  // Logs (one-shot)
  logs: (lines = 200) => get<unknown>(`/api/logs?lines=${lines}`),
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string
  name?: string
  description?: string
  model?: string
  status?: string
  [k: string]: unknown
}

export interface Session {
  id: string
  agentId?: string
  channel?: string
  createdAt?: string | number
  messageCount?: number
  lastActivity?: string | number
  preview?: string
  [k: string]: unknown
}

export interface CronJob {
  id: string
  name?: string
  schedule?: string
  enabled?: boolean
  lastRun?: string | number
  nextRun?: string | number
  status?: string
  [k: string]: unknown
}

export interface CronRun {
  id?: string
  startedAt?: string | number
  endedAt?: string | number
  status?: string
  output?: string
  [k: string]: unknown
}

export interface Model {
  id: string
  alias?: string
  available?: boolean
  contextWindow?: number
  [k: string]: unknown
}

export interface Tool {
  name: string
  description?: string
  category?: string
  enabled?: boolean
  [k: string]: unknown
}

// ── Chat stream ───────────────────────────────────────────────────────────────
export async function streamChat(
  message: string,
  sessionKey: string,
  onDelta: (text: string) => void,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionKey }),
  })
  if (!res.ok || !res.body) throw new Error(`chat error: ${res.status}`)

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const blocks = buf.split('\n\n')
    buf = blocks.pop() ?? ''
    for (const b of blocks) {
      const ev = /event: (\w+)/.exec(b)?.[1]
      const data = /data: (.+)/.exec(b)?.[1]
      if (!data) continue
      if (ev === 'delta') onDelta(JSON.parse(data).text)
      else if (ev === 'done') return
      else if (ev === 'error') throw new Error(JSON.parse(data).message)
    }
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
export function fmtBytes(b: number): string {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
  if (b >= 1e6) return (b / 1e6).toFixed(0) + ' MB'
  return (b / 1e3).toFixed(0) + ' KB'
}

export function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function fmtTs(ts: string | number | undefined): string {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' ? ts : ts)
  return d.toLocaleString()
}
