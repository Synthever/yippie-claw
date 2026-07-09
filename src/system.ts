import fs from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";

export interface SystemSnapshot {
  cpu: number;        // 0-100 percent
  memTotal: number;   // bytes
  memUsed: number;    // bytes
  diskTotal: number;  // bytes
  diskUsed: number;   // bytes
  uptime: number;     // seconds
}

// --- CPU ---
interface CpuTimes { idle: number; total: number }

async function readCpuTimes(): Promise<CpuTimes> {
  const raw = await fs.readFile("/proc/stat", "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("cpu "))!;
  const nums = line.trim().split(/\s+/).slice(1).map(Number);
  // user nice system idle iowait irq softirq steal guest guest_nice
  const idle = nums[3] + (nums[4] ?? 0);
  const total = nums.reduce((a, b) => a + b, 0);
  return { idle, total };
}

async function getCpuPercent(): Promise<number> {
  const a = await readCpuTimes();
  await new Promise((r) => setTimeout(r, 500));
  const b = await readCpuTimes();
  const totalDiff = b.total - a.total;
  const idleDiff = b.idle - a.idle;
  if (totalDiff === 0) return 0;
  return Math.round(((totalDiff - idleDiff) / totalDiff) * 100 * 10) / 10;
}

// --- Memory ---
interface MemInfo { total: number; used: number }

async function getMemInfo(): Promise<MemInfo> {
  const raw = await fs.readFile("/proc/meminfo", "utf8");
  const get = (key: string) => {
    const m = new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(raw);
    return m ? Number(m[1]) * 1024 : 0; // kB → bytes
  };
  const total = get("MemTotal");
  const avail = get("MemAvailable") || get("MemFree");
  return { total, used: total - avail };
}

// --- Disk ---
interface DiskInfo { total: number; used: number }

function getDiskInfo(): Promise<DiskInfo> {
  return new Promise((resolve, reject) => {
    execFile("df", ["-k", "/"], { timeout: 5000 }, (err, stdout) => {
      if (err) return reject(err);
      // Filesystem  1K-blocks  Used Available Use% Mounted
      const line = stdout.split("\n")[1];
      if (!line) return reject(new Error("df parse fail"));
      const parts = line.trim().split(/\s+/);
      const total = Number(parts[1]) * 1024;
      const used = Number(parts[2]) * 1024;
      resolve({ total, used });
    });
  });
}

// --- Cache + refresh loop ---
let cached: SystemSnapshot = {
  cpu: 0, memTotal: 0, memUsed: 0, diskTotal: 0, diskUsed: 0, uptime: os.uptime(),
};
let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const [cpu, mem, disk] = await Promise.all([getCpuPercent(), getMemInfo(), getDiskInfo()]);
    cached = { cpu, memTotal: mem.total, memUsed: mem.used, diskTotal: disk.total, diskUsed: disk.used, uptime: os.uptime() };
  } catch (e) {
    // keep stale cache on error
  } finally {
    refreshing = false;
  }
}

// Start refresh loop — called once at startup
export function startSystemPoller(intervalMs = 2000) {
  refresh(); // initial (takes ~500ms due to CPU diff)
  setInterval(refresh, intervalMs);
}

export function getSystemSnapshot(): SystemSnapshot {
  return { ...cached };
}
