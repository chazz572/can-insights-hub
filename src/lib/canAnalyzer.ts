// CAN Analyzer engine — rolling buffer, filters, FPS, WebSocket + replay.
// Framework-agnostic. React layer subscribes via subscribe().

export interface CanFrame {
  timestamp: number; // ms epoch
  id: number; // canonical numeric id
  bus: number | string;
  dlc: number;
  data: number[]; // 0..255
}

export interface RawCanFrame {
  timestamp: number | string;
  id: number | string;
  bus?: number | string;
  dlc?: number;
  data: number[] | string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "live" | "replay" | "paused" | "error";

export interface IdStat {
  id: number;
  count: number;
  lastTs: number;
  lastData: number[];
  prevData: number[];
  changedMask: number; // bitmap of bytes that changed on last update
  hz: number; // frames/sec for this ID
  bus: number | string;
  dlc: number;
}

export interface AnalyzerState {
  status: ConnectionStatus;
  totalFrames: number;
  fps: number;
  buses: (number | string)[];
  bufferSize: number;
  maxBuffer: number;
  paused: boolean;
}

export interface FilterSpec {
  idQuery?: string; // hex (0x...) or decimal, supports comma list and ranges (0x100-0x1FF)
  busQuery?: string;
  dataQuery?: string; // hex search like "DE AD" or "deadbe"
}

const toNum = (v: number | string): number => {
  if (typeof v === "number") return v;
  const s = v.trim();
  if (s.startsWith("0x") || s.startsWith("0X")) return parseInt(s.slice(2), 16);
  if (/^[0-9a-fA-F]+$/.test(s) && /[a-fA-F]/.test(s)) return parseInt(s, 16);
  return parseInt(s, 10);
};

const toData = (d: number[] | string): number[] => {
  if (Array.isArray(d)) return d.map((x) => x & 0xff);
  const clean = d.replace(/[^0-9a-fA-F]/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
};

const toTs = (t: number | string): number => {
  if (typeof t === "number") return t < 1e12 ? t * 1000 : t;
  const n = Date.parse(t);
  return Number.isNaN(n) ? Date.now() : n;
};

export const normalizeFrame = (raw: RawCanFrame): CanFrame => {
  const data = toData(raw.data);
  return {
    timestamp: toTs(raw.timestamp),
    id: toNum(raw.id),
    bus: raw.bus ?? 0,
    dlc: raw.dlc ?? data.length,
    data,
  };
};

export const formatId = (id: number) => `0x${id.toString(16).toUpperCase().padStart(3, "0")}`;
export const formatBytes = (data: number[]) =>
  data.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
export const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

// Color from id — deterministic hue
export const idHue = (id: number) => (id * 47) % 360;

export class CanAnalyzer {
  private buffer: CanFrame[] = [];
  private idStats = new Map<number, IdStat>();
  private listeners = new Set<() => void>();
  private state: AnalyzerState = {
    status: "disconnected",
    totalFrames: 0,
    fps: 0,
    buses: [],
    bufferSize: 0,
    maxBuffer: 5000,
    paused: false,
  };
  private fpsWindow: number[] = [];
  private fpsTimer: number | null = null;
  private ws: WebSocket | null = null;

  // Replay
  private replayFrames: CanFrame[] = [];
  private replayIndex = 0;
  private replaySpeed = 1;
  private replayTimer: number | null = null;
  private replayStartWall = 0;
  private replayStartTs = 0;

  constructor(maxBuffer = 5000) {
    this.state.maxBuffer = maxBuffer;
    this.fpsTimer = window.setInterval(() => this.tickFps(), 500);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  getState(): AnalyzerState {
    return this.state;
  }
  getBuffer(): CanFrame[] {
    return this.buffer;
  }
  getIdStats(): IdStat[] {
    return Array.from(this.idStats.values()).sort((a, b) => a.id - b.id);
  }

  pushFrame(raw: RawCanFrame | CanFrame) {
    if (this.state.paused) return;
    const frame = "data" in raw && Array.isArray(raw.data) && typeof raw.timestamp === "number" && typeof raw.id === "number"
      ? (raw as CanFrame)
      : normalizeFrame(raw as RawCanFrame);

    this.buffer.push(frame);
    if (this.buffer.length > this.state.maxBuffer) {
      this.buffer.splice(0, this.buffer.length - this.state.maxBuffer);
    }

    const prev = this.idStats.get(frame.id);
    let changedMask = 0;
    if (prev) {
      const len = Math.max(prev.lastData.length, frame.data.length);
      for (let i = 0; i < len; i++) {
        if ((prev.lastData[i] ?? -1) !== (frame.data[i] ?? -1)) changedMask |= 1 << i;
      }
      const dt = (frame.timestamp - prev.lastTs) / 1000;
      const hz = dt > 0 ? 0.7 * prev.hz + 0.3 * (1 / dt) : prev.hz;
      this.idStats.set(frame.id, {
        id: frame.id,
        count: prev.count + 1,
        lastTs: frame.timestamp,
        lastData: frame.data,
        prevData: prev.lastData,
        changedMask,
        hz,
        bus: frame.bus,
        dlc: frame.dlc,
      });
    } else {
      this.idStats.set(frame.id, {
        id: frame.id,
        count: 1,
        lastTs: frame.timestamp,
        lastData: frame.data,
        prevData: [],
        changedMask: 0,
        hz: 0,
        bus: frame.bus,
        dlc: frame.dlc,
      });
    }

    this.fpsWindow.push(frame.timestamp);
    this.state.totalFrames += 1;
    this.state.bufferSize = this.buffer.length;
    if (!this.state.buses.includes(frame.bus)) {
      this.state.buses = [...this.state.buses, frame.bus];
    }
    this.emit();
  }

  private tickFps() {
    const now = Date.now();
    this.fpsWindow = this.fpsWindow.filter((t) => now - t < 1000);
    this.state.fps = this.fpsWindow.length;
    this.emit();
  }

  setPaused(paused: boolean) {
    this.state.paused = paused;
    this.emit();
  }
  togglePause() {
    this.setPaused(!this.state.paused);
  }
  clear() {
    this.buffer = [];
    this.idStats.clear();
    this.state.totalFrames = 0;
    this.state.bufferSize = 0;
    this.state.buses = [];
    this.fpsWindow = [];
    this.emit();
  }

  // ---- WebSocket ----
  connectWebSocket(url: string) {
    this.disconnectWebSocket();
    this.state.status = "connecting";
    this.emit();
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.state.status = "live";
        this.emit();
      };
      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (Array.isArray(payload)) payload.forEach((f) => this.pushFrame(f));
          else this.pushFrame(payload);
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        this.state.status = "error";
        this.emit();
      };
      ws.onclose = () => {
        this.state.status = "disconnected";
        this.emit();
      };
    } catch {
      this.state.status = "error";
      this.emit();
    }
  }
  disconnectWebSocket() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
  }

  // ---- Replay ----
  loadLog(frames: RawCanFrame[]) {
    this.stopReplay();
    this.clear();
    this.replayFrames = frames.map(normalizeFrame).sort((a, b) => a.timestamp - b.timestamp);
    this.replayIndex = 0;
    this.state.status = "replay";
    this.state.paused = true;
    this.emit();
  }
  getReplayInfo() {
    const total = this.replayFrames.length;
    const first = this.replayFrames[0]?.timestamp ?? 0;
    const last = this.replayFrames[total - 1]?.timestamp ?? 0;
    return { total, index: this.replayIndex, duration: last - first, first, last };
  }
  setReplaySpeed(s: number) {
    this.replaySpeed = s;
    if (this.replayTimer) {
      this.pauseReplay();
      this.playReplay();
    }
  }
  getReplaySpeed() {
    return this.replaySpeed;
  }
  seekReplay(ratio: number) {
    const total = this.replayFrames.length;
    if (!total) return;
    const idx = Math.max(0, Math.min(total - 1, Math.floor(ratio * total)));
    this.pauseReplay();
    this.buffer = [];
    this.idStats.clear();
    this.state.totalFrames = 0;
    this.state.bufferSize = 0;
    this.replayIndex = 0;
    // Replay frames up to idx without timing
    const wasPaused = this.state.paused;
    this.state.paused = false;
    for (let i = 0; i <= idx; i++) this.pushFrame(this.replayFrames[i]);
    this.replayIndex = idx + 1;
    this.state.paused = wasPaused;
    this.emit();
  }
  playReplay() {
    if (!this.replayFrames.length) return;
    this.state.paused = false;
    this.state.status = "replay";
    this.replayStartWall = performance.now();
    this.replayStartTs = this.replayFrames[this.replayIndex]?.timestamp ?? this.replayFrames[0].timestamp;
    const tick = () => {
      const wallElapsed = (performance.now() - this.replayStartWall) * this.replaySpeed;
      while (
        this.replayIndex < this.replayFrames.length &&
        this.replayFrames[this.replayIndex].timestamp - this.replayStartTs <= wallElapsed
      ) {
        this.pushFrame(this.replayFrames[this.replayIndex++]);
      }
      if (this.replayIndex >= this.replayFrames.length) {
        this.stopReplay();
        return;
      }
      this.replayTimer = window.requestAnimationFrame(tick);
    };
    this.replayTimer = window.requestAnimationFrame(tick);
    this.emit();
  }
  pauseReplay() {
    if (this.replayTimer) {
      window.cancelAnimationFrame(this.replayTimer);
      this.replayTimer = null;
    }
    this.state.paused = true;
    this.emit();
  }
  stopReplay() {
    this.pauseReplay();
  }

  destroy() {
    this.disconnectWebSocket();
    this.stopReplay();
    if (this.fpsTimer) window.clearInterval(this.fpsTimer);
    this.listeners.clear();
  }
}

// ---- Filtering ----
const parseIdQuery = (q: string): ((id: number) => boolean) | null => {
  const s = q.trim();
  if (!s) return null;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const matchers: ((id: number) => boolean)[] = [];
  for (const p of parts) {
    const range = p.split("-");
    if (range.length === 2) {
      const a = toNum(range[0]);
      const b = toNum(range[1]);
      if (!Number.isNaN(a) && !Number.isNaN(b)) matchers.push((id) => id >= a && id <= b);
    } else {
      const n = toNum(p);
      if (!Number.isNaN(n)) matchers.push((id) => id === n);
    }
  }
  if (!matchers.length) return null;
  return (id) => matchers.some((m) => m(id));
};

export const filterFrames = (frames: CanFrame[], spec: FilterSpec): CanFrame[] => {
  const idMatch = spec.idQuery ? parseIdQuery(spec.idQuery) : null;
  const busQ = spec.busQuery?.trim().toLowerCase();
  const dataQ = spec.dataQuery?.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (!idMatch && !busQ && !dataQ) return frames;
  return frames.filter((f) => {
    if (idMatch && !idMatch(f.id)) return false;
    if (busQ && String(f.bus).toLowerCase() !== busQ) return false;
    if (dataQ) {
      const hex = f.data.map((b) => b.toString(16).padStart(2, "0")).join("");
      if (!hex.includes(dataQ)) return false;
    }
    return true;
  });
};

// ---- Synthetic frame generator (for "Demo" mode) ----
export const createDemoSource = (analyzer: CanAnalyzer) => {
  const ids = [0x100, 0x110, 0x123, 0x18febb, 0x201, 0x280, 0x316, 0x391, 0x440, 0x7e8];
  const state = new Map<number, number[]>();
  ids.forEach((id) => state.set(id, Array.from({ length: 8 }, () => Math.floor(Math.random() * 256))));
  let running = true;
  const tick = () => {
    if (!running) return;
    // Burst of 8-20 frames every animation frame
    const burst = 8 + Math.floor(Math.random() * 12);
    for (let i = 0; i < burst; i++) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      const prev = state.get(id)!;
      // Mutate 1-2 bytes slightly
      const next = [...prev];
      const idx = Math.floor(Math.random() * 8);
      next[idx] = (next[idx] + (Math.floor(Math.random() * 5) - 2) + 256) % 256;
      state.set(id, next);
      analyzer.pushFrame({
        timestamp: Date.now(),
        id,
        bus: id > 0x18000000 ? 1 : 0,
        dlc: 8,
        data: next,
      });
    }
    raf = window.requestAnimationFrame(tick);
  };
  let raf = window.requestAnimationFrame(tick);
  analyzer.getState().status = "live";
  return () => {
    running = false;
    window.cancelAnimationFrame(raf);
  };
};
