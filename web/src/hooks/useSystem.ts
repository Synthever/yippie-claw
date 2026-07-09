import { useEffect, useRef, useState } from 'react'

export interface SystemSnapshot {
  cpu: number         // 0–100
  memTotal: number    // bytes
  memUsed: number
  diskTotal: number
  diskUsed: number
  uptime: number      // seconds
  loadAvg?: number[]
}

const HISTORY = 60

/** Returns live system metrics + sparkline history via SSE. */
export function useSystem() {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null)
  const [history, setHistory] = useState<SystemSnapshot[]>([])
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const deadRef = useRef(false)

  useEffect(() => {
    deadRef.current = false

    function connect() {
      if (deadRef.current) return
      const es = new EventSource('/api/system/stream')
      esRef.current = es

      es.onopen = () => setConnected(true)
      es.onerror = () => {
        setConnected(false)
        es.close()
        if (!deadRef.current) setTimeout(connect, 4000)
      }
      es.onmessage = (ev) => {
        try {
          const data: SystemSnapshot = JSON.parse(ev.data)
          setSnap(data)
          setHistory((h) => [...h.slice(-(HISTORY - 1)), data])
        } catch {}
      }
    }
    connect()
    return () => {
      deadRef.current = true
      esRef.current?.close()
      setConnected(false)
    }
  }, [])

  return { snap, history, connected }
}
