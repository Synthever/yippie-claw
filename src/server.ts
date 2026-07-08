import "dotenv/config";
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

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`🚀 Yippie-Claw backend jalan di http://127.0.0.1:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
