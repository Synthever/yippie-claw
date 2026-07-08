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
- **Override model TIDAK diizinkan** untuk caller loopback (`INVALID_REQUEST` "provider/model overrides are not authorized"). Jangan kirim param `model` — Gateway pakai default agent.

#### Bentuk event `agent` (hasil ngintip, terverifikasi)

Tiap tugas nyembur beberapa event `agent` dengan field kunci: `runId`, `stream`, `data`, `seq` (urutan), `ts`. Filter berdasarkan `runId` (bisa ada run paralel).

| `stream` | `data` | Artinya |
|----------|--------|---------|
| `lifecycle` | `{ phase: "start" }` | Mulai |
| `assistant` | `{ text, delta }` | **Teks jawaban** — `delta` = potongan baru, `text` = akumulasi |
| `lifecycle` | `{ phase: "finishing", stopReason }` | Hampir kelar |
| `lifecycle` | `{ phase: "end", stopReason, aborted }` | **Selesai** → tutup stream |

Streaming = append tiap `data.delta` sampai lifecycle `phase: "end"`.

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
| GET    | `/`            | Halaman tes chat (SSE via fetch-stream)  |
| GET    | `/api/health`  | Status Gateway (plugin, channel, agent)  |
| GET    | `/api/models`  | Daftar 10 agent (id, alias, contextWindow) |
| POST   | `/api/chat`    | Kirim `{ message, sessionKey? }` → stream SSE (`event: delta` / `done`) |

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
- [x] **M3a** — Chat streaming end-to-end: `POST /api/chat` (SSE) + halaman tes `/` ✅
- [x] **M3b** — Frontend Vite + React (`web/`): chat room streaming ✅
- [ ] **M4** — Kelola & bikin agent (`agents.*`), routing model per-tugas (Fable 5 seperlunya)
- [ ] **M5** — Dashboard + visual "kamar" agent mengerjakan task A/B/C (pakai `tasks.*` / `cron.*`)

## Frontend (`web/`)

Vite + React SPA. Dev server sendiri, proxy `/api` → backend `:3001`.

```bash
# terminal 1 — backend
npm run dev
# terminal 2 — frontend
cd web && npm install && npm run dev   # buka http://localhost:5173
```

Streaming dibaca via `fetch`-stream (bukan `EventSource`, karena `/api/chat` itu POST). Lihat [web/src/api.ts](web/src/api.ts).

## Struktur

```
src/                     # backend
├── server.ts            # Fastify server + endpoint (/api/chat SSE, /api/models, /api/health)
└── gateway/
    └── client.ts        # GatewayClient: koneksi persistent, call() await, event streaming
web/                     # frontend (Vite + React)
├── vite.config.ts       # proxy /api → :3001
└── src/
    ├── App.tsx          # chat room
    └── api.ts           # streamChat(): fetch-stream SSE reader
```
