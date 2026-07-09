import { useEffect, useRef, useState } from 'react'

export interface LogEntry {
  ts?: string
  level?: string
  msg?: string
  message?: string
  [k: string]: unknown
}

const MAX_LINES = 500

/** Subscribe to /api/logs/stream SSE. Returns live log entries. */
export function useLogs(enabled = true) {
  const [lines, setLines] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const deadRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    deadRef.current = false

    function addLines(entries: LogEntry[]) {
      setLines((prev) => {
        const next = [...prev, ...entries]
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      })
    }

    function connect() {
      if (deadRef.current) return
      const es = new EventSource('/api/logs/stream?lines=100')
      setConnected(true)

      es.addEventListener('tail', (ev: Event) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data)
          const arr: LogEntry[] = Array.isArray(data) ? data : (data?.logs ?? data?.lines ?? [])
          addLines(arr)
        } catch {}
      })

      es.addEventListener('log', (ev: Event) => {
        try {
          const entry = JSON.parse((ev as MessageEvent).data)
          addLines([entry])
        } catch {}
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        if (!deadRef.current) setTimeout(connect, 4000)
      }
      return es
    }

    const es = connect()
    return () => {
      deadRef.current = true
      es?.close()
      setConnected(false)
    }
  }, [enabled])

  function clear() { setLines([]) }

  return { lines, connected, clear }
}
