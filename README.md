# Yippie-Claw 🐾

Web app untuk mengelola instalasi **OpenClaw**: dashboard, kelola agent, chat room dengan agent, dan penugasan tugas ke agent tertentu (dengan visual "kamar" agent yang lagi kerja).

## Konsep arsitektur

Yippie-Claw **tidak menjalankan** OpenClaw di dalamnya — dia jadi UI di atas **OpenClaw Gateway** yang sudah berjalan.

```
Browser (frontend)  ──►  Backend Yippie-Claw  ──►  OpenClaw Gateway
   Next.js/React          Fastify + WS client       ws://127.0.0.1:18789
                          (di VPS yang sama)          (loopback, aman)
```

Gateway di VPS default-nya loopback-only. Backend Yippie-Claw jalan di VPS yang sama, konek ke Gateway lewat localhost, dan pegang token (tidak pernah bocor ke browser). Frontend cukup ngobrol dengan backend.

### Detail koneksi Gateway (sudah terverifikasi)

- Transport: WebSocket, frame JSON `{ type: "req" | "res" | "event" }`, protokol **v4**.
- Auth: jalur **backend loopback** — `client.id: "gateway-client"`, `mode: "backend"`, `role: "operator"`, pakai shared token. Device boleh diomit di loopback.
- Handshake sukses ditandai `res` dengan `payload.type === "hello-ok"`.
- `models.list` → daftar model/agent. `agent` → kirim tugas (asinkron: balik `{ runId, status: "accepted" }`, hasilnya streaming lewat event `agent`).

## Setup

```bash
npm install
cp .env.example .env      # lalu isi OPENCLAW_GATEWAY_TOKEN
npm run dev
```

Token diambil dari Gateway (config `gateway.auth.token` / env `OPENCLAW_GATEWAY_TOKEN` di sisi Gateway).

## Endpoint (backend)

| Method | Path           | Fungsi                                   |
|--------|----------------|------------------------------------------|
| GET    | `/api/health`  | Status Gateway (plugin, channel, agent)  |
| GET    | `/api/models`  | Daftar 10 agent (id, alias, contextWindow) |

Tes cepat:

```bash
curl http://127.0.0.1:3001/api/models
curl http://127.0.0.1:3001/api/health
```

## Deploy di VPS OpenClaw

```bash
git clone <repo-url> ~/yippie-claw
cd ~/yippie-claw
npm install
cp .env.example .env       # isi token (file ini TIDAK ikut ke git)
npm run start
# Untuk update ke depannya: git pull && npm install && restart
```

> Nanti untuk produksi, jalankan lewat pm2 atau systemd biar 24/7.

## Roadmap

- [x] **M1** — Buktikan koneksi ke Gateway (handshake, `models.list`, kirim tugas ke agent)
- [x] **M2** — Bungkus jadi backend service: `GatewayClient` reusable + endpoint `/api/models` & `/api/health`
- [ ] **M3** — Frontend Next.js + chat room streaming pertama (pakai event `agent`)
- [ ] **M4** — Kelola & bikin agent (`agents.*`), routing model per-tugas (Fable 5 seperlunya)
- [ ] **M5** — Dashboard + visual "kamar" agent mengerjakan task A/B/C (pakai `tasks.*` / `cron.*`)

## Struktur

```
src/
├── server.ts            # Fastify server + endpoint
└── gateway/
    └── client.ts        # GatewayClient: koneksi persistent, call() await, event streaming
```
