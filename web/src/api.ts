// Kirim pesan ke /api/chat, baca SSE via fetch-stream (EventSource GET-only, endpoint kita POST).
// onDelta dipanggil tiap potongan teks datang. Promise selesai saat event "done".
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
  if (!res.ok || !res.body) throw new Error(`chat gagal: ${res.status}`)

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const blocks = buf.split('\n\n')
    buf = blocks.pop() ?? '' // sisa yang belum lengkap, tunggu chunk berikutnya
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
