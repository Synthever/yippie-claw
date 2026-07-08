import { useRef, useState } from 'react'
import { streamChat } from './api'
import './App.css'

type Msg = { role: 'user' | 'assistant'; text: string }

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionKey = useRef('web-' + Math.random().toString(36).slice(2)) // konteks tetap se-sesi tab

  async function send() {
    const message = input.trim()
    if (!message || busy) return
    setInput('')
    setBusy(true)
    // Tambah pesan user + slot assistant kosong yang bakal diisi streaming.
    setMessages((m) => [...m, { role: 'user', text: message }, { role: 'assistant', text: '' }])
    try {
      await streamChat(message, sessionKey.current, (delta) => {
        setMessages((m) => {
          const next = [...m]
          next[next.length - 1] = { role: 'assistant', text: next[next.length - 1].text + delta }
          return next
        })
      })
    } catch (err) {
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', text: '⚠️ ' + (err as Error).message }
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat">
      <h1>Yippie-Claw 🐾</h1>
      <div className="log">
        {messages.length === 0 && <p className="hint">Mulai ngobrol dengan agent...</p>}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="who">{m.role === 'user' ? '🧑' : '🤖'}</span>
            <span className="text">{m.text || (busy && i === messages.length - 1 ? '…' : '')}</span>
          </div>
        ))}
      </div>
      <div className="row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ketik pesan..."
          autoFocus
        />
        <button onClick={send} disabled={busy}>
          {busy ? '...' : 'Kirim'}
        </button>
      </div>
    </div>
  )
}
