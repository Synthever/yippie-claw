import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import { GatewayClient } from "./gateway/client.js";
import { startSystemPoller, getSystemSnapshot } from "./system.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname is src/ at runtime; web/dist is one level up then into web/dist
const WEB_DIST = path.resolve(__dirname, "../web/dist");

async function main() {
  // Gateway connection
  const gw = new GatewayClient();
  gw.on("ready", () => console.log("✅ Gateway ready"));
  gw.on("disconnected", () => console.warn("⚠️  Gateway disconnected — reconnecting..."));
  gw.on("error", (e: Error) => console.error("Gateway error:", e.message));
  gw.connect();
  await gw.whenReady();
  gw.setMaxListeners(0);

  // System poller (CPU/mem/disk every 2s)
  startSystemPoller(2000);

  const app = Fastify({ logger: true });

  // --- Static frontend ---
  await app.register(staticPlugin, {
    root: WEB_DIST,
    prefix: "/",
    decorateReply: false,
  });

  // SPA fallback for unknown non-API routes
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "not found" });
    }
    return reply.sendFile("index.html");
  });

  // ── API routes ─────────────────────────────────────────────────────────────

  // Health / status
  app.get("/api/health", async () => gw.call("status"));
  app.get("/api/status", async () => gw.call("status"));

  // Channels
  app.get("/api/channels", async () => gw.call("channels.status"));

  // Usage
  app.get("/api/usage", async () => {
    const [status, cost] = await Promise.all([
      gw.call("usage.status"),
      gw.call("usage.cost").catch(() => null),
    ]);
    return { status, cost };
  });

  // Models
  app.get("/api/models", async () => {
    const models = await gw.listModels();
    return models.map((m) => ({
      id: m.id,
      alias: m.alias ?? m.name ?? m.id,
      available: m.available ?? true,
      contextWindow: m.contextWindow,
    }));
  });
  app.get("/api/models/auth", async () => gw.call("models.authStatus"));

  // Agents
  app.get("/api/agents", async () => gw.call("agents.list"));
  app.post<{ Body: Record<string, any> }>("/api/agents", async (req) =>
    gw.call("agents.create", req.body ?? {})
  );
  app.put<{ Params: { id: string }; Body: Record<string, any> }>(
    "/api/agents/:id",
    async (req) => gw.call("agents.update", { agentId: req.params.id, ...req.body })
  );
  app.delete<{ Params: { id: string } }>("/api/agents/:id", async (req) =>
    gw.call("agents.delete", { agentId: req.params.id })
  );

  // Agent files
  app.get<{ Params: { id: string } }>("/api/agents/:id/files", async (req) =>
    gw.call("agents.files.list", { agentId: req.params.id })
  );
  app.get<{ Params: { id: string; "*": string } }>("/api/agents/:id/files/*", async (req) =>
    gw.call("agents.files.get", { agentId: req.params.id, path: req.params["*"] })
  );
  app.put<{ Params: { id: string; "*": string }; Body: { content: string } }>(
    "/api/agents/:id/files/*",
    async (req) =>
      gw.call("agents.files.set", {
        agentId: req.params.id,
        path: req.params["*"],
        content: req.body?.content ?? "",
      })
  );

  // Sessions
  app.get("/api/sessions", async () => gw.call("sessions.list"));
  app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (req) =>
    gw.call("sessions.delete", { sessionId: req.params.id })
  );

  // Cron
  app.get("/api/cron", async () => gw.call("cron.list"));
  app.post<{ Body: Record<string, any> }>("/api/cron", async (req) =>
    gw.call("cron.add", req.body ?? {})
  );
  app.put<{ Params: { id: string }; Body: Record<string, any> }>("/api/cron/:id", async (req) =>
    gw.call("cron.update", { id: req.params.id, ...req.body })
  );
  app.delete<{ Params: { id: string } }>("/api/cron/:id", async (req) =>
    gw.call("cron.remove", { id: req.params.id })
  );
  app.post<{ Params: { id: string } }>("/api/cron/:id/run", async (req) =>
    gw.call("cron.run", { id: req.params.id })
  );
  app.get<{ Params: { id: string } }>("/api/cron/:id/runs", async (req) =>
    gw.call("cron.runs", { id: req.params.id })
  );

  // Tools
  app.get("/api/tools", async () => gw.call("tools.catalog"));

  // Logs (one-shot tail)
  app.get<{ Querystring: { lines?: string } }>("/api/logs", async (req) =>
    gw.call("logs.tail", { limit: Number(req.query.lines ?? 200) })
  );

  // System snapshot
  app.get("/api/system", async () => getSystemSnapshot());

  // System SSE stream (push every 2s)
  app.get("/api/system/stream", async (_req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = () => {
      const snap = getSystemSnapshot();
      reply.raw.write(`data: ${JSON.stringify(snap)}\n\n`);
    };
    send();
    const timer = setInterval(send, 2000);
    reply.raw.on("close", () => clearInterval(timer));
    return reply;
  });

  // Logs SSE stream
  app.get<{ Querystring: { lines?: string } }>("/api/logs/stream", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (event: string, data: unknown) =>
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    // Initial tail
    try {
      const tail = await gw.call("logs.tail", { limit: Number(req.query.lines ?? 100) });
      send("tail", tail);
    } catch (e: any) {
      send("error", { message: e?.message });
    }

    // Forward live log events
    const onLog = (payload: any) => send("log", payload);
    gw.on("event:log", onLog);
    reply.raw.on("close", () => gw.off("event:log", onLog));
    return reply;
  });

  // Chat (existing, preserved)
  app.post<{ Body: { message?: string; sessionKey?: string } }>("/api/chat", async (req, reply) => {
    const message = req.body?.message?.trim();
    if (!message) return reply.code(400).send({ error: "message required" });
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
      send("error", { message: err?.message ?? "failed to send to agent" });
      return reply.raw.end();
    }

    const onEvent = (payload: any) => {
      if (payload?.runId !== ack.runId) return;
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
    reply.raw.on("close", cleanup);
    return reply;
  });

  const port = Number(process.env.PORT ?? 9898);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen({ port, host });
  console.log(`🚀 Yippie-Claw backend running at http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
