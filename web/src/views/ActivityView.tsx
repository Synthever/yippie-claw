import { useEffect, useRef, useState } from 'react'
import { api, type Session, streamChat } from '../api'
import { asList, pick } from '../lib/data'

interface Msg { role: 'user' | 'assistant'; text: string }

export default function ActivityView() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.sessionsList().then((data) => {
      const arr = asList(data).map((s: any, i: number) => ({
        ...s,
        id: String(pick(s, 'id', 'sessionKey', 'key', 'sessionId', '__key') ?? `session-${i}`),
      }))
      setSessions(arr as Session[])
    }).catch(() => null)
  }, [])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    const msg = input.trim()
    if (!msg || busy) return
    setInput('')
    setBusy(true)
    const key = activeId ?? `web-${Math.random().toString(36).slice(2)}`
    setMessages((m) => [...m, { role: 'user', text: msg }, { role: 'assistant', text: '' }])
    try {
      await streamChat(msg, key, (delta) => {
        setMessages((m) => {
          const next = [...m]
          next[next.length - 1] = { role: 'assistant', text: next[next.length - 1].text + delta }
          return next
        })
      })
    } catch (err: any) {
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', text: '⚠️ ' + err.message }
        return next
      })
    }
    setBusy(false)
  }

  function togglePin(id: string) {
    setPinned((p) => {
      const next = new Set(p)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sortedSessions = [...sessions].sort((a, b) => {
    const ap = pinned.has(a.id) ? 0 : 1
    const bp = pinned.has(b.id) ? 0 : 1
    return ap - bp
  }).filter((s) =>
    !search || [s.id, s.channel, s.agentId, s.preview].some((f) =>
      String(f ?? '').toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Live Activity</div>
          <div className="page-subtitle">Chat with agents, browse active sessions</div>
        </div>
      </div>

      <div className="activity-layout">
        {/* Session sidebar */}
        <div className="session-sidebar">
          <div style={{ padding: '10px 10px 6px' }}>
            <input
              className="search-bar"
              style={{ width: '100%', fontSize: 12 }}
              placeholder="Search sessions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* New chat button */}
          <div style={{ padding: '4px 10px 8px' }}>
            <button
              className="btn sm primary"
              style={{ width: '100%' }}
              onClick={() => {
                setActiveId(null)
                setMessages([])
              }}
            >
              + New Chat
            </button>
          </div>

          {sortedSessions.length === 0 ? (
            <div className="text-muted text-sm" style={{ padding: '16px 14px' }}>No sessions</div>
          ) : (
            sortedSessions.map((s) => (
              <div
                key={s.id}
                className={`session-item${activeId === s.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveId(s.id)
                  setMessages([]) // could load history here
                }}
              >
                <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                  <div className="session-id">{s.id.slice(0, 14)}…</div>
                  <button
                    className="btn icon sm"
                    style={{ fontSize: 12, padding: '2px 4px', opacity: pinned.has(s.id) ? 1 : 0.35 }}
                    onClick={(e) => { e.stopPropagation(); togglePin(s.id) }}
                    title="Pin session"
                  >📌</button>
                </div>
                <div className="session-preview">{s.preview ?? s.channel ?? '—'}</div>
                <div className="session-meta">
                  {s.agentId ?? 'unknown'} · {s.messageCount ?? 0} msgs
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat panel */}
        <div className="chat-area">
          <div className="chat-wrap">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <div>
                    {activeId
                      ? `Session: ${activeId}`
                      : 'Start a new conversation or select a session'}
                  </div>
                  <div className="text-muted text-sm mt-8">
                    Type a message below to chat with the main agent
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.role}`}>
                    <div className="chat-avatar">
                      {m.role === 'user' ? '🧑' : '🤖'}
                    </div>
                    <div className="chat-bubble">
                      {m.text || (busy && i === messages.length - 1 ? '…' : '')}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={busy ? 'Waiting for response…' : 'Send a message…'}
                disabled={busy}
              />
              <button className="btn primary" onClick={send} disabled={busy || !input.trim()}>
                {busy ? <span className="spinner" /> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
