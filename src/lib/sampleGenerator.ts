// Vehicle Sample Log + DBC Generator
// Fully synthetic, fictional CAN data — no real OEM signals or proprietary info.

export type DrivingState =
  | "launch_0_60"
  | "idle_ac_on"
  | "regen_braking"
  | "highway_cruise"
  | "charging_20_80"
  | "city_stop_go"
  | "top_speed_run"
  | "custom";

export interface SampleRequest {
  vehicleDescription: string;
  drivingState: DrivingState;
  customStateNotes?: string;
  durationSec: number;
  seed?: number;
}

export interface SampleOutput {
  dbc: string;
  log: string;
  summary: string;
  stats: {
    messages: number;
    uniqueIds: number;
    durationSec: number;
    avgRateHz: number;
  };
}

// Simple seeded PRNG (mulberry32) for reproducibility
const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface SignalDef {
  name: string;
  startBit: number;
  length: number;
  factor: number;
  offset: number;
  min: number;
  max: number;
  unit: string;
}

interface FrameDef {
  id: number; // 11-bit
  name: string;
  dlc: number;
  cycleMs: number;
  signals: SignalDef[];
  // returns physical values keyed by signal name for time t (sec)
  shape: (t: number, ctx: ShapeCtx) => Record<string, number>;
}

interface ShapeCtx {
  state: DrivingState;
  duration: number;
  rand: () => number;
  topSpeedKph: number;
}

// Heuristic — fully fictional; just maps loose vehicle keywords to a plausible top speed.
const inferTopSpeedKph = (desc: string): number => {
  const s = desc.toLowerCase();
  if (/(hyper|bugatti|chiron|veyron|koenig|jesko)/.test(s)) return 420;
  if (/(super|lambo|huracan|aventador|ferrari|mclaren|gt3|gt2|911 turbo|porsche.*turbo)/.test(s)) return 330;
  if (/(plaid|model s plaid|taycan turbo|amg|m3|m5|rs[ -]?\d|sport sedan|performance)/.test(s)) return 280;
  if (/(model s|model 3|model y|ev sedan|ev hatchback|ev crossover|polestar|lucid|ev sport)/.test(s)) return 250;
  if (/(truck|f-?150|silverado|ram|pickup|suv|crossover|minivan|van)/.test(s)) return 180;
  if (/(econ|compact|hatch|civic|corolla|sedan|generic ev sedan|generic)/.test(s)) return 210;
  if (/(motorcycle|bike|sport bike)/.test(s)) return 290;
  return 220;
};

// Generic, safe, fictional frame catalog
const buildFrames = (): FrameDef[] => [
  {
    id: 0x100,
    name: "VEH_Speed",
    dlc: 8,
    cycleMs: 20,
    signals: [
      { name: "VehicleSpeed", startBit: 0, length: 16, factor: 0.01, offset: 0, min: 0, max: 250, unit: "km/h" },
      { name: "AcceleratorPedal", startBit: 16, length: 8, factor: 0.4, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "BrakePressure", startBit: 24, length: 16, factor: 0.1, offset: 0, min: 0, max: 200, unit: "bar" },
      { name: "GearPosition", startBit: 40, length: 4, factor: 1, offset: 0, min: 0, max: 8, unit: "" },
      { name: "Counter_100", startBit: 48, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
      { name: "Checksum_100", startBit: 56, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (t, ctx) => {
      const d = ctx.duration;
      const r = ctx.rand;
      let speed = 0;
      let pedal = 0;
      let brake = 0;
      let gear = 1;
      switch (ctx.state) {
        case "launch_0_60": {
          // 0 -> ~97 km/h over duration
          const k = Math.min(1, t / Math.max(1, d * 0.85));
          speed = 97 * (1 - Math.pow(1 - k, 1.6));
          pedal = 95 - k * 10 + (r() - 0.5) * 2;
          brake = 0;
          gear = 1 + Math.floor(k * 5);
          break;
        }
        case "idle_ac_on":
          speed = 0;
          pedal = 0;
          brake = 1 + (r() - 0.5) * 0.4;
          gear = 0;
          break;
        case "regen_braking": {
          const k = Math.min(1, t / d);
          speed = Math.max(0, 80 - k * 75);
          pedal = 0;
          brake = 5 + (r() - 0.5);
          gear = 4;
          break;
        }
        case "highway_cruise":
          speed = 112 + Math.sin(t * 0.4) * 1.2 + (r() - 0.5) * 0.6;
          pedal = 22 + Math.sin(t * 0.3) * 2 + (r() - 0.5);
          brake = 0;
          gear = 6;
          break;
        case "charging_20_80":
          speed = 0;
          pedal = 0;
          brake = 0;
          gear = 0;
          break;
        case "city_stop_go": {
          const phase = (t % 30) / 30;
          if (phase < 0.4) speed = phase * 2.5 * 35;
          else if (phase < 0.7) speed = 35 + Math.sin(phase * 10) * 3;
          else speed = Math.max(0, 35 - (phase - 0.7) * 116);
          pedal = speed > 5 ? 18 + (r() - 0.5) * 4 : 0;
          brake = speed < 5 && phase > 0.7 ? 8 : 0;
          gear = speed > 25 ? 3 : speed > 10 ? 2 : 1;
          break;
        }
        default:
          speed = 40 + Math.sin(t * 0.5) * 10;
          pedal = 20;
          brake = 0;
          gear = 3;
      }
      return { VehicleSpeed: speed, AcceleratorPedal: pedal, BrakePressure: brake, GearPosition: gear };
    },
  },
  {
    id: 0x110,
    name: "VEH_Wheels",
    dlc: 8,
    cycleMs: 20,
    signals: [
      { name: "WheelSpeed_FL", startBit: 0, length: 16, factor: 0.01, offset: 0, min: 0, max: 260, unit: "km/h" },
      { name: "WheelSpeed_FR", startBit: 16, length: 16, factor: 0.01, offset: 0, min: 0, max: 260, unit: "km/h" },
      { name: "WheelSpeed_RL", startBit: 32, length: 16, factor: 0.01, offset: 0, min: 0, max: 260, unit: "km/h" },
      { name: "WheelSpeed_RR", startBit: 48, length: 16, factor: 0.01, offset: 0, min: 0, max: 260, unit: "km/h" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      // mirror VEH_Speed approx
      const base =
        ctx.state === "idle_ac_on" || ctx.state === "charging_20_80"
          ? 0
          : ctx.state === "highway_cruise"
            ? 112
            : ctx.state === "launch_0_60"
              ? 97 * (1 - Math.pow(1 - Math.min(1, t / Math.max(1, ctx.duration * 0.85)), 1.6))
              : ctx.state === "regen_braking"
                ? Math.max(0, 80 - (t / ctx.duration) * 75)
                : 30 + Math.sin(t * 0.5) * 10;
      const j = () => (r() - 0.5) * 0.4;
      return {
        WheelSpeed_FL: Math.max(0, base + j()),
        WheelSpeed_FR: Math.max(0, base + j()),
        WheelSpeed_RL: Math.max(0, base + j()),
        WheelSpeed_RR: Math.max(0, base + j()),
      };
    },
  },
  {
    id: 0x200,
    name: "VEH_Steering",
    dlc: 8,
    cycleMs: 20,
    signals: [
      { name: "SteeringAngle", startBit: 0, length: 16, factor: 0.1, offset: -780, min: -780, max: 780, unit: "deg" },
      { name: "SteeringRate", startBit: 16, length: 16, factor: 0.1, offset: -500, min: -500, max: 500, unit: "deg/s" },
      { name: "Counter_200", startBit: 32, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      let angle = 0;
      switch (ctx.state) {
        case "highway_cruise":
          angle = Math.sin(t * 0.6) * 3 + (r() - 0.5) * 1.2;
          break;
        case "city_stop_go":
          angle = Math.sin(t * 0.4) * 25 + (r() - 0.5) * 4;
          break;
        case "launch_0_60":
          angle = (r() - 0.5) * 2;
          break;
        case "regen_braking":
          angle = (r() - 0.5) * 4;
          break;
        default:
          angle = (r() - 0.5) * 1.5;
      }
      return { SteeringAngle: angle, SteeringRate: (r() - 0.5) * 20 };
    },
  },
  {
    id: 0x300,
    name: "PWR_Battery",
    dlc: 8,
    cycleMs: 100,
    signals: [
      { name: "BatterySOC", startBit: 0, length: 16, factor: 0.01, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "BatteryVoltage", startBit: 16, length: 16, factor: 0.1, offset: 0, min: 0, max: 600, unit: "V" },
      { name: "BatteryCurrent", startBit: 32, length: 16, factor: 0.1, offset: -1000, min: -500, max: 500, unit: "A" },
      { name: "BatteryTemp", startBit: 48, length: 8, factor: 1, offset: -40, min: -40, max: 100, unit: "C" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      let soc = 70;
      let current = 0;
      let temp = 28;
      switch (ctx.state) {
        case "charging_20_80": {
          const k = Math.min(1, t / ctx.duration);
          soc = 20 + k * 60;
          current = -120 + (r() - 0.5) * 4; // negative = into battery
          temp = 30 + k * 6;
          break;
        }
        case "launch_0_60":
          soc = 78 - (t / ctx.duration) * 0.4;
          current = 240 + (r() - 0.5) * 10;
          temp = 32 + (t / ctx.duration) * 3;
          break;
        case "regen_braking":
          soc = 65 + (t / ctx.duration) * 0.3;
          current = -80 + (r() - 0.5) * 6;
          temp = 30;
          break;
        case "highway_cruise":
          soc = 72 - (t / ctx.duration) * 0.6;
          current = 60 + (r() - 0.5) * 4;
          temp = 32;
          break;
        case "idle_ac_on":
          soc = 80 - (t / ctx.duration) * 0.05;
          current = 12 + (r() - 0.5);
          temp = 29;
          break;
        case "city_stop_go":
          soc = 70 - (t / ctx.duration) * 0.4;
          current = 30 + Math.sin(t) * 20;
          temp = 31;
          break;
        default:
          soc = 70;
          current = 20;
      }
      return { BatterySOC: soc, BatteryVoltage: 396 + (r() - 0.5) * 2, BatteryCurrent: current, BatteryTemp: temp };
    },
  },
  {
    id: 0x310,
    name: "PWR_Torque",
    dlc: 8,
    cycleMs: 20,
    signals: [
      { name: "TorqueRequest", startBit: 0, length: 16, factor: 0.1, offset: -3000, min: -1000, max: 1000, unit: "Nm" },
      { name: "TorqueActual", startBit: 16, length: 16, factor: 0.1, offset: -3000, min: -1000, max: 1000, unit: "Nm" },
      { name: "MotorTemp", startBit: 32, length: 8, factor: 1, offset: -40, min: -40, max: 160, unit: "C" },
      { name: "Checksum_310", startBit: 56, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      let req = 0;
      switch (ctx.state) {
        case "launch_0_60": {
          const k = Math.min(1, t / Math.max(1, ctx.duration * 0.85));
          req = 480 * (1 - k * 0.4) + (r() - 0.5) * 6;
          break;
        }
        case "regen_braking":
          req = -180 + (r() - 0.5) * 8;
          break;
        case "highway_cruise":
          req = 60 + Math.sin(t * 0.3) * 8 + (r() - 0.5) * 2;
          break;
        case "idle_ac_on":
          req = 0;
          break;
        case "charging_20_80":
          req = 0;
          break;
        case "city_stop_go":
          req = 80 + Math.sin(t * 0.5) * 60 + (r() - 0.5) * 6;
          break;
        default:
          req = 50;
      }
      const actual = req * 0.97 + (r() - 0.5) * 4;
      return { TorqueRequest: req, TorqueActual: actual, MotorTemp: 45 + (t / ctx.duration) * 8 };
    },
  },
  {
    id: 0x400,
    name: "BCM_Lights",
    dlc: 4,
    cycleMs: 200,
    signals: [
      { name: "TurnSignals", startBit: 0, length: 4, factor: 1, offset: 0, min: 0, max: 3, unit: "" },
      { name: "Headlights", startBit: 4, length: 2, factor: 1, offset: 0, min: 0, max: 3, unit: "" },
      { name: "HazardLights", startBit: 6, length: 1, factor: 1, offset: 0, min: 0, max: 1, unit: "" },
      { name: "Counter_400", startBit: 8, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (_t, ctx) => ({
      TurnSignals: ctx.state === "city_stop_go" ? Math.floor(ctx.rand() * 3) : 0,
      Headlights: 1,
      HazardLights: 0,
    }),
  },
];

const encodePhysical = (sig: SignalDef, value: number): number => {
  const clamped = Math.max(sig.min, Math.min(sig.max, value));
  const raw = Math.round((clamped - sig.offset) / sig.factor);
  const maxRaw = (1 << sig.length) - 1;
  return Math.max(0, Math.min(maxRaw, raw));
};

// Pack signals little-endian Intel into 8-byte buffer
const packFrame = (frame: FrameDef, values: Record<string, number>, counter: number): Uint8Array => {
  const bytes = new Uint8Array(frame.dlc);
  for (const sig of frame.signals) {
    let raw =
      sig.name.startsWith("Counter_") ? counter & 0xff :
      sig.name.startsWith("Checksum_") ? 0 : // computed after
      encodePhysical(sig, values[sig.name] ?? 0);

    let bit = sig.startBit;
    let remaining = sig.length;
    while (remaining > 0) {
      const byteIdx = Math.floor(bit / 8);
      const bitInByte = bit % 8;
      const take = Math.min(8 - bitInByte, remaining);
      const mask = (1 << take) - 1;
      const chunk = raw & mask;
      if (byteIdx < bytes.length) {
        bytes[byteIdx] |= (chunk << bitInByte) & 0xff;
      }
      raw >>>= take;
      bit += take;
      remaining -= take;
    }
  }
  // Compute simple XOR checksum for any Checksum_* signal
  for (const sig of frame.signals) {
    if (sig.name.startsWith("Checksum_")) {
      let xor = 0;
      for (let i = 0; i < bytes.length - 1; i++) xor ^= bytes[i];
      const byteIdx = Math.floor(sig.startBit / 8);
      if (byteIdx < bytes.length) bytes[byteIdx] = xor;
    }
  }
  return bytes;
};

const toHex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, "0");

const buildDbc = (frames: FrameDef[], vehicleDescription: string): string => {
  const header = `VERSION "1.0"

NS_ :
\tNS_DESC_
\tCM_
\tBA_DEF_
\tBA_
\tVAL_
\tCAT_DEF_
\tCAT_
\tFILTER
\tBA_DEF_DEF_
\tEV_DATA_
\tENVVAR_DATA_
\tSGTYPE_
\tSGTYPE_VAL_
\tBA_DEF_SGTYPE_
\tBA_SGTYPE_
\tSIG_TYPE_REF_
\tVAL_TABLE_
\tSIG_GROUP_
\tSIG_VALTYPE_
\tSIGTYPE_VALTYPE_
\tBO_TX_BU_
\tBA_DEF_REL_
\tBA_REL_
\tBA_DEF_DEF_REL_
\tBU_SG_REL_
\tBU_EV_REL_
\tBU_BO_REL_
\tSG_MUL_VAL_

BS_:

BU_: VCU BMS MCU BCM EPS

`;
  const messages = frames
    .map((f) => {
      const sigs = f.signals
        .map(
          (s) =>
            ` SG_ ${s.name} : ${s.startBit}|${s.length}@1+ (${s.factor},${s.offset}) [${s.min}|${s.max}] "${s.unit}" Vector__XXX`,
        )
        .join("\n");
      return `BO_ ${f.id} ${f.name}: ${f.dlc} VCU\n${sigs}\n`;
    })
    .join("\n");
  const comment = `\nCM_ "Synthetic DBC for: ${vehicleDescription.replace(/"/g, "'")} — fully fictional, generic signals. Generated by CJL CAN Intelligence Platform. Not affiliated with any OEM.";\n`;
  return header + messages + comment;
};

const buildLog = (
  frames: FrameDef[],
  duration: number,
  rand: () => number,
  state: DrivingState,
  topSpeedKph: number,
): { log: string; messageCount: number } => {
  // candump-style: (timestamp) can0 ID#DATA
  const lines: string[] = [];
  const ctx: ShapeCtx = { state, duration, rand, topSpeedKph };
  const counters: Record<number, number> = {};
  // schedule: emit each frame at its cycleMs
  let messageCount = 0;
  const startTs = Date.now() / 1000;
  for (const f of frames) {
    counters[f.id] = 0;
    const jitterBase = f.cycleMs * 0.02; // 2% jitter
    for (let t = 0; t < duration * 1000; t += f.cycleMs) {
      const jitter = (rand() - 0.5) * jitterBase;
      const tsSec = startTs + (t + jitter) / 1000;
      const tSec = (t + jitter) / 1000;
      const values = f.shape(tSec, ctx);
      const bytes = packFrame(f, values, counters[f.id]);
      counters[f.id] = (counters[f.id] + 1) & 0xff;
      const dataHex = Array.from(bytes).map((b) => toHex(b, 2)).join("");
      lines.push(`(${tsSec.toFixed(6)}) can0 ${toHex(f.id, 3)}#${dataHex}`);
      messageCount += 1;
    }
  }
  // sort chronologically
  lines.sort((a, b) => {
    const ta = parseFloat(a.slice(1, a.indexOf(")")));
    const tb = parseFloat(b.slice(1, b.indexOf(")")));
    return ta - tb;
  });
  return { log: lines.join("\n") + "\n", messageCount };
};

const stateLabel: Record<DrivingState, string> = {
  launch_0_60: "0–60 launch",
  idle_ac_on: "Idle with HVAC load",
  regen_braking: "Regenerative braking",
  highway_cruise: "Highway cruise",
  charging_20_80: "DC charging 20% → 80%",
  city_stop_go: "City stop-and-go",
  custom: "Custom driving state",
};

const buildSummary = (req: SampleRequest, frames: FrameDef[], stats: SampleOutput["stats"]): string => {
  const sigCount = frames.reduce((n, f) => n + f.signals.length, 0);
  const lines = [
    `Synthetic Sample Summary`,
    `------------------------`,
    `Vehicle profile: ${req.vehicleDescription} (fictional, generic)`,
    `Driving state: ${stateLabel[req.drivingState]}${req.customStateNotes ? ` — ${req.customStateNotes}` : ""}`,
    `Duration: ${stats.durationSec.toFixed(1)}s`,
    `Frames defined: ${frames.length}`,
    `Signals defined: ${sigCount}`,
    `Total CAN messages: ${stats.messages}`,
    `Average bus rate: ${stats.avgRateHz.toFixed(0)} msg/s`,
    ``,
    `Behavior characteristics:`,
  ];
  switch (req.drivingState) {
    case "launch_0_60":
      lines.push("- Rising VehicleSpeed and TorqueRequest, near-zero steering, mild SOC drop, gear progression 1→6.");
      break;
    case "idle_ac_on":
      lines.push("- Stationary speed/wheels, near-zero torque, light HVAC current draw, stable thermal signals.");
      break;
    case "regen_braking":
      lines.push("- Decelerating wheel speeds, negative TorqueRequest, slowly rising BatterySOC, low brake pressure.");
      break;
    case "highway_cruise":
      lines.push("- Stable speed near 112 km/h, small steering oscillations, gentle SOC decay, steady torque.");
      break;
    case "charging_20_80":
      lines.push("- Stationary vehicle, negative battery current (charging), SOC ramps 20% → 80%, mild thermal rise.");
      break;
    case "city_stop_go":
      lines.push("- Repeated accel/coast/brake cycles, occasional turn signals, varying gear and steering inputs.");
      break;
    default:
      lines.push("- Custom mixed behavior with stable plausible payload patterns.");
  }
  lines.push("");
  lines.push("All signals are fictional and not derived from any OEM, vendor, or proprietary database.");
  return lines.join("\n");
};

export const generateSample = (req: SampleRequest): SampleOutput => {
  const seed = req.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = mulberry32(seed);
  const frames = buildFrames();
  const duration = Math.max(2, Math.min(120, req.durationSec));
  const dbc = buildDbc(frames, req.vehicleDescription);
  const { log, messageCount } = buildLog(frames, duration, rand, req.drivingState);
  const stats = {
    messages: messageCount,
    uniqueIds: frames.length,
    durationSec: duration,
    avgRateHz: messageCount / duration,
  };
  const summary = buildSummary(req, frames, stats);
  return { dbc, log, summary, stats };
};

export const drivingStateOptions: Array<{ value: DrivingState; label: string }> = [
  { value: "launch_0_60", label: "0–60 launch" },
  { value: "idle_ac_on", label: "Idle with HVAC on" },
  { value: "regen_braking", label: "Regen braking" },
  { value: "highway_cruise", label: "Highway cruise (70 mph)" },
  { value: "charging_20_80", label: "DC charging 20% → 80%" },
  { value: "city_stop_go", label: "City stop-and-go" },
  { value: "custom", label: "Custom (describe below)" },
];
