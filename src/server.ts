import "dotenv/config";
import crypto from "node:crypto";
import Fastify from "fastify";
import { GatewayClient } from "./gateway/client";

async function main() {
  // 1) Sambungkan ke OpenClaw Gateway (loopback, pakai token dari .env)
  const gw = new GatewayClient();
  gw.on("ready", () => console.log("✅ Gateway siap (hello-ok)"));
  gw.on("disconnected", () => console.warn("⚠️  Gateway terputus — mencoba reconnect..."));
  gw.on("error", (e: Error) => console.error("Gateway error:", e.message));

  gw.connect();
  await gw.whenReady();
  gw.setMaxListeners(0); // ponytail: banyak chat = banyak listener sesaat; unbounded aman, listener dicabut saat run selesai/disconnect

  // 2) API server buat frontend Yippie-Claw
  const app = Fastify({ logger: true });

  // Status Gateway (plugin, channel, agent aktif, dsb.)
  app.get("/api/health", async () => {
    return gw.call("status");
  });

  // 10 agent kamu, dirapikan buat dropdown/routing di UI
  app.get("/api/models", async () => {
    const models = await gw.listModels();
    return models.map((m) => ({
      id: m.id,
      alias: m.alias ?? m.name ?? m.id,
      available: m.available ?? true,
      contextWindow: m.contextWindow,
    }));
  });

  // Halaman tes chat (langkah 2 M3). ponytail: 1 route inline, ganti Next.js kalau stream udah kebukti.
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(CHAT_TEST_HTML);
  });

  // Chat streaming: kirim tugas ke agent, teruskan jawaban ke browser via SSE.
  // Body: { message, sessionKey? }. sessionKey stabil = konteks percakapan nyambung.
  app.post<{ Body: { message?: string; sessionKey?: string } }>("/api/chat", async (req, reply) => {
    const message = req.body?.message?.trim();
    if (!message) return reply.code(400).send({ error: "message wajib diisi" });
    const sessionKey = req.body.sessionKey || `web-${crypto.randomUUID()}`;

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (event: string, data: unknown) =>
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    let ack: { runId: string };
    try {
      ack = await gw.runAgent(sessionKey, message);
    } catch (err: any) {
      send("error", { message: err?.message ?? "gagal kirim ke agent" });
      return reply.raw.end();
    }

    const onEvent = (payload: any) => {
      if (payload?.runId !== ack.runId) return; // event run lain, abaikan
      if (payload.stream === "assistant" && payload.data?.delta) {
        send("delta", { text: payload.data.delta });
      } else if (payload.stream === "lifecycle" && payload.data?.phase === "end") {
        send("done", { stopReason: payload.data.stopReason, aborted: payload.data.aborted });
        cleanup();
        reply.raw.end();
      }
    };
    const cleanup = () => gw.off("event:agent", onEvent);
    gw.on("event:agent", onEvent);
    reply.raw.on("close", cleanup); // browser tutup tab / batal → cabut listener

    return reply; // Fastify: jangan kirim balasan lagi, kita pegang raw stream
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`🚀 Yippie-Claw backend jalan di http://127.0.0.1:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Halaman tes minimal: kirim pesan, baca SSE via fetch-stream (bukan EventSource — itu GET-only).
const CHAT_TEST_HTML = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Yippie-Claw chat tes</title>
<style>
  body{font:16px system-ui;max-width:640px;margin:2rem auto;padding:0 1rem}
  #log{border:1px solid #ccc;border-radius:8px;padding:1rem;min-height:200px;white-space:pre-wrap}
  .row{display:flex;gap:.5rem;margin-top:1rem}
  input{flex:1;padding:.5rem} button{padding:.5rem 1rem}
</style></head><body>
<h1>Yippie-Claw 🐾 chat tes</h1>
<div id="log"></div>
<div class="row">
  <input id="msg" placeholder="Ketik pesan..." autofocus>
  <button id="send">Kirim</button>
</div>
<script>
const log = document.getElementById("log");
const input = document.getElementById("msg");
const btn = document.getElementById("send");
const sessionKey = "web-" + Math.random().toString(36).slice(2); // konteks tetap se-sesi tab

async function send() {
  const message = input.value.trim();
  if (!message) return;
  input.value = ""; btn.disabled = true;
  log.textContent += "\\n\\n🧑 " + message + "\\n🤖 ";
  const res = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionKey }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const blocks = buf.split("\\n\\n"); buf = blocks.pop(); // sisa belum lengkap
    for (const b of blocks) {
      const ev = /event: (\\w+)/.exec(b)?.[1];
      const data = /data: (.+)/.exec(b)?.[1];
      if (ev === "delta") log.textContent += JSON.parse(data).text;
      else if (ev === "error") log.textContent += "[error] " + data;
    }
  }
  btn.disabled = false; input.focus();
}
btn.onclick = send;
input.onkeydown = (e) => { if (e.key === "Enter") send(); };
</script></body></html>`;
