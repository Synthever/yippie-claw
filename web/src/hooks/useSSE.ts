import { useEffect, useRef, useState } from 'react'

export interface SSEOptions {
  onMessage?: (event: MessageEvent) => void
  onEvent?: (type: string, data: string) => void
  enabled?: boolean
}

/** Auto-reconnecting EventSource hook. Returns { connected, error }. */
export function useSSE(url: string, opts: SSEOptions = {}) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (opts.enabled === false) return
    let es: EventSource
    let dead = false

    function connect() {
      if (dead) return
      es = new EventSource(url)
      es.onopen = () => { setConnected(true); setError(null) }
      es.onerror = () => {
        setConnected(false)
        setError('disconnected')
        es.close()
        if (!dead) setTimeout(connect, 3000)
      }
      es.onmessage = (ev) => optsRef.current.onMessage?.(ev)

      // Intercept named events by wrapping addEventListener
      const origAdd = es.addEventListener.bind(es)
      // Forward any named event we receive
      ;['tail', 'log', 'error', 'delta', 'done'].forEach((name) => {
        origAdd(name, (ev: Event) => {
          optsRef.current.onEvent?.(name, (ev as MessageEvent).data)
        })
      })
    }
    connect()
    return () => {
      dead = true
      es?.close()
      setConnected(false)
    }
  }, [url, opts.enabled])

  return { connected, error }
}
