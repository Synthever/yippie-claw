import "dotenv/config";
import { GatewayClient } from "./src/gateway/client";

// Ngintip bentuk mentah event "agent": fase apa aja, field mana yang teks jawaban.
// Jalankan: npx tsx peek-agent.ts "halo, siapa kamu?"
// ponytail: script eksplorasi sekali pakai, hapus kalau bentuk event udah kecatat.

const message = process.argv.slice(2).join(" ") || "Halo, balas singkat satu kalimat.";

async function main() {
  const gw = new GatewayClient();
  gw.connect();
  await gw.whenReady();
  console.log("✅ Gateway siap\n");

  // Dengarkan SEMUA event mentah — biar kelihatan struktur aslinya apa adanya.
  let count = 0;
  gw.on("event:agent", (payload) => {
    console.log(`── event:agent #${++count} ─────────────`);
    console.dir(payload, { depth: null });
  });

  // Tanpa override model — caller loopback ga diizinin (INVALID_REQUEST), Gateway pakai default.
  const sessionKey = `peek-${Date.now()}`;
  const ack = await gw.runAgent(sessionKey, message);
  console.log("📨 ack runAgent:");
  console.dir(ack, { depth: null });
  console.log(`\n⏳ Nunggu stream event (runId=${ack.runId})... auto-exit 30 detik.\n`);

  // Kasih waktu stream masuk, lalu keluar.
  setTimeout(() => {
    console.log(`\n✅ Selesai. Total ${count} event:agent diterima.`);
    process.exit(0);
  }, 30_000);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
