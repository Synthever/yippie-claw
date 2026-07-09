# Yippie-Claw Dashboard — Expansion Plan

## Codebase Analysis

### Current State (M3b complete)

**Backend** (`src/server.ts` + `src/gateway/client.ts`):
- Fastify server on port 3001 (loopback only)
- `GatewayClient` — persistent WebSocket to OpenClaw Gateway (ws://127.0.0.1:18789)
- Protocol v4: `{ type: "req"|"res"|"event" }` frames, RPC via `call(method, params)`
- Auth: loopback backend mode, operator role, shared token
- Live endpoints: `GET /api/health`, `GET /api/models`, `POST /api/chat` (SSE)
- Auto-reconnect with 3s delay
- Known constraint: **model overrides not allowed** on loopback caller

**Frontend** (`web/` — Vite + React 19 SPA):
- Single page: streaming chat room
- SSE via fetch-stream (not EventSource, because POST)
- Dark/light via CSS vars, accent `#aa3bff`
- Dev: Vite proxy `/api` → `:3001`
- Build: static bundle → served by backend

### Gateway RPC Methods Available (confirmed from source)

Key methods for dashboard features:

| Category | Methods |
|---|---|
| Status | `status`, `health`, `diagnostics.stability` |
| Logs | `logs.tail` |
| Models | `models.list`, `models.authStatus`, `models.authLogout` |
| Agents | `agents.list`, `agents.create`, `agents.update`, `agents.delete` |
| Agent files | `agents.files.list`, `agents.files.get`, `agents.files.set` |
| Sessions | `sessions.list`, `sessions.get`, `sessions.messages.subscribe`, `sessions.delete`, `sessions.preview`, `sessions.describe`, `sessions.usage` |
| Tasks / Cron | `cron.list`, `cron.get`, `cron.status`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs` |
| Tools | `tools.catalog`, `tools.effective`, `tools.invoke` |
| Skills | `skills.status`, `skills.search`, `skills.detail`, `skills.skillCard` |
| Usage | `usage.status`, `usage.cost` |
| Config | `config.get`, `config.schema.lookup` |
| Channels | `channels.status`, `channels.start`, `channels.stop` |
| Commands | `commands.list` |
| Artifacts | `artifacts.list`, `artifacts.get`, `artifacts.download` |

System stats (CPU/mem/disk) come from OS directly — NOT from Gateway. Backend reads `/proc/loadavg`, `si.dynamicData()` from `systeminformation` npm package or raw `/proc` files.

---

## Target Architecture (Port 9898)

```
Browser (React SPA)
  └─► GET /  → serves built frontend (or Vite proxy in dev)
  └─► /api/* → Fastify backend
  └─► /api/ws-relay → WebSocket relay (for live log tails, event streams)

Fastify backend (0.0.0.0:9898)
  └─► GatewayClient (ws://127.0.0.1:18789, persistent)
  └─► OS metrics reader (setInterval, cached)
  └─► Static file server (web/dist/ in prod)
```

In production: Fastify serves both the API and the compiled frontend from `web/dist/`. No separate Vite server needed.

---

## Feature Sections → API Mapping

### 1. Dashboard Overview
- System stats: CPU, memory, disk — read from `/proc` or `os` module
- Gateway health: `gw.call("status")` + `gw.call("health")`
- Active sessions count: `gw.call("sessions.list")`
- Usage summary: `gw.call("usage.status")` + `gw.call("usage.cost")`
- Channels status: `gw.call("channels.status")`

### 2. Agents
- List: `gw.call("agents.list")`
- Create/update/delete: `agents.create`, `agents.update`, `agents.delete`
- Agent files: `agents.files.list`, `agents.files.get`, `agents.files.set`
- "Room" view: sessions per agent via `sessions.list` + filter by agentId

### 3. Tasks / Cron
- List cron jobs: `gw.call("cron.list")`
- Status: `gw.call("cron.status")`
- Run history: `gw.call("cron.runs")`
- Add/update/remove/run: `cron.add`, `cron.update`, `cron.remove`, `cron.run`

### 4. System Stats
- Real-time CPU/mem/disk: backend polling `/proc/stat`, `/proc/meminfo`, `df`
- SSE endpoint `/api/system/stream` pushing updates every 2s
- Historical: in-memory ring buffer (last 60 data points)

### 5. Logs
- Live tail: `gw.call("logs.tail", { lines: 100 })` + SSE relay
- Filter by level/agent
- `logs.tail` returns recent log entries; backend subscribes to `event:log` if available

### 6. Files (Agent Workspace Files)
- Browse: `agents.files.list` per agent
- Read: `agents.files.get`
- Write: `agents.files.set`
- UI: file tree + editor panel

### 7. Models
- List: `gw.call("models.list")`
- Auth status: `gw.call("models.authStatus")`
- Logout: `models.authLogout`

### 8. Tools
- Catalog: `gw.call("tools.catalog")`
- Effective (per session): `gw.call("tools.effective")`
- Invoke: `gw.call("tools.invoke", { ... })`

### 9. Sessions (Bonus)
- List: `gw.call("sessions.list")`
- Preview / describe: `sessions.preview`, `sessions.describe`
- Usage: `sessions.usage`
- Delete: `sessions.delete`

---

## Implementation Plan

### Phase 1 — Infrastructure (Port + Serve Frontend)
**Goal:** Run on 9898, serve bundled frontend from backend, split routes cleanly.

Steps:
1. Change default `PORT` to `9898`, bind to `0.0.0.0` (not loopback)
2. Add `@fastify/static` to serve `web/dist/` at root
3. Add wildcard `GET /*` → serve `index.html` (SPA fallback)
4. `vite.config.ts`: update proxy target to `:9898`
5. Add `npm run build` script that builds `web/` then starts backend
6. Update `.env.example`: `PORT=9898`

### Phase 2 — Backend API Routes (Gateway Proxy Layer)
**Goal:** Thin proxy endpoints — each calls `gw.call(method, params)` and returns result.

New endpoints (all under `/api`):

```
GET  /api/status          → gw.call("status")
GET  /api/channels        → gw.call("channels.status")
GET  /api/usage           → gw.call("usage.status")

GET  /api/agents          → gw.call("agents.list")
POST /api/agents          → gw.call("agents.create", body)
PUT  /api/agents/:id      → gw.call("agents.update", {agentId, ...body})
DEL  /api/agents/:id      → gw.call("agents.delete", {agentId})
GET  /api/agents/:id/files       → gw.call("agents.files.list", {agentId})
GET  /api/agents/:id/files/:path → gw.call("agents.files.get", {agentId, path})
PUT  /api/agents/:id/files/:path → gw.call("agents.files.set", {agentId, path, content})

GET  /api/sessions        → gw.call("sessions.list")
DEL  /api/sessions/:id    → gw.call("sessions.delete", {sessionId})

GET  /api/cron            → gw.call("cron.list")
POST /api/cron            → gw.call("cron.add", body)
PUT  /api/cron/:id        → gw.call("cron.update", body)
DEL  /api/cron/:id        → gw.call("cron.remove", {id})
POST /api/cron/:id/run    → gw.call("cron.run", {id})
GET  /api/cron/:id/runs   → gw.call("cron.runs", {id})

GET  /api/tools           → gw.call("tools.catalog")
GET  /api/models          → already exists, keep
GET  /api/models/auth     → gw.call("models.authStatus")

GET  /api/logs            → gw.call("logs.tail", {lines: 200})
GET  /api/logs/stream     → SSE: tail + subscribe to gateway log events

GET  /api/system          → one-shot snapshot {cpu, mem, disk, uptime}
GET  /api/system/stream   → SSE: push every 2s
```

### Phase 3 — System Stats Module
**Goal:** Real-time OS metrics without extra npm deps (lazy: use Node `os` + `/proc`).

`src/system.ts`:
- `getCpuPercent()` — diff `/proc/stat` over 500ms interval
- `getMemInfo()` — parse `/proc/meminfo` 
- `getDiskInfo()` — `child_process.execFile("df", ["-k", "/"])` parse output
- Export `getSystemSnapshot()` → `{ cpu, memTotal, memUsed, diskTotal, diskUsed, uptime }`
- Cache snapshot, refresh every 2s internally
- SSE pushes cached value to all connected clients

### Phase 4 — Frontend Multi-Section SPA
**Goal:** React app with sidebar nav, multiple views.

Structure:
```
web/src/
  App.tsx          — layout: sidebar + outlet
  components/
    Sidebar.tsx    — nav links (icons + labels)
    StatCard.tsx   — reusable metric card
    Table.tsx      — reusable sortable table
  views/
    DashboardView.tsx   — system stats + gateway status cards
    AgentsView.tsx      — agent list + create/edit modal
    TasksView.tsx       — cron job table + add/edit panel  
    LogsView.tsx        — scrolling log tail (SSE)
    FilesView.tsx       — file tree + editor (textarea)
    ModelsView.tsx      — model list + auth status
    ToolsView.tsx       — tools catalog display
    SessionsView.tsx    — session list + usage
  api.ts           — typed fetch wrappers for all /api endpoints
  hooks/
    useSSE.ts      — generic SSE hook (auto-reconnect)
    useSystem.ts   — subscribe to /api/system/stream
    useLogs.ts     — subscribe to /api/logs/stream
```

Design system (extend existing CSS vars):
- Add vars: `--sidebar-bg`, `--card-bg`, `--success`, `--warning`, `--danger`
- Sidebar: fixed left 220px, icon + label, active highlight with `--accent`
- Cards: border-radius 12px, subtle shadow, stat + label layout
- Tables: hover rows, sortable headers
- No external UI library — pure CSS + React (lazy, minimal deps)

### Phase 5 — Live Features (SSE + Events)
**Goal:** Real-time log tail, system stats stream.

- `useSSE(url)` hook: opens `EventSource`, reconnects on error, returns `{ lines, error }`
- Log view auto-scrolls to bottom, max 500 lines (ring buffer in component state)
- System stream: charts via simple SVG sparklines (no chart lib needed for MVP)
- Agent task streaming: existing `/api/chat` SSE stays, add "run agent" button in AgentsView

### Phase 6 — Polish & Production Mode
1. `vite build` output to `web/dist/`
2. Fastify `@fastify/static` serves `web/dist/`
3. Single `npm start` command boots everything
4. Env: `PORT=9898`, `HOST=0.0.0.0`
5. `README.md` update: new feature list, new port, nginx reverse proxy snippet

---

## Dependency Additions Required

**Backend (minimal):**
```
@fastify/static   — serve web/dist/
```
That's it. System stats via Node `os` + `child_process` + `/proc` parsing (no systeminformation needed).

**Frontend (none new):**
React 19 already in. No router needed for MVP — use `useState` for active view (no URL-based routing needed in a self-hosted single-user dashboard).

If file editor grows complex: consider `@codemirror/basic-setup` later. Skip for now.

---

## File Change Summary

| File | Change |
|---|---|
| `src/server.ts` | Add all new routes, static serve, port 9898, host 0.0.0.0 |
| `src/system.ts` | New — OS metrics collector |
| `src/gateway/client.ts` | No change needed (already generic) |
| `web/vite.config.ts` | Proxy target → 9898 |
| `web/src/App.tsx` | Full rewrite — layout shell with sidebar |
| `web/src/api.ts` | Extend with all new endpoint wrappers |
| `web/src/index.css` | Add new CSS vars for sidebar/cards |
| `web/src/views/*.tsx` | New — all section views |
| `web/src/components/*.tsx` | New — Sidebar, StatCard, Table |
| `web/src/hooks/*.ts` | New — useSSE, useSystem, useLogs |
| `package.json` | Add `@fastify/static`, build script |
| `.env` / `.env.example` | PORT=9898 |
| `README.md` | Update with new features + port |

---

## Open Questions / Decisions Needed Before Coding

1. **Auth on dashboard port?** Currently backend is loopback-only (3001). Moving to 9898 on 0.0.0.0 exposes it publicly. Need: basic auth header check, or confirm user will put it behind nginx with auth.

2. **File editor scope?** Agent workspace files via `agents.files.*` — read-only first, or full write from day 1?

3. **Chat view retain?** Keep the existing chat room as a section in the new dashboard, or replace with agent-specific chat in AgentsView?

4. **Charting?** SVG sparklines (no deps) or a small chart lib like `recharts`? Recharts is ~150KB but much nicer. User preference?

5. **Sessions view?** `sessions.list` may return many items. Pagination? Or just last 50?
