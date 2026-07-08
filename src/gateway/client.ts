import "dotenv/config";
import WebSocket from "ws";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";

export interface ModelInfo {
  id: string;
  alias?: string;
  name?: string;
  available?: boolean;
  contextWindow?: number;
}

type Pending = { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout };

/**
 * GatewayClient — koneksi persistent ke OpenClaw Gateway.
 * - Handshake otomatis (jalur loopback backend + shared token)
 * - call(method, params) yang bisa di-await (cocokin res berdasarkan id)
 * - Event streaming di-relay: dengarkan "event" (semua) atau "event:<nama>" (mis. "event:agent")
 * - Auto-reconnect kalau koneksi putus
 */
export class GatewayClient extends EventEmitter {
  private url: string;
  private token: string;
  private ws?: WebSocket;
  private reqId = 0;
  private pending = new Map<string, Pending>();
  private ready = false;
  private reconnectDelay = 3000;

  constructor(opts: { url?: string; token?: string } = {}) {
    super();
    this.url = opts.url ?? process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
    this.token = opts.token ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
  }

  get isReady() {
    return this.ready;
  }

  connect(): this {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on("open", () => this.sendConnect());
    ws.on("message", (raw) => {
      let frame: any;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        return;
      }
      this.handleFrame(frame);
    });
    ws.on("close", () => {
      this.ready = false;
      this.emit("disconnected");
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error("koneksi Gateway tertutup"));
      }
      this.pending.clear();
      setTimeout(() => this.connect(), this.reconnectDelay);
    });
    ws.on("error", (err) => this.emit("error", err));
    return this;
  }

  /** Selesai ketika handshake sukses (hello-ok). */
  whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve) => this.once("ready", () => resolve()));
  }

  private sendConnect() {
    this.rawSend({
      type: "req",
      id: this.nextId(),
      method: "connect",
      params: {
        minProtocol: 4,
        maxProtocol: 4,
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        client: { id: "gateway-client", version: "0.1.0", platform: "node", mode: "backend" },
        auth: this.token ? { token: this.token } : undefined,
      },
    });
  }

  private handleFrame(frame: any) {
    if (frame.type === "res") {
      // Respons handshake
      if (frame.ok && frame.payload?.type === "hello-ok") {
        this.ready = true;
        this.emit("ready", frame.payload);
      }
      // Cocokkan res ke pemanggil call()
      const p = this.pending.get(frame.id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(frame.id);
        if (frame.ok) p.resolve(frame.payload);
        else p.reject(Object.assign(new Error(frame.error?.message ?? "gateway error"), { code: frame.error?.code, details: frame.error?.details }));
      }
      return;
    }

    if (frame.type === "event") {
      if (frame.event === "connect.challenge" || frame.event === "tick") return; // abaikan
      this.emit("event", frame); // semua event mentah
      this.emit(`event:${frame.event}`, frame.payload); // event bernama, mis. "event:agent"
    }
  }

  /** Panggil method RPC lalu tunggu responsnya. */
  call<T = any>(method: string, params: Record<string, any> = {}, timeoutMs = 15000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Gateway belum tersambung"));
    }
    const id = this.nextId();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.rawSend({ type: "req", id, method, params });
    });
  }

  /**
   * Kirim tugas ke agent. Balikannya { runId, status:"accepted" },
   * lalu hasilnya streaming lewat event "event:agent" (fase start -> teks -> selesai).
   */
  runAgent(sessionKey: string, message: string, extra: Record<string, any> = {}) {
    return this.call<{ runId: string; sessionKey: string; status: string }>("agent", {
      message,
      sessionKey,
      idempotencyKey: crypto.randomUUID(),
      ...extra,
    });
  }

  /** Daftar model/agent yang tersedia di Gateway. */
  async listModels(): Promise<ModelInfo[]> {
    const res = await this.call<{ models: ModelInfo[] }>("models.list");
    return res.models ?? [];
  }

  private nextId() {
    return `req-${++this.reqId}`;
  }

  private rawSend(obj: unknown) {
    this.ws?.send(JSON.stringify(obj));
  }
}
