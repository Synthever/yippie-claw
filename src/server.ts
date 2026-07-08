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
