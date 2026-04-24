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

export type Powertrain = "bev" | "phev" | "hybrid" | "ice" | "diesel";

export interface VehicleProfile {
  description: string;
  powertrain: Powertrain;
  topSpeedKph: number;
  zeroTo100Sec: number; // 0->100 km/h
  gearCount: number; // 1 for most BEVs, 5-10 for ICE
  packKwh: number; // 0 for pure ICE
  nominalPackVolts: number; // ~400 typical, ~800 for high-perf EV
  peakMotorTorqueNm: number;
  curbWeightKg: number;
  cruiseKph: number; // typical highway cruise
  hvacIdleAmps: number;
  hasRegen: boolean;
}

interface ShapeCtx {
  state: DrivingState;
  duration: number;
  rand: () => number;
  vehicle: VehicleProfile;
  // legacy alias kept for any older references
  topSpeedKph: number;
}

// Build a fictional-but-plausible profile from the user's description.
const buildVehicleProfile = (desc: string): VehicleProfile => {
  const s = desc.toLowerCase();
  const has = (re: RegExp) => re.test(s);

  // Powertrain detection
  let powertrain: Powertrain = "ice";
  if (has(/\b(bev|electric|ev\b|model [sy3x]|plaid|taycan|lucid|polestar|ioniq|i[345x]\b|mach-?e|rivian|cybertruck|leaf|bolt|kona electric|niro ev|id\.\d)/)) powertrain = "bev";
  else if (has(/\b(phev|plug-?in)\b/)) powertrain = "phev";
  else if (has(/\b(hybrid|prius|hev)\b/)) powertrain = "hybrid";
  else if (has(/\b(diesel|tdi|duramax|cummins|powerstroke)\b/)) powertrain = "diesel";

  // Top speed buckets (km/h)
  let topSpeedKph = 220;
  if (has(/(bugatti|chiron|veyron|koenig|jesko|hennessey|tuatara|hypercar)/)) topSpeedKph = 430;
  else if (has(/(plaid|model s plaid)/)) topSpeedKph = 322;
  else if (has(/(taycan turbo s|taycan turbo)/)) topSpeedKph = 260;
  else if (has(/(911 turbo s|911 turbo|gt2|gt3 rs)/)) topSpeedKph = 330;
  else if (has(/(huracan|aventador|ferrari|mclaren|sf90|296|f8|720s|765lt|revuelto|temerario)/)) topSpeedKph = 325;
  else if (has(/(amg gt|m5 cs|m5|m3 cs|m3|m4|rs[ -]?[6-7]|rs[ -]?e-?tron|e63|c63|s63)/)) topSpeedKph = 290;
  else if (has(/(supercar|super sport|performance coupe)/)) topSpeedKph = 305;
  else if (has(/(corvette|c8|z06|gt500|hellcat|trackhawk|demon)/)) topSpeedKph = 310;
  else if (has(/(sport sedan|performance sedan|m340|s4|rs3|cts-?v|ats-?v)/)) topSpeedKph = 250;
  else if (has(/(model s|model 3 performance|polestar|lucid air|i4 m50|ev sport)/)) topSpeedKph = 250;
  else if (has(/(model y|model x|mach-?e|ioniq 5|ioniq 6|ev[6-9]|id\.\d|ariya|kia ev|enyaq)/)) topSpeedKph = 200;
  else if (has(/(truck|f-?150|silverado|ram\b|sierra|tundra|titan|pickup|cybertruck|lightning|rivian r1t)/)) topSpeedKph = 180;
  else if (has(/(suv|crossover|tahoe|suburban|expedition|escalade|x7|gls|q7|q8|range rover|cayenne)/)) topSpeedKph = 210;
  else if (has(/(van|minivan|sienna|odyssey|pacifica|carnival|transit|sprinter)/)) topSpeedKph = 170;
  else if (has(/(motorcycle|sport bike|hayabusa|ninja h2|panigale|s1000rr)/)) topSpeedKph = 300;
  else if (has(/(econ|compact|hatch|civic|corolla|fit|yaris|spark|mirage|versa)/)) topSpeedKph = 200;
  else if (has(/(sedan|camry|accord|altima|sonata|passat|jetta)/)) topSpeedKph = 215;

  // 0->100 km/h (seconds)
  let zeroTo100Sec = 8.5;
  if (topSpeedKph >= 400) zeroTo100Sec = 2.4;
  else if (has(/(plaid|chiron|tuatara|nevera|rimac)/)) zeroTo100Sec = 2.1;
  else if (has(/(911 turbo s|sf90|revuelto|gt2 rs|765lt|trackhawk|demon)/)) zeroTo100Sec = 2.7;
  else if (topSpeedKph >= 320) zeroTo100Sec = 2.9;
  else if (has(/(m5|e63|s63|amg gt|rs[ -]?[6-7]|gt500|hellcat|corvette|model s long|taycan)/)) zeroTo100Sec = 3.5;
  else if (topSpeedKph >= 290) zeroTo100Sec = 3.6;
  else if (has(/(m3|m4|c63|rs[ -]?[3-5]|model 3 performance|i4 m50|polestar 2 dual|ev6 gt)/)) zeroTo100Sec = 4.2;
  else if (has(/(model y performance|mach-?e gt|ioniq 5 n|ev6)/)) zeroTo100Sec = 5.0;
  else if (has(/(sport sedan|performance|gti|si\b|st\b)/)) zeroTo100Sec = 6.2;
  else if (has(/(truck|pickup|f-?150|silverado|ram|sierra|tundra)/)) zeroTo100Sec = 7.5;
  else if (has(/(lightning|cybertruck|rivian)/)) zeroTo100Sec = 4.5;
  else if (has(/(suv|crossover|tahoe|suburban)/)) zeroTo100Sec = 8.0;
  else if (has(/(van|minivan|sprinter|transit)/)) zeroTo100Sec = 10.5;
  else if (has(/(econ|compact|hatch|civic|corolla|fit|yaris|spark|mirage|versa)/)) zeroTo100Sec = 9.8;
  else if (has(/(motorcycle|sport bike|hayabusa|ninja h2|panigale)/)) zeroTo100Sec = 2.8;

  // Gearbox
  let gearCount = 6;
  if (powertrain === "bev") gearCount = has(/(taycan|audi e-?tron gt)/) ? 2 : 1;
  else if (has(/(cvt)/)) gearCount = 1;
  else if (has(/(10[- ]?speed|f-?150|raptor|silverado|ram|sierra)/)) gearCount = 10;
  else if (has(/(8[- ]?speed|bmw|audi|mercedes|amg|m3|m5|m4|range rover)/)) gearCount = 8;
  else if (has(/(7[- ]?speed|pdk|dct|gtr)/)) gearCount = 7;
  else if (has(/(manual|stick|6[- ]?speed)/)) gearCount = 6;
  else if (has(/(corolla|civic|fit|yaris|hatch|econ)/)) gearCount = 6;

  // Battery pack (kWh) and pack voltage
  let packKwh = 0;
  let nominalPackVolts = 12;
  if (powertrain === "bev") {
    if (has(/(plaid|model s|lucid air|ev9|cybertruck|hummer ev|rivian r1[ts])/)) packKwh = 100;
    else if (has(/(taycan|e-?tron gt|i7|eqs)/)) { packKwh = 93; nominalPackVolts = 800; }
    else if (has(/(model 3 long|model y long|ioniq 5|ioniq 6|ev6|polestar 2|mach-?e|id\.\d)/)) packKwh = 77;
    else if (has(/(model 3|model y|leaf|bolt|kona|niro)/)) packKwh = 60;
    else packKwh = 70;
    if (nominalPackVolts === 12) nominalPackVolts = has(/(800v|porsche|hyundai e-?gmp|ioniq|ev6|lucid)/) ? 800 : 400;
  } else if (powertrain === "phev") {
    packKwh = 16;
    nominalPackVolts = 350;
  } else if (powertrain === "hybrid") {
    packKwh = 1.5;
    nominalPackVolts = 270;
  }

  // Peak motor / engine torque (Nm) — fictional but scaled
  let peakMotorTorqueNm = 350;
  if (topSpeedKph >= 400) peakMotorTorqueNm = 1600;
  else if (has(/(plaid|nevera|rimac)/)) peakMotorTorqueNm = 1400;
  else if (powertrain === "bev" && topSpeedKph >= 250) peakMotorTorqueNm = 900;
  else if (powertrain === "bev") peakMotorTorqueNm = 600;
  else if (has(/(diesel|cummins|duramax|powerstroke)/)) peakMotorTorqueNm = 1200;
  else if (has(/(truck|f-?150|silverado|ram|sierra|tundra)/)) peakMotorTorqueNm = 700;
  else if (topSpeedKph >= 320) peakMotorTorqueNm = 800;
  else if (topSpeedKph >= 290) peakMotorTorqueNm = 600;
  else if (has(/(econ|compact|hatch|civic|corolla)/)) peakMotorTorqueNm = 200;

  // Curb weight (kg)
  let curbWeightKg = 1600;
  if (has(/(truck|f-?150|silverado|ram|sierra|tundra|cybertruck|hummer)/)) curbWeightKg = 2500;
  else if (has(/(suv|tahoe|suburban|expedition|escalade|range rover|x7|gls)/)) curbWeightKg = 2400;
  else if (has(/(van|minivan|sprinter|transit)/)) curbWeightKg = 2100;
  else if (powertrain === "bev" && topSpeedKph >= 250) curbWeightKg = 2200;
  else if (powertrain === "bev") curbWeightKg = 1900;
  else if (has(/(econ|compact|hatch|civic|corolla|fit|yaris)/)) curbWeightKg = 1250;
  else if (topSpeedKph >= 320) curbWeightKg = 1500;
  else if (has(/(motorcycle|bike|hayabusa|ninja|panigale)/)) curbWeightKg = 220;

  // Cruise speed bias (km/h)
  const cruiseKph = Math.min(135, Math.max(95, Math.round(topSpeedKph * 0.45)));

  // HVAC idle current (amps on 12V or HV bus depending — kept as simple metric)
  const hvacIdleAmps = powertrain === "bev" ? 14 : 6;

  return {
    description: desc,
    powertrain,
    topSpeedKph,
    zeroTo100Sec,
    gearCount,
    packKwh,
    nominalPackVolts,
    peakMotorTorqueNm,
    curbWeightKg,
    cruiseKph,
    hvacIdleAmps,
    hasRegen: powertrain === "bev" || powertrain === "phev" || powertrain === "hybrid",
  };
};

// Backwards-compatible helper
const inferTopSpeedKph = (desc: string): number => buildVehicleProfile(desc).topSpeedKph;

// Generic, safe, fictional frame catalog
const buildFrames = (): FrameDef[] => [
  {
    id: 0x100,
    name: "VEH_Speed",
    dlc: 8,
    cycleMs: 20,
    signals: [
      { name: "VehicleSpeed", startBit: 0, length: 16, factor: 0.01, offset: 0, min: 0, max: 500, unit: "km/h" },
      { name: "AcceleratorPedal", startBit: 16, length: 8, factor: 0.4, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "BrakePressure", startBit: 24, length: 16, factor: 0.1, offset: 0, min: 0, max: 200, unit: "bar" },
      { name: "GearPosition", startBit: 40, length: 4, factor: 1, offset: 0, min: 0, max: 8, unit: "" },
      { name: "Counter_100", startBit: 48, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
      { name: "Checksum_100", startBit: 56, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (t, ctx) => {
      const d = ctx.duration;
      const r = ctx.rand;
      const v = ctx.vehicle;
      let speed = 0;
      let pedal = 0;
      let brake = 0;
      let gear = 1;
      // Vehicle-aware acceleration constants
      // tau60 ~ time constant fitted so 0->100 km/h matches v.zeroTo100Sec for an exponential approach to vMax.
      // For exponential v(t)=Vmax*(1-exp(-t/tau)): t100 = -tau*ln(1-100/Vmax)
      const vMax = Math.max(80, v.topSpeedKph);
      const fracToHundred = Math.min(0.95, 100 / vMax);
      const tau60 = Math.max(0.6, v.zeroTo100Sec / -Math.log(1 - fracToHundred));
      const gearTopIdx = Math.max(1, v.gearCount);
      switch (ctx.state) {
        case "launch_0_60": {
          // Accurate 0->100 km/h profile per spec, then ease off accelerator
          const accelPhase = Math.min(1, t / Math.max(0.5, v.zeroTo100Sec));
          speed = 100 * (1 - Math.exp(-3.0 * accelPhase));
          // small drift after hitting ~100
          if (t > v.zeroTo100Sec) {
            const extra = Math.min(20, (t - v.zeroTo100Sec) * 4);
            speed = Math.min(vMax, 100 + extra);
          }
          pedal = t < v.zeroTo100Sec ? 95 + (r() - 0.5) * 2 : 35 + (r() - 0.5) * 4;
          brake = 0;
          gear = Math.min(gearTopIdx, 1 + Math.floor((speed / 110) * Math.min(6, gearTopIdx)));
          break;
        }
        case "top_speed_run": {
          // Exponential approach to manufacturer-style top speed
          speed = vMax * (1 - Math.exp(-t / tau60));
          pedal = 100 - Math.max(0, (speed / vMax) * 4) + (r() - 0.5) * 0.6;
          brake = 0;
          gear = Math.min(gearTopIdx, 1 + Math.min(gearTopIdx - 1, Math.floor((speed / vMax) * gearTopIdx)));
          break;
        }
        case "idle_ac_on":
          speed = 0;
          pedal = 0;
          brake = 1 + (r() - 0.5) * 0.4;
          gear = 0;
          break;
        case "regen_braking": {
          if (!v.hasRegen) {
            // ICE coasts/brakes — use service brake harder, no negative torque
            const k = Math.min(1, t / d);
            speed = Math.max(0, 80 - k * 75);
            pedal = 0;
            brake = 18 + (r() - 0.5) * 2;
            gear = Math.max(2, Math.min(gearTopIdx, gearTopIdx - 2));
          } else {
            const k = Math.min(1, t / d);
            speed = Math.max(0, 80 - k * 75);
            pedal = 0;
            brake = 5 + (r() - 0.5);
            gear = Math.max(1, Math.min(gearTopIdx, Math.floor(gearTopIdx * 0.6)));
          }
          break;
        }
        case "highway_cruise":
          speed = v.cruiseKph + Math.sin(t * 0.4) * 1.2 + (r() - 0.5) * 0.6;
          pedal = 18 + Math.sin(t * 0.3) * 2 + (r() - 0.5);
          brake = 0;
          gear = gearTopIdx;
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
          gear = Math.min(gearTopIdx, speed > 25 ? 3 : speed > 10 ? 2 : 1);
          break;
        }
        default:
          speed = 40 + Math.sin(t * 0.5) * 10;
          pedal = 20;
          brake = 0;
          gear = Math.min(gearTopIdx, 3);
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
      { name: "WheelSpeed_FL", startBit: 0, length: 16, factor: 0.01, offset: 0, min: 0, max: 500, unit: "km/h" },
      { name: "WheelSpeed_FR", startBit: 16, length: 16, factor: 0.01, offset: 0, min: 0, max: 500, unit: "km/h" },
      { name: "WheelSpeed_RL", startBit: 32, length: 16, factor: 0.01, offset: 0, min: 0, max: 500, unit: "km/h" },
      { name: "WheelSpeed_RR", startBit: 48, length: 16, factor: 0.01, offset: 0, min: 0, max: 500, unit: "km/h" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      const v = ctx.vehicle;
      const vMax = Math.max(80, v.topSpeedKph);
      const fracToHundred = Math.min(0.95, 100 / vMax);
      const tau60 = Math.max(0.6, v.zeroTo100Sec / -Math.log(1 - fracToHundred));
      // mirror VEH_Speed
      const base =
        ctx.state === "idle_ac_on" || ctx.state === "charging_20_80"
          ? 0
          : ctx.state === "highway_cruise"
            ? v.cruiseKph
            : ctx.state === "launch_0_60"
              ? 100 * (1 - Math.exp(-3.0 * Math.min(1, t / Math.max(0.5, v.zeroTo100Sec)))) +
                (t > v.zeroTo100Sec ? Math.min(20, (t - v.zeroTo100Sec) * 4) : 0)
              : ctx.state === "top_speed_run"
                ? vMax * (1 - Math.exp(-t / tau60))
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
      const v = ctx.vehicle;
      const isEv = v.powertrain === "bev" || v.powertrain === "phev";
      const packV = isEv ? v.nominalPackVolts : 12.6;
      // Approx peak pack current scales with peak motor torque (very rough)
      const peakPackAmps = isEv ? Math.max(120, Math.min(1500, v.peakMotorTorqueNm * 1.4)) : 120;
      let soc = 70;
      let current = 0;
      let temp = 28;
      switch (ctx.state) {
        case "charging_20_80": {
          const k = Math.min(1, t / ctx.duration);
          soc = 20 + k * 60;
          // Higher-power packs (e.g. 800V hyperEVs) draw more current during DC fast charge
          current = isEv ? -Math.min(peakPackAmps * 0.6, 250) + (r() - 0.5) * 4 : -10;
          temp = 30 + k * 6;
          break;
        }
        case "launch_0_60":
          soc = 78 - (t / ctx.duration) * (isEv ? 0.4 : 0.05);
          current = isEv ? Math.min(peakPackAmps, 280 + v.peakMotorTorqueNm * 0.2) + (r() - 0.5) * 10 : 30;
          temp = 32 + (t / ctx.duration) * 3;
          break;
        case "top_speed_run":
          soc = 78 - (t / ctx.duration) * (isEv ? 1.5 : 0.1);
          current = isEv ? Math.min(peakPackAmps, peakPackAmps * 0.8) + (r() - 0.5) * 12 : 40;
          temp = 35 + (t / ctx.duration) * 8;
          break;
        case "regen_braking":
          soc = 65 + (t / ctx.duration) * (v.hasRegen ? 0.3 : 0.0);
          current = v.hasRegen ? -Math.min(peakPackAmps * 0.4, 100) + (r() - 0.5) * 6 : 5;
          temp = 30;
          break;
        case "highway_cruise":
          soc = 72 - (t / ctx.duration) * 0.6;
          current = isEv ? 60 + (r() - 0.5) * 4 : 18;
          temp = 32;
          break;
        case "idle_ac_on":
          soc = 80 - (t / ctx.duration) * 0.05;
          current = v.hvacIdleAmps + (r() - 0.5);
          temp = 29;
          break;
        case "city_stop_go":
          soc = 70 - (t / ctx.duration) * (isEv ? 0.4 : 0.08);
          current = isEv ? 30 + Math.sin(t) * 20 : 15 + Math.sin(t) * 5;
          temp = 31;
          break;
        default:
          soc = 70;
          current = isEv ? 20 : 12;
      }
      return {
        BatterySOC: soc,
        BatteryVoltage: packV + (r() - 0.5) * (isEv ? 2 : 0.2),
        BatteryCurrent: current,
        BatteryTemp: temp,
      };
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
      const v = ctx.vehicle;
      const peak = v.peakMotorTorqueNm;
      let req = 0;
      switch (ctx.state) {
        case "launch_0_60": {
          // Hold near peak through accel phase, then back off after ~100 km/h
          const inAccel = t <= v.zeroTo100Sec;
          req = inAccel ? peak * 0.95 + (r() - 0.5) * 6 : peak * 0.25 + (r() - 0.5) * 6;
          break;
        }
        case "top_speed_run": {
          // Strong torque at launch, tapering as drag dominates near Vmax
          const vMax = Math.max(80, v.topSpeedKph);
          const fracToHundred = Math.min(0.95, 100 / vMax);
          const tau60 = Math.max(0.6, v.zeroTo100Sec / -Math.log(1 - fracToHundred));
          const fracV = 1 - Math.exp(-t / tau60);
          req = peak * (1 - 0.55 * fracV) + (r() - 0.5) * 10;
          break;
        }
        case "regen_braking":
          req = v.hasRegen ? -Math.min(peak * 0.35, 250) + (r() - 0.5) * 8 : -10 + (r() - 0.5) * 4;
          break;
        case "highway_cruise":
          req = Math.min(peak * 0.15, 120) + Math.sin(t * 0.3) * 8 + (r() - 0.5) * 2;
          break;
        case "idle_ac_on":
          req = v.powertrain === "ice" || v.powertrain === "diesel" ? 8 + (r() - 0.5) : 0;
          break;
        case "charging_20_80":
          req = 0;
          break;
        case "city_stop_go":
          req = Math.min(peak * 0.25, 200) + Math.sin(t * 0.5) * 60 + (r() - 0.5) * 6;
          break;
        default:
          req = Math.min(peak * 0.1, 80);
      }
      // Clip to peak envelope
      req = Math.max(-peak, Math.min(peak, req));
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
  vehicle: VehicleProfile,
): { log: string; messageCount: number } => {
  // candump-style: (timestamp) can0 ID#DATA
  const lines: string[] = [];
  const ctx: ShapeCtx = { state, duration, rand, vehicle, topSpeedKph: vehicle.topSpeedKph };
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
  top_speed_run: "Top speed run (0 → Vmax)",
  custom: "Custom driving state",
};

const buildSummary = (
  req: SampleRequest,
  frames: FrameDef[],
  stats: SampleOutput["stats"],
  vehicle: VehicleProfile,
): string => {
  const sigCount = frames.reduce((n, f) => n + f.signals.length, 0);
  const ptLabel: Record<Powertrain, string> = {
    bev: "Battery Electric",
    phev: "Plug-in Hybrid",
    hybrid: "Hybrid",
    ice: "Internal Combustion",
    diesel: "Diesel",
  };
  const mph = (k: number) => Math.round(k * 0.621371);
  const lines = [
    `Synthetic Sample Summary`,
    `------------------------`,
    `Vehicle profile: ${req.vehicleDescription} (fictional, generic)`,
    `  Powertrain: ${ptLabel[vehicle.powertrain]}`,
    `  Inferred top speed: ${vehicle.topSpeedKph} km/h (~${mph(vehicle.topSpeedKph)} mph)`,
    `  Inferred 0–100 km/h: ${vehicle.zeroTo100Sec.toFixed(1)} s`,
    `  Gears: ${vehicle.gearCount}${vehicle.packKwh > 0 ? ` · Pack: ${vehicle.packKwh} kWh @ ~${vehicle.nominalPackVolts}V` : ""}`,
    `  Peak motor/engine torque: ${vehicle.peakMotorTorqueNm} Nm · Curb weight: ${vehicle.curbWeightKg} kg`,
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
      lines.push(
        `- Accelerates 0 → 100 km/h in ~${vehicle.zeroTo100Sec.toFixed(1)} s, peak torque near ${vehicle.peakMotorTorqueNm} Nm, gear progression up to ${Math.min(6, vehicle.gearCount)}.`,
      );
      break;
    case "top_speed_run":
      lines.push(
        `- Full launch from 0 → ~${vehicle.topSpeedKph} km/h (~${mph(vehicle.topSpeedKph)} mph), gear progression to top (${vehicle.gearCount}), torque tapers as drag dominates near Vmax.`,
      );
      break;
    case "idle_ac_on":
      lines.push("- Stationary speed/wheels, near-zero torque, light HVAC current draw, stable thermal signals.");
      break;
    case "regen_braking":
      if (vehicle.hasRegen) {
        lines.push("- Decelerating wheel speeds, negative TorqueRequest, slowly rising BatterySOC, low brake pressure.");
      } else {
        lines.push("- ICE coast-down with service braking (no regen) — decelerating wheels, near-zero torque, brake pressure rises.");
      }
      break;
    case "highway_cruise":
      lines.push(
        `- Stable speed near ${vehicle.cruiseKph} km/h (~${mph(vehicle.cruiseKph)} mph), small steering oscillations, gentle SOC decay, steady torque.`,
      );
      break;
    case "charging_20_80":
      if (vehicle.packKwh > 0) {
        lines.push(
          `- Stationary vehicle, DC fast charging on ~${vehicle.nominalPackVolts}V pack (${vehicle.packKwh} kWh), SOC ramps 20% → 80%, mild thermal rise.`,
        );
      } else {
        lines.push("- Stationary vehicle (no traction battery present); 12 V system stable.");
      }
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
  const vehicle = buildVehicleProfile(req.vehicleDescription);
  const dbc = buildDbc(frames, req.vehicleDescription);
  const { log, messageCount } = buildLog(frames, duration, rand, req.drivingState, vehicle);
  const stats = {
    messages: messageCount,
    uniqueIds: frames.length,
    durationSec: duration,
    avgRateHz: messageCount / duration,
  };
  const summary = buildSummary(req, frames, stats, topSpeedKph);
  return { dbc, log, summary, stats };
};

export const drivingStateOptions: Array<{ value: DrivingState; label: string }> = [
  { value: "launch_0_60", label: "0–60 launch" },
  { value: "top_speed_run", label: "Top speed run (0 → Vmax)" },
  { value: "idle_ac_on", label: "Idle with HVAC on" },
  { value: "regen_braking", label: "Regen braking" },
  { value: "highway_cruise", label: "Highway cruise (70 mph)" },
  { value: "charging_20_80", label: "DC charging 20% → 80%" },
  { value: "city_stop_go", label: "City stop-and-go" },
  { value: "custom", label: "Custom (describe below)" },
];
