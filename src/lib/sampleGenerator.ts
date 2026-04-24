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
  | "burnout"
  | "drag_pass"
  | "track_lap"
  | "custom";

export interface VehicleSpecOverride {
  powertrain?: Powertrain;
  topSpeedKph?: number;
  zeroTo100Sec?: number;
  sixtyTo130Sec?: number;
  redlineRpm?: number;
  idleRpm?: number;
  gearCount?: number;
  gearRatios?: number[];
  finalDrive?: number;
  packKwh?: number;
  nominalPackVolts?: number;
  peakPowerHp?: number;
  peakMotorTorqueNm?: number;
  curbWeightKg?: number;
  induction?: VehicleProfile["induction"];
  drivetrain?: VehicleProfile["drivetrain"];
  tireRadiusM?: number;
}

export interface SampleRequest {
  vehicleDescription: string;
  drivingState: DrivingState;
  customStateNotes?: string;
  durationSec: number;
  seed?: number;
  specOverride?: VehicleSpecOverride;
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
  sixtyTo130Sec: number; // 60->130 mph (roll-on power)
  redlineRpm: number;
  idleRpm: number;
  gearCount: number; // 1 for most BEVs, 5-10 for ICE
  // Final-drive ratio * gear ratio per gear (RPM per km/h ≈ ratio*1000/(60*tireCirc_m*3.6))
  // We store rpmPerKphByGear[gear-1] precomputed for realism.
  rpmPerKphByGear: number[];
  packKwh: number; // 0 for pure ICE
  nominalPackVolts: number; // ~400 typical, ~800 for high-perf EV
  peakPowerHp: number;
  peakMotorTorqueNm: number;
  curbWeightKg: number;
  cruiseKph: number; // typical highway cruise
  hvacIdleAmps: number;
  hasRegen: boolean;
  induction: "na" | "turbo" | "twin_turbo" | "supercharged" | "electric";
  drivetrain: "fwd" | "rwd" | "awd";
  tireRadiusM: number;
}

interface ShapeCtx {
  state: DrivingState;
  duration: number;
  rand: () => number;
  vehicle: VehicleProfile;
  // legacy alias kept for any older references
  topSpeedKph: number;
}

// ============================================================================
// Real-vehicle knowledge base (fictional CAN, but accurate performance specs).
// Each entry is matched against the user's free-text description.
// Specs are public-knowledge ballpark figures used purely to shape physics.
// ============================================================================
interface NamedSpec {
  match: RegExp;
  powertrain?: Powertrain;
  topSpeedKph?: number;
  zeroTo100Sec?: number;
  sixtyTo130Sec?: number;
  redlineRpm?: number;
  idleRpm?: number;
  gearCount?: number;
  finalDrive?: number;
  gearRatios?: number[]; // 1st..Nth
  packKwh?: number;
  nominalPackVolts?: number;
  peakPowerHp?: number;
  peakMotorTorqueNm?: number;
  curbWeightKg?: number;
  induction?: VehicleProfile["induction"];
  drivetrain?: VehicleProfile["drivetrain"];
  tireRadiusM?: number;
}

const NAMED_VEHICLES: NamedSpec[] = [
  // ====== Tesla / EV halo ======
  { match: /(model s plaid|plaid)/i, powertrain: "bev", topSpeedKph: 322, zeroTo100Sec: 2.1, sixtyTo130Sec: 4.5, redlineRpm: 20000, gearCount: 1, gearRatios: [9.0], peakPowerHp: 1020, peakMotorTorqueNm: 1420, packKwh: 100, nominalPackVolts: 400, curbWeightKg: 2162, induction: "electric", drivetrain: "awd", tireRadiusM: 0.353 },
  { match: /(model 3 performance|m3p)/i, powertrain: "bev", topSpeedKph: 261, zeroTo100Sec: 3.1, sixtyTo130Sec: 7.8, gearCount: 1, gearRatios: [9.0], peakPowerHp: 510, peakMotorTorqueNm: 660, packKwh: 82, nominalPackVolts: 400, curbWeightKg: 1844, induction: "electric", drivetrain: "awd", tireRadiusM: 0.342 },
  { match: /(taycan turbo s)/i, powertrain: "bev", topSpeedKph: 260, zeroTo100Sec: 2.6, sixtyTo130Sec: 6.2, gearCount: 2, gearRatios: [15.56, 8.05], peakPowerHp: 750, peakMotorTorqueNm: 1050, packKwh: 93, nominalPackVolts: 800, curbWeightKg: 2295, induction: "electric", drivetrain: "awd", tireRadiusM: 0.358 },
  { match: /(rivian r1[ts])/i, powertrain: "bev", topSpeedKph: 201, zeroTo100Sec: 3.0, sixtyTo130Sec: 8.5, gearCount: 1, gearRatios: [10.5], peakPowerHp: 835, peakMotorTorqueNm: 1231, packKwh: 135, nominalPackVolts: 400, curbWeightKg: 3060, induction: "electric", drivetrain: "awd", tireRadiusM: 0.402 },
  { match: /(lucid air sapphire|lucid.*sapphire)/i, powertrain: "bev", topSpeedKph: 330, zeroTo100Sec: 1.95, sixtyTo130Sec: 4.0, gearCount: 1, gearRatios: [9.5], peakPowerHp: 1234, peakMotorTorqueNm: 1700, packKwh: 118, nominalPackVolts: 924, curbWeightKg: 2380, induction: "electric", drivetrain: "awd", tireRadiusM: 0.358 },
  { match: /(cybertruck)/i, powertrain: "bev", topSpeedKph: 209, zeroTo100Sec: 2.6, gearCount: 1, gearRatios: [9.0], peakPowerHp: 845, peakMotorTorqueNm: 1420, packKwh: 123, nominalPackVolts: 400, curbWeightKg: 3104, induction: "electric", drivetrain: "awd", tireRadiusM: 0.418 },
  { match: /(f-?150 lightning|lightning)/i, powertrain: "bev", topSpeedKph: 180, zeroTo100Sec: 4.0, gearCount: 1, gearRatios: [9.5], peakPowerHp: 580, peakMotorTorqueNm: 1050, packKwh: 131, nominalPackVolts: 400, curbWeightKg: 2948, induction: "electric", drivetrain: "awd", tireRadiusM: 0.412 },

  // ====== Hypercars ======
  { match: /(bugatti chiron|chiron)/i, powertrain: "ice", topSpeedKph: 420, zeroTo100Sec: 2.4, sixtyTo130Sec: 3.5, redlineRpm: 6700, gearCount: 7, gearRatios: [3.46, 2.30, 1.71, 1.30, 1.00, 0.83, 0.69], finalDrive: 3.07, peakPowerHp: 1500, peakMotorTorqueNm: 1600, curbWeightKg: 1995, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.378 },
  { match: /(rimac nevera|nevera)/i, powertrain: "bev", topSpeedKph: 412, zeroTo100Sec: 1.85, sixtyTo130Sec: 3.0, gearCount: 2, gearRatios: [12.5, 6.5], peakPowerHp: 1914, peakMotorTorqueNm: 2360, packKwh: 120, nominalPackVolts: 800, curbWeightKg: 2150, induction: "electric", drivetrain: "awd", tireRadiusM: 0.358 },
  { match: /(koenig|jesko)/i, powertrain: "ice", topSpeedKph: 480, zeroTo100Sec: 2.5, redlineRpm: 8500, gearCount: 9, peakPowerHp: 1600, peakMotorTorqueNm: 1500, curbWeightKg: 1420, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.353 },

  // ====== Ferrari / Lambo / McLaren ======
  { match: /(sf90)/i, powertrain: "phev", topSpeedKph: 340, zeroTo100Sec: 2.5, redlineRpm: 8000, gearCount: 8, peakPowerHp: 986, peakMotorTorqueNm: 800, packKwh: 8, nominalPackVolts: 350, curbWeightKg: 1570, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(296 gtb|296)/i, powertrain: "phev", topSpeedKph: 330, zeroTo100Sec: 2.9, redlineRpm: 8500, gearCount: 8, peakPowerHp: 819, peakMotorTorqueNm: 740, packKwh: 7.45, nominalPackVolts: 350, curbWeightKg: 1470, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.342 },
  { match: /(f8 tributo|f8\b)/i, powertrain: "ice", topSpeedKph: 340, zeroTo100Sec: 2.9, redlineRpm: 8000, gearCount: 7, peakPowerHp: 710, peakMotorTorqueNm: 770, curbWeightKg: 1330, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.342 },
  { match: /(huracan)/i, powertrain: "ice", topSpeedKph: 325, zeroTo100Sec: 2.9, redlineRpm: 8500, gearCount: 7, peakPowerHp: 631, peakMotorTorqueNm: 600, curbWeightKg: 1422, induction: "na", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(aventador|revuelto)/i, powertrain: "ice", topSpeedKph: 350, zeroTo100Sec: 2.5, redlineRpm: 9500, gearCount: 8, peakPowerHp: 1001, peakMotorTorqueNm: 725, curbWeightKg: 1772, induction: "na", drivetrain: "awd", tireRadiusM: 0.358 },
  { match: /(720s|765lt)/i, powertrain: "ice", topSpeedKph: 341, zeroTo100Sec: 2.7, redlineRpm: 8500, gearCount: 7, peakPowerHp: 755, peakMotorTorqueNm: 800, curbWeightKg: 1339, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.342 },

  // ====== Porsche ======
  { match: /(911 turbo s)/i, powertrain: "ice", topSpeedKph: 330, zeroTo100Sec: 2.7, sixtyTo130Sec: 5.0, redlineRpm: 7200, gearCount: 8, gearRatios: [3.91, 2.29, 1.58, 1.19, 0.97, 0.83, 0.68, 0.57], finalDrive: 3.44, peakPowerHp: 640, peakMotorTorqueNm: 800, curbWeightKg: 1640, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.342 },
  { match: /(gt3 rs)/i, powertrain: "ice", topSpeedKph: 296, zeroTo100Sec: 3.2, redlineRpm: 9000, gearCount: 7, peakPowerHp: 518, peakMotorTorqueNm: 465, curbWeightKg: 1450, induction: "na", drivetrain: "rwd", tireRadiusM: 0.342 },
  { match: /(gt3\b)/i, powertrain: "ice", topSpeedKph: 318, zeroTo100Sec: 3.4, redlineRpm: 9000, gearCount: 7, peakPowerHp: 502, peakMotorTorqueNm: 470, curbWeightKg: 1418, induction: "na", drivetrain: "rwd", tireRadiusM: 0.342 },
  { match: /(911 turbo|992 turbo)/i, powertrain: "ice", topSpeedKph: 320, zeroTo100Sec: 2.8, redlineRpm: 7200, gearCount: 8, peakPowerHp: 572, peakMotorTorqueNm: 750, curbWeightKg: 1640, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.342 },
  { match: /(carrera s|carrera 4s|992)/i, powertrain: "ice", topSpeedKph: 308, zeroTo100Sec: 3.7, redlineRpm: 7500, gearCount: 8, peakPowerHp: 443, peakMotorTorqueNm: 530, curbWeightKg: 1515, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.342 },

  // ====== Corvette / GM ======
  { match: /(c8 z06|corvette z06|z06)/i, powertrain: "ice", topSpeedKph: 312, zeroTo100Sec: 2.6, sixtyTo130Sec: 5.5, redlineRpm: 8600, idleRpm: 800, gearCount: 8, gearRatios: [4.71, 3.13, 2.10, 1.67, 1.29, 1.00, 0.84, 0.67], finalDrive: 5.17, peakPowerHp: 670, peakMotorTorqueNm: 623, curbWeightKg: 1660, induction: "na", drivetrain: "rwd", tireRadiusM: 0.342 },
  { match: /(zr1x|c8 zr1x|corvette zr1x)/i, powertrain: "phev", topSpeedKph: 378, zeroTo100Sec: 2.0, redlineRpm: 8000, gearCount: 8, peakPowerHp: 1250, peakMotorTorqueNm: 1370, packKwh: 1.9, nominalPackVolts: 80, curbWeightKg: 1860, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.342 },
  { match: /(c8 zr1|zr1)/i, powertrain: "ice", topSpeedKph: 374, zeroTo100Sec: 2.3, redlineRpm: 8000, gearCount: 8, peakPowerHp: 1064, peakMotorTorqueNm: 1123, curbWeightKg: 1715, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.342 },
  { match: /(c8 e-?ray|e-?ray)/i, powertrain: "hybrid", topSpeedKph: 290, zeroTo100Sec: 2.5, redlineRpm: 6500, gearCount: 8, peakPowerHp: 655, peakMotorTorqueNm: 720, packKwh: 1.9, nominalPackVolts: 80, curbWeightKg: 1765, induction: "na", drivetrain: "awd", tireRadiusM: 0.342 },
  { match: /(c8|stingray|corvette)/i, powertrain: "ice", topSpeedKph: 312, zeroTo100Sec: 2.9, redlineRpm: 6500, gearCount: 8, peakPowerHp: 495, peakMotorTorqueNm: 637, curbWeightKg: 1530, induction: "na", drivetrain: "rwd", tireRadiusM: 0.342 },
  { match: /(camaro zl1)/i, powertrain: "ice", topSpeedKph: 320, zeroTo100Sec: 3.5, redlineRpm: 6600, gearCount: 10, peakPowerHp: 650, peakMotorTorqueNm: 881, curbWeightKg: 1882, induction: "supercharged", drivetrain: "rwd", tireRadiusM: 0.347 },
  { match: /(cts-?v|cadillac.*blackwing|ct5-?v blackwing)/i, powertrain: "ice", topSpeedKph: 322, zeroTo100Sec: 3.4, redlineRpm: 6500, gearCount: 10, peakPowerHp: 668, peakMotorTorqueNm: 893, curbWeightKg: 1976, induction: "supercharged", drivetrain: "rwd", tireRadiusM: 0.347 },

  // ====== Mopar ======
  { match: /(demon 170|demon)/i, powertrain: "ice", topSpeedKph: 346, zeroTo100Sec: 1.66, redlineRpm: 6500, gearCount: 8, peakPowerHp: 1025, peakMotorTorqueNm: 1281, curbWeightKg: 1995, induction: "supercharged", drivetrain: "rwd", tireRadiusM: 0.358 },
  { match: /(hellcat redeye|redeye)/i, powertrain: "ice", topSpeedKph: 327, zeroTo100Sec: 3.4, redlineRpm: 6300, gearCount: 8, peakPowerHp: 797, peakMotorTorqueNm: 959, curbWeightKg: 2018, induction: "supercharged", drivetrain: "rwd", tireRadiusM: 0.358 },
  { match: /(hellcat|charger srt|challenger srt)/i, powertrain: "ice", topSpeedKph: 322, zeroTo100Sec: 3.6, redlineRpm: 6200, gearCount: 8, peakPowerHp: 717, peakMotorTorqueNm: 881, curbWeightKg: 2018, induction: "supercharged", drivetrain: "rwd", tireRadiusM: 0.358 },
  { match: /(trackhawk|grand cherokee srt)/i, powertrain: "ice", topSpeedKph: 290, zeroTo100Sec: 3.5, redlineRpm: 6200, gearCount: 8, peakPowerHp: 707, peakMotorTorqueNm: 875, curbWeightKg: 2433, induction: "supercharged", drivetrain: "awd", tireRadiusM: 0.379 },

  // ====== Ford ======
  { match: /(gt500|shelby gt500|mustang gt500)/i, powertrain: "ice", topSpeedKph: 290, zeroTo100Sec: 3.3, sixtyTo130Sec: 5.4, redlineRpm: 7500, gearCount: 7, peakPowerHp: 760, peakMotorTorqueNm: 847, curbWeightKg: 1875, induction: "supercharged", drivetrain: "rwd", tireRadiusM: 0.353 },
  { match: /(gt350|shelby gt350)/i, powertrain: "ice", topSpeedKph: 290, zeroTo100Sec: 4.0, redlineRpm: 8250, gearCount: 6, peakPowerHp: 526, peakMotorTorqueNm: 582, curbWeightKg: 1707, induction: "na", drivetrain: "rwd", tireRadiusM: 0.347 },
  { match: /(mustang dark horse|dark horse)/i, powertrain: "ice", topSpeedKph: 267, zeroTo100Sec: 4.1, redlineRpm: 7500, gearCount: 10, peakPowerHp: 500, peakMotorTorqueNm: 566, curbWeightKg: 1796, induction: "na", drivetrain: "rwd", tireRadiusM: 0.347 },
  { match: /(mustang gt|s650|s550 gt)/i, powertrain: "ice", topSpeedKph: 250, zeroTo100Sec: 4.3, redlineRpm: 7500, gearCount: 10, peakPowerHp: 480, peakMotorTorqueNm: 563, curbWeightKg: 1727, induction: "na", drivetrain: "rwd", tireRadiusM: 0.347 },
  { match: /(ford gt\b|2017 ford gt)/i, powertrain: "ice", topSpeedKph: 348, zeroTo100Sec: 2.8, redlineRpm: 7250, gearCount: 7, peakPowerHp: 660, peakMotorTorqueNm: 746, curbWeightKg: 1385, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.347 },
  { match: /(raptor r)/i, powertrain: "ice", topSpeedKph: 290, zeroTo100Sec: 3.6, redlineRpm: 7000, gearCount: 10, peakPowerHp: 720, peakMotorTorqueNm: 868, curbWeightKg: 2735, induction: "supercharged", drivetrain: "awd", tireRadiusM: 0.422 },
  { match: /(raptor|f-?150 raptor)/i, powertrain: "ice", topSpeedKph: 250, zeroTo100Sec: 5.1, redlineRpm: 6000, gearCount: 10, peakPowerHp: 450, peakMotorTorqueNm: 691, curbWeightKg: 2667, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.422 },
  { match: /(f-?150)/i, powertrain: "ice", topSpeedKph: 175, zeroTo100Sec: 6.0, redlineRpm: 6000, gearCount: 10, peakPowerHp: 400, peakMotorTorqueNm: 678, curbWeightKg: 2200, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.402 },

  // ====== BMW ======
  { match: /(m5 cs)/i, powertrain: "ice", topSpeedKph: 305, zeroTo100Sec: 2.9, sixtyTo130Sec: 5.6, redlineRpm: 7200, gearCount: 8, peakPowerHp: 627, peakMotorTorqueNm: 750, curbWeightKg: 1825, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(m5\b)/i, powertrain: "ice", topSpeedKph: 305, zeroTo100Sec: 3.1, redlineRpm: 7200, gearCount: 8, peakPowerHp: 600, peakMotorTorqueNm: 750, curbWeightKg: 1885, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(m4 cs|m3 cs)/i, powertrain: "ice", topSpeedKph: 302, zeroTo100Sec: 3.2, redlineRpm: 7200, gearCount: 8, peakPowerHp: 543, peakMotorTorqueNm: 650, curbWeightKg: 1745, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(m3 comp|m4 comp|m3\b|m4\b)/i, powertrain: "ice", topSpeedKph: 290, zeroTo100Sec: 3.5, redlineRpm: 7200, gearCount: 8, peakPowerHp: 503, peakMotorTorqueNm: 650, curbWeightKg: 1730, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(m2\b)/i, powertrain: "ice", topSpeedKph: 285, zeroTo100Sec: 4.0, redlineRpm: 7200, gearCount: 8, peakPowerHp: 453, peakMotorTorqueNm: 550, curbWeightKg: 1700, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.342 },

  // ====== Mercedes-AMG ======
  { match: /(amg gt black|gt black series)/i, powertrain: "ice", topSpeedKph: 325, zeroTo100Sec: 3.1, redlineRpm: 7200, gearCount: 7, peakPowerHp: 720, peakMotorTorqueNm: 800, curbWeightKg: 1670, induction: "twin_turbo", drivetrain: "rwd", tireRadiusM: 0.347 },
  { match: /(amg gt 63|gt63)/i, powertrain: "ice", topSpeedKph: 315, zeroTo100Sec: 3.0, redlineRpm: 7000, gearCount: 9, peakPowerHp: 630, peakMotorTorqueNm: 900, curbWeightKg: 2070, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(e63 s|c63 s|s63)/i, powertrain: "ice", topSpeedKph: 290, zeroTo100Sec: 3.4, redlineRpm: 7000, gearCount: 9, peakPowerHp: 603, peakMotorTorqueNm: 850, curbWeightKg: 1995, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },

  // ====== Audi RS ======
  { match: /(rs6|rs7)/i, powertrain: "ice", topSpeedKph: 305, zeroTo100Sec: 3.4, redlineRpm: 6800, gearCount: 8, peakPowerHp: 621, peakMotorTorqueNm: 850, curbWeightKg: 2150, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(rs[ -]?e-?tron gt)/i, powertrain: "bev", topSpeedKph: 250, zeroTo100Sec: 3.3, gearCount: 2, gearRatios: [15.56, 8.05], peakPowerHp: 637, peakMotorTorqueNm: 830, packKwh: 93, nominalPackVolts: 800, curbWeightKg: 2347, induction: "electric", drivetrain: "awd", tireRadiusM: 0.353 },
  { match: /(rs3)/i, powertrain: "ice", topSpeedKph: 290, zeroTo100Sec: 3.6, redlineRpm: 7000, gearCount: 7, peakPowerHp: 401, peakMotorTorqueNm: 500, curbWeightKg: 1570, induction: "turbo", drivetrain: "awd", tireRadiusM: 0.337 },

  // ====== Toyota / Honda / Subaru ======
  { match: /(gr supra|supra)/i, powertrain: "ice", topSpeedKph: 250, zeroTo100Sec: 3.9, redlineRpm: 7000, gearCount: 8, peakPowerHp: 382, peakMotorTorqueNm: 500, curbWeightKg: 1542, induction: "turbo", drivetrain: "rwd", tireRadiusM: 0.347 },
  { match: /(gr corolla|gr yaris)/i, powertrain: "ice", topSpeedKph: 230, zeroTo100Sec: 4.9, redlineRpm: 7000, gearCount: 6, peakPowerHp: 300, peakMotorTorqueNm: 370, curbWeightKg: 1474, induction: "turbo", drivetrain: "awd", tireRadiusM: 0.327 },
  { match: /(civic type r|type r)/i, powertrain: "ice", topSpeedKph: 275, zeroTo100Sec: 5.4, redlineRpm: 7000, gearCount: 6, peakPowerHp: 315, peakMotorTorqueNm: 420, curbWeightKg: 1429, induction: "turbo", drivetrain: "fwd", tireRadiusM: 0.337 },
  { match: /(sti|wrx sti)/i, powertrain: "ice", topSpeedKph: 255, zeroTo100Sec: 4.9, redlineRpm: 6700, gearCount: 6, peakPowerHp: 310, peakMotorTorqueNm: 393, curbWeightKg: 1568, induction: "turbo", drivetrain: "awd", tireRadiusM: 0.327 },
  { match: /\b(wrx|impreza wrx|subaru wrx)\b/i, powertrain: "ice", topSpeedKph: 240, zeroTo100Sec: 5.4, redlineRpm: 6500, gearCount: 6, peakPowerHp: 271, peakMotorTorqueNm: 350, curbWeightKg: 1565, induction: "turbo", drivetrain: "awd", tireRadiusM: 0.327 },
  { match: /(gtr|nissan gt-?r|r35)/i, powertrain: "ice", topSpeedKph: 315, zeroTo100Sec: 2.9, redlineRpm: 7100, gearCount: 6, peakPowerHp: 565, peakMotorTorqueNm: 633, curbWeightKg: 1755, induction: "twin_turbo", drivetrain: "awd", tireRadiusM: 0.347 },
  { match: /(civic\b|corolla\b)/i, powertrain: "ice", topSpeedKph: 200, zeroTo100Sec: 8.5, redlineRpm: 6800, gearCount: 6, peakPowerHp: 158, peakMotorTorqueNm: 187, curbWeightKg: 1300, induction: "na", drivetrain: "fwd", tireRadiusM: 0.317 },

  // ====== Diesel trucks ======
  { match: /(cummins|ram 2500|ram 3500)/i, powertrain: "diesel", topSpeedKph: 175, zeroTo100Sec: 7.5, redlineRpm: 4500, idleRpm: 700, gearCount: 8, peakPowerHp: 420, peakMotorTorqueNm: 1356, curbWeightKg: 3500, induction: "turbo", drivetrain: "awd", tireRadiusM: 0.422 },
  { match: /(duramax|silverado hd|sierra hd)/i, powertrain: "diesel", topSpeedKph: 180, zeroTo100Sec: 7.5, redlineRpm: 4500, gearCount: 10, peakPowerHp: 470, peakMotorTorqueNm: 1234, curbWeightKg: 3500, induction: "turbo", drivetrain: "awd", tireRadiusM: 0.422 },
  { match: /(powerstroke|f-?250|f-?350|super duty)/i, powertrain: "diesel", topSpeedKph: 175, zeroTo100Sec: 7.5, redlineRpm: 4500, gearCount: 10, peakPowerHp: 500, peakMotorTorqueNm: 1424, curbWeightKg: 3500, induction: "turbo", drivetrain: "awd", tireRadiusM: 0.422 },

  // ====== Hybrids ======
  { match: /(prius)/i, powertrain: "hybrid", topSpeedKph: 180, zeroTo100Sec: 7.0, redlineRpm: 5200, gearCount: 1, gearRatios: [1], peakPowerHp: 196, peakMotorTorqueNm: 188, packKwh: 1.3, nominalPackVolts: 207, curbWeightKg: 1485, induction: "na", drivetrain: "fwd", tireRadiusM: 0.327 },
];

const matchNamedSpec = (desc: string): NamedSpec | null => {
  for (const spec of NAMED_VEHICLES) {
    if (spec.match.test(desc)) return spec;
  }
  return null;
};

// Compute rpm-per-kph for each gear from gear ratios + final drive + tire radius.
// Wheel rpm = speed_mps / (2π·r) · 60 ; engine rpm = wheel_rpm · ratio · finalDrive
const computeRpmPerKphTable = (
  gearRatios: number[] | undefined,
  finalDrive: number | undefined,
  tireRadiusM: number,
  fallbackGearCount: number,
  redlineRpm: number,
  topSpeedKph: number,
): number[] => {
  const r = tireRadiusM;
  const fd = finalDrive ?? 3.5;
  if (gearRatios && gearRatios.length > 0) {
    return gearRatios.map((gr) => {
      const wheelRpmPerKph = (1000 / 3600) / (2 * Math.PI * r) * 60;
      return wheelRpmPerKph * gr * fd;
    });
  }
  // Synthesize a plausible ratio set: top gear sized so redline ≈ topSpeed
  const wheelRpmPerKph = (1000 / 3600) / (2 * Math.PI * r) * 60;
  const topGearEffective = (redlineRpm * 0.92) / Math.max(80, topSpeedKph) / wheelRpmPerKph;
  const ratios: number[] = [];
  const n = Math.max(1, fallbackGearCount);
  // Geometric progression from ~3.5x top to top
  const first = topGearEffective * Math.min(8, n) * 0.9;
  for (let i = 0; i < n; i++) {
    const frac = n === 1 ? 1 : i / (n - 1);
    const ratio = first * Math.pow(topGearEffective / Math.max(0.001, first), frac);
    ratios.push(wheelRpmPerKph * ratio);
  }
  return ratios;
};

// Build a fictional-but-plausible profile from the user's description.
const buildVehicleProfile = (desc: string, override?: VehicleSpecOverride): VehicleProfile => {
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
  let cruiseKph = Math.min(135, Math.max(95, Math.round(topSpeedKph * 0.45)));

  // HVAC idle current (amps on 12V or HV bus depending — kept as simple metric)
  const hvacIdleAmps = powertrain === "bev" ? 14 : 6;

  // Heuristic defaults for new fields
  let redlineRpm = topSpeedKph >= 320 ? 8500 : topSpeedKph >= 280 ? 8000 : topSpeedKph >= 240 ? 7200 : 6500;
  if (powertrain === "diesel") redlineRpm = 4500;
  if (powertrain === "bev") redlineRpm = 18000;
  let idleRpm = powertrain === "diesel" ? 700 : 800;
  let peakPowerHp = Math.round(peakMotorTorqueNm * 0.6);
  let induction: VehicleProfile["induction"] = powertrain === "bev" ? "electric" : has(/(turbo|tt|biturbo)/) ? "turbo" : has(/(supercharg|whipple|kompressor)/) ? "supercharged" : "na";
  let drivetrain: VehicleProfile["drivetrain"] = has(/\bawd\b|quattro|4matic|x-?drive|sh-?awd|all[- ]wheel/) ? "awd" : has(/\bfwd\b|front[- ]wheel/) ? "fwd" : "rwd";
  let tireRadiusM = has(/(truck|f-?150|silverado|ram|tundra|raptor|cybertruck)/) ? 0.412 : has(/(suv|escalade|tahoe|range rover)/) ? 0.382 : has(/(econ|civic|corolla|fit|yaris)/) ? 0.317 : 0.342;
  let sixtyTo130Sec = Math.max(2.5, zeroTo100Sec * 2.6);
  let gearRatios: number[] | undefined;
  let finalDrive: number | undefined;

  // Apply named-vehicle override (real-world specs)
  const named = matchNamedSpec(desc);
  if (named) {
    if (named.powertrain) powertrain = named.powertrain;
    if (named.topSpeedKph) topSpeedKph = named.topSpeedKph;
    if (named.zeroTo100Sec) zeroTo100Sec = named.zeroTo100Sec;
    if (named.sixtyTo130Sec) sixtyTo130Sec = named.sixtyTo130Sec;
    if (named.redlineRpm) redlineRpm = named.redlineRpm;
    if (named.idleRpm) idleRpm = named.idleRpm;
    if (named.gearCount) gearCount = named.gearCount;
    if (named.gearRatios) gearRatios = named.gearRatios;
    if (named.finalDrive) finalDrive = named.finalDrive;
    if (named.packKwh !== undefined) packKwh = named.packKwh;
    if (named.nominalPackVolts) nominalPackVolts = named.nominalPackVolts;
    if (named.peakPowerHp) peakPowerHp = named.peakPowerHp;
    if (named.peakMotorTorqueNm) peakMotorTorqueNm = named.peakMotorTorqueNm;
    if (named.curbWeightKg) curbWeightKg = named.curbWeightKg;
    if (named.induction) induction = named.induction;
    if (named.drivetrain) drivetrain = named.drivetrain;
    if (named.tireRadiusM) tireRadiusM = named.tireRadiusM;
    cruiseKph = Math.min(135, Math.max(95, Math.round(topSpeedKph * 0.45)));
  }

  // Apply AI-derived / caller override (highest priority)
  if (override) {
    if (override.powertrain) powertrain = override.powertrain;
    if (override.topSpeedKph) topSpeedKph = override.topSpeedKph;
    if (override.zeroTo100Sec) zeroTo100Sec = override.zeroTo100Sec;
    if (override.sixtyTo130Sec) sixtyTo130Sec = override.sixtyTo130Sec;
    if (override.redlineRpm) redlineRpm = override.redlineRpm;
    if (override.idleRpm) idleRpm = override.idleRpm;
    if (override.gearCount) gearCount = override.gearCount;
    if (override.gearRatios && override.gearRatios.length) gearRatios = override.gearRatios;
    if (override.finalDrive) finalDrive = override.finalDrive;
    if (override.packKwh !== undefined) packKwh = override.packKwh;
    if (override.nominalPackVolts) nominalPackVolts = override.nominalPackVolts;
    if (override.peakPowerHp) peakPowerHp = override.peakPowerHp;
    if (override.peakMotorTorqueNm) peakMotorTorqueNm = override.peakMotorTorqueNm;
    if (override.curbWeightKg) curbWeightKg = override.curbWeightKg;
    if (override.induction) induction = override.induction;
    if (override.drivetrain) drivetrain = override.drivetrain;
    if (override.tireRadiusM) tireRadiusM = override.tireRadiusM;
    cruiseKph = Math.min(135, Math.max(95, Math.round(topSpeedKph * 0.45)));
  }

  const rpmPerKphByGear = computeRpmPerKphTable(gearRatios, finalDrive, tireRadiusM, gearCount, redlineRpm, topSpeedKph);

  return {
    description: desc,
    powertrain,
    topSpeedKph,
    zeroTo100Sec,
    sixtyTo130Sec,
    redlineRpm,
    idleRpm,
    gearCount,
    rpmPerKphByGear,
    packKwh,
    nominalPackVolts,
    peakPowerHp,
    peakMotorTorqueNm,
    curbWeightKg,
    cruiseKph,
    hvacIdleAmps,
    hasRegen: powertrain === "bev" || powertrain === "phev" || powertrain === "hybrid",
    induction,
    drivetrain,
    tireRadiusM,
  };
};

// Pick the best gear given current speed: highest gear whose RPM is still above idle*1.4
// and below redline*0.95.
const selectGear = (v: VehicleProfile, speedKph: number): { gear: number; rpm: number } => {
  if (v.rpmPerKphByGear.length <= 1) {
    const rpm = Math.max(v.idleRpm, v.rpmPerKphByGear[0] * speedKph);
    return { gear: 1, rpm: Math.min(v.redlineRpm, rpm) };
  }
  for (let g = v.rpmPerKphByGear.length; g >= 1; g--) {
    const rpm = v.rpmPerKphByGear[g - 1] * speedKph;
    if (rpm <= v.redlineRpm * 0.95 && (g === 1 || rpm >= v.idleRpm * 1.6)) {
      return { gear: g, rpm: Math.max(v.idleRpm, rpm) };
    }
  }
  return { gear: 1, rpm: Math.max(v.idleRpm, v.rpmPerKphByGear[0] * speedKph) };
};

// ============================================================================
// Realism helpers — shift events, slip, thermal integrator, quantization, drag
// ============================================================================

// Deterministic small noise from rand (gaussian-ish via two uniforms)
const gauss = (rand: () => number, sigma = 1) => (rand() + rand() + rand() - 1.5) * 2 * sigma;

// Quantize value to ADC step — simulates real sensor resolution.
const quantize = (value: number, step: number) => Math.round(value / step) * step;

// Smooth sub-Hz wobble (used for traction control / ABS-like modulation).
const wobble = (t: number, hz: number, amp: number) => Math.sin(t * hz * 2 * Math.PI) * amp;

// Computes shift event blend for a given speed sweep.
// Returns 0..1 where 1 = mid-shift (torque cut, RPM dipping). 50ms shift events at gear boundaries.
interface ShiftInfo {
  gear: number;
  rpm: number;
  shiftBlend: number; // 0..1 — how "mid-shift" we are
  inShift: boolean;
}
const computeShiftEvent = (
  v: VehicleProfile,
  speedKph: number,
  prevSpeedKph: number,
): ShiftInfo => {
  const sel = selectGear(v, speedKph);
  const prev = selectGear(v, prevSpeedKph);
  if (sel.gear !== prev.gear && sel.gear > prev.gear) {
    // Right at a shift boundary — emit a brief blend
    return { gear: sel.gear, rpm: sel.rpm, shiftBlend: 1, inShift: true };
  }
  // Detect proximity to redline in lower gear (about-to-shift)
  const upper = v.rpmPerKphByGear[sel.gear - 1] * speedKph;
  if (upper > v.redlineRpm * 0.92 && sel.gear < v.rpmPerKphByGear.length) {
    return { gear: sel.gear, rpm: upper, shiftBlend: 0.4, inShift: false };
  }
  return { gear: sel.gear, rpm: sel.rpm, shiftBlend: 0, inShift: false };
};

// Aerodynamic-drag-aware speed: limits acceleration as v approaches Vmax with a
// drag exponent steeper than the simple time constant.
const dragLimitedSpeed = (vMax: number, t: number, tau: number): number => {
  // Two-stage: traction-limited early, drag-limited late.
  const linear = vMax * (1 - Math.exp(-t / tau));
  // Apply quadratic drag squeeze near top
  const frac = linear / vMax;
  const dragSqueeze = 1 - 0.18 * Math.pow(frac, 3);
  return linear * dragSqueeze;
};

// Per-vehicle thermal integrator (cumulative heat, decays slowly when off-throttle).
// We don't have stateful instances so we approximate with closed-form integration of
// throttle/load over t — enough realism for short logs.
const thermalIntegral = (
  loadFactor: number, // 0..1 instantaneous load
  t: number,
  capacityScale: number, // larger = slower rise
): number => {
  // 1st-order: T(t) = T_steady * (1 - exp(-t / tau))
  const tau = capacityScale * (1.2 - loadFactor * 0.6);
  return loadFactor * (1 - Math.exp(-Math.max(0, t) / Math.max(0.1, tau)));
};

// Traction-limited launch slip: returns extra km/h on the driven axle
// during the first portion of acceleration. Scales with torque/weight ratio.
const launchSlipKph = (v: VehicleProfile, t: number, scenarioPeak: number): number => {
  const twr = v.peakMotorTorqueNm / Math.max(800, v.curbWeightKg);
  const slipWindow = Math.max(0.6, v.zeroTo100Sec * 0.5);
  if (t > slipWindow) return 0;
  const decay = 1 - t / slipWindow;
  // Traction-control oscillation at ~12 Hz during launch
  const tcWobble = (1 + Math.sin(t * 12 * 2 * Math.PI) * 0.5);
  return scenarioPeak * decay * twr * tcWobble * 6;
};



// Backwards-compatible helper
const inferTopSpeedKph = (desc: string): number => buildVehicleProfile(desc).topSpeedKph;

// ICE-specific frames: engine, fuel, thermals
const buildIceFrames = (): FrameDef[] => [
  {
    id: 0x0C0,
    name: "ENG_Status",
    dlc: 8,
    cycleMs: 20,
    signals: [
      { name: "EngineRPM", startBit: 0, length: 16, factor: 1, offset: 0, min: 0, max: 12000, unit: "rpm" },
      { name: "ThrottlePosition", startBit: 16, length: 8, factor: 0.4, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "EngineLoad", startBit: 24, length: 8, factor: 0.4, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "IgnitionAdvance", startBit: 32, length: 8, factor: 0.5, offset: -64, min: -64, max: 64, unit: "deg" },
      { name: "Counter_C0", startBit: 48, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
      { name: "Checksum_C0", startBit: 56, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      const v = ctx.vehicle;
      const idleRpm = v.idleRpm;
      const redline = v.redlineRpm;
      const gearTopIdx = Math.max(1, v.gearCount);
      let rpm = idleRpm;
      let throttle = 0;
      let load = 8;
      switch (ctx.state) {
        case "launch_0_60": {
          // Use real gear-ratio-based RPM mapping
          const accelPhase = Math.min(1, t / Math.max(0.5, v.zeroTo100Sec));
          const speed = 100 * (1 - Math.exp(-3.0 * accelPhase));
          const sel = selectGear(v, speed);
          rpm = Math.min(redline, sel.rpm + Math.sin(t * 8) * 60);
          throttle = t <= v.zeroTo100Sec ? 95 + (r() - 0.5) * 2 : 30;
          load = t <= v.zeroTo100Sec ? 92 : 35;
          break;
        }
        case "drag_pass": {
          // Quarter mile: full launch, hard shifts, RPM sawtooth between redline and ~70%
          const accelPhase = Math.min(1, t / Math.max(0.5, v.zeroTo100Sec * 2.4));
          const speed = (v.topSpeedKph * 0.6) * (1 - Math.exp(-2.6 * accelPhase));
          const sel = selectGear(v, speed);
          rpm = Math.min(redline, sel.rpm + Math.sin(t * 12) * 80);
          throttle = 100;
          load = 98;
          break;
        }
        case "burnout": {
          // Stationary wheels-spinning: very high RPM cycling, throttle stabbing
          const swing = (Math.sin(t * 3) + 1) / 2; // 0..1
          rpm = idleRpm + swing * (redline - idleRpm) * 0.85 + (r() - 0.5) * 200;
          throttle = 60 + swing * 35;
          load = 70 + swing * 25;
          break;
        }
        case "track_lap": {
          // Lap pattern: ~25s lap, accelerate / brake / corner repeatedly
          const lap = (t % 25) / 25;
          const targetSpeed = lap < 0.4 ? lap * 2.5 * (v.topSpeedKph * 0.85)
            : lap < 0.55 ? v.topSpeedKph * 0.85 - (lap - 0.4) * 6 * (v.topSpeedKph * 0.5)
            : lap < 0.85 ? 80 + Math.sin(lap * 12) * 30
            : (1 - lap) * 6 * (v.topSpeedKph * 0.5);
          const sel = selectGear(v, Math.max(20, targetSpeed));
          rpm = Math.min(redline, sel.rpm + Math.sin(t * 9) * 100);
          throttle = lap < 0.4 ? 95 : lap < 0.55 ? 5 : 60 + Math.sin(lap * 8) * 30;
          load = lap < 0.4 ? 95 : lap < 0.55 ? 8 : 60;
          break;
        }
        case "top_speed_run": {
          const vMax = Math.max(80, v.topSpeedKph);
          const fracToHundred = Math.min(0.95, 100 / vMax);
          const tau60 = Math.max(0.6, v.zeroTo100Sec / -Math.log(1 - fracToHundred));
          const fracV = 1 - Math.exp(-t / tau60);
          const speed = vMax * fracV;
          const sel = selectGear(v, speed);
          // Use real per-gear RPM with shift-induced sawtooth
          rpm = Math.min(redline, sel.rpm + Math.sin(t * 4) * 120);
          throttle = 100 - fracV * 3;
          load = 95;
          break;
        }
        case "idle_ac_on":
          rpm = idleRpm + Math.sin(t * 2) * 25 + (r() - 0.5) * 15;
          throttle = 0;
          load = 12;
          break;
        case "regen_braking":
          rpm = idleRpm + 800 - (t / ctx.duration) * 600;
          throttle = 0;
          load = 5;
          break;
        case "highway_cruise": {
          const sel = selectGear(v, v.cruiseKph);
          rpm = sel.rpm + Math.sin(t * 0.3) * 60 + (r() - 0.5) * 20;
          throttle = 18 + Math.sin(t * 0.3) * 2;
          load = 32;
          break;
        }
        case "charging_20_80": // ICE doesn't charge — engine off
          rpm = 0;
          throttle = 0;
          load = 0;
          break;
        case "city_stop_go": {
          const phase = (t % 30) / 30;
          rpm = phase < 0.4 ? idleRpm + phase * 6000 : phase < 0.7 ? 2400 : idleRpm + 200;
          throttle = phase < 0.4 ? 50 : phase < 0.7 ? 18 : 0;
          load = phase < 0.4 ? 70 : 25;
          break;
        }
        default:
          rpm = 2200;
          throttle = 22;
          load = 30;
      }
      // Realism: shift dip + ignition retard under load + jitter + quantization
      // Estimate "is in shift" by detecting near-redline crossings via deterministic sin pulse
      const shiftPulse = Math.max(0, Math.sin(t * 4.0 + Math.PI / 2)) > 0.985 ? 1 : 0;
      const shiftDip = shiftPulse * (rpm * 0.32); // brief 32% RPM drop
      const rpmFinal = Math.max(0, Math.min(redline + 50, rpm - shiftDip + gauss(r, 1.2)));
      const loadClamped = Math.max(0, Math.min(100, load + gauss(r, 0.4)));
      // Ignition advance: drops under heavy load (knock retard), rises at light load
      const baseAdvance = 24 - (loadClamped / 100) * 22; // 24° at idle → ~2° at WOT
      const advance = baseAdvance + gauss(r, 0.5);
      const throttleJ = Math.max(0, Math.min(100, throttle + gauss(r, 0.3)));
      return {
        EngineRPM: quantize(rpmFinal, 4), // ECU typically reports in ~4 rpm steps
        ThrottlePosition: quantize(throttleJ, 0.4),
        EngineLoad: quantize(loadClamped, 0.4),
        IgnitionAdvance: quantize(advance, 0.5),
      };
    },
  },
  {
    id: 0x0C8,
    name: "ENG_Fuel",
    dlc: 8,
    cycleMs: 100,
    signals: [
      { name: "FuelRate", startBit: 0, length: 16, factor: 0.05, offset: 0, min: 0, max: 100, unit: "L/h" },
      { name: "FuelLevel", startBit: 16, length: 8, factor: 0.4, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "AFR_Lambda", startBit: 24, length: 16, factor: 0.001, offset: 0, min: 0.5, max: 1.5, unit: "" },
      { name: "MAF", startBit: 40, length: 16, factor: 0.05, offset: 0, min: 0, max: 600, unit: "g/s" },
    ],
    shape: (t, ctx) => {
      const v = ctx.vehicle;
      const r = ctx.rand;
      let rate = 1.5;
      let lambda = 1.0;
      let maf = 4;
      switch (ctx.state) {
        case "launch_0_60":
        case "top_speed_run":
          rate = 35 + (v.peakMotorTorqueNm / 100);
          lambda = 0.86 + (r() - 0.5) * 0.02;
          maf = 220 + Math.sin(t * 2) * 20;
          break;
        case "highway_cruise":
          rate = 8 + Math.sin(t * 0.3);
          lambda = 1.0;
          maf = 25 + Math.sin(t * 0.3) * 2;
          break;
        case "idle_ac_on":
          rate = 1.4;
          lambda = 1.0;
          maf = 3.5;
          break;
        case "regen_braking":
          rate = 0.6;
          lambda = 1.05;
          maf = 1.5;
          break;
        case "charging_20_80":
          rate = 0;
          lambda = 1.0;
          maf = 0;
          break;
        case "city_stop_go":
          rate = 5 + Math.sin(t * 0.5) * 3;
          lambda = 1.0;
          maf = 12 + Math.sin(t * 0.5) * 6;
          break;
      }
      return {
        FuelRate: rate,
        FuelLevel: Math.max(0, 72 - (t / ctx.duration) * 0.2),
        AFR_Lambda: lambda,
        MAF: maf,
      };
    },
  },
  {
    id: 0x0D0,
    name: "ENG_Thermal",
    dlc: 8,
    cycleMs: 200,
    signals: [
      { name: "CoolantTemp", startBit: 0, length: 8, factor: 1, offset: -40, min: -40, max: 150, unit: "C" },
      { name: "OilTemp", startBit: 8, length: 8, factor: 1, offset: -40, min: -40, max: 160, unit: "C" },
      { name: "OilPressure", startBit: 16, length: 8, factor: 0.05, offset: 0, min: 0, max: 10, unit: "bar" },
      { name: "IntakeAirTemp", startBit: 24, length: 8, factor: 1, offset: -40, min: -40, max: 100, unit: "C" },
      { name: "ExhaustGasTemp", startBit: 32, length: 16, factor: 1, offset: 0, min: 0, max: 1100, unit: "C" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      const v = ctx.vehicle;
      // Heat load by scenario (0..1)
      const heat =
        ctx.state === "drag_pass" || ctx.state === "burnout" ? 1.1 :
        ctx.state === "track_lap" ? 0.9 :
        ctx.state === "launch_0_60" || ctx.state === "top_speed_run" ? 1 :
        ctx.state === "highway_cruise" ? 0.4 : 0.1;
      // Diesel runs cooler EGT but higher coolant under load
      const egtBase = v.powertrain === "diesel" ? 320 : 420;
      const egtSpan = v.powertrain === "diesel" ? 380 : 480;
      const k = Math.min(1, t / ctx.duration);
      // Cumulative thermal rise — temps integrate over time, not just k of duration
      const tempRiseRate = heat * 0.4; // °C per second under load
      // Realism: 1st-order thermal integrator with cooldown after lift; oil lags coolant.
      // loadFactor 0..1, scenario-specific.
      const isHighLoad = ctx.state === "launch_0_60" || ctx.state === "top_speed_run" || ctx.state === "drag_pass" || ctx.state === "burnout";
      const isMid = ctx.state === "track_lap" || ctx.state === "highway_cruise";
      const loadFactor = isHighLoad ? 0.95 : isMid ? (ctx.state === "track_lap" ? 0.75 : 0.35) : 0.08;
      const coolantRise = thermalIntegral(loadFactor, t, 28) * 28; // up to ~+28°C
      const oilRise = thermalIntegral(loadFactor, t, 55) * 50; // slower, larger ceiling
      const iatRise = thermalIntegral(loadFactor, t, 6) * (v.induction !== "na" ? 38 : 18);
      const egtRise = thermalIntegral(loadFactor, t, 4) * egtSpan;
      // Slight cooldown after burst — if we're not at peak load and t > 5s, decay
      const cooldown = !isHighLoad && t > 5 ? Math.exp(-(t - 5) / 30) : 1;
      return {
        CoolantTemp: quantize(88 + coolantRise * cooldown + gauss(r, 0.15), 0.5),
        OilTemp: quantize(95 + oilRise * cooldown + gauss(r, 0.2), 0.5),
        OilPressure: quantize(3.2 + loadFactor * 1.4 + gauss(r, 0.05), 0.05),
        IntakeAirTemp: quantize(32 + iatRise + gauss(r, 0.2), 0.5),
        ExhaustGasTemp: quantize(egtBase + egtRise + gauss(r, 4), 1),
      };
    },
  },
  {
    id: 0x0D8,
    name: "ENG_Boost",
    dlc: 8,
    cycleMs: 50,
    signals: [
      { name: "BoostPressure", startBit: 0, length: 16, factor: 0.01, offset: -100, min: -100, max: 350, unit: "kPa" },
      { name: "WastegateDuty", startBit: 16, length: 8, factor: 0.5, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "TurboShaftRpm", startBit: 24, length: 16, factor: 10, offset: 0, min: 0, max: 250000, unit: "rpm" },
      { name: "Counter_D8", startBit: 48, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (t, ctx) => {
      const v = ctx.vehicle;
      const r = ctx.rand;
      const boosted = v.induction === "turbo" || v.induction === "twin_turbo" || v.induction === "supercharged";
      if (!boosted) {
        return { BoostPressure: 0, WastegateDuty: 0, TurboShaftRpm: 0 };
      }
      const peakBoost = v.induction === "twin_turbo" ? 220 : v.induction === "supercharged" ? 130 : 180;
      let load = 0;
      switch (ctx.state) {
        case "launch_0_60":
        case "drag_pass":
        case "top_speed_run":
        case "burnout":
          load = 0.95; break;
        case "track_lap": {
          const lap = (t % 25) / 25;
          load = lap < 0.4 ? 0.9 : lap < 0.55 ? 0.05 : 0.5;
          break;
        }
        case "highway_cruise": load = 0.15; break;
        case "city_stop_go": load = 0.3 + Math.sin(t * 0.5) * 0.2; break;
        default: load = 0.05;
      }
      // Lag: superchargers respond instantly, turbos lag 0.4s
      const lag = v.induction === "supercharged" ? 0 : 0.4;
      const effLoad = Math.max(0, Math.min(1, load * (1 - Math.exp(-Math.max(0.01, t) / Math.max(0.01, lag)))));
      const boost = effLoad * peakBoost + (r() - 0.5) * 3;
      return {
        BoostPressure: boost,
        WastegateDuty: load > 0.8 ? 80 + (r() - 0.5) * 5 : 30 * load,
        TurboShaftRpm: effLoad * 180000,
      };
    },
  },
];

// EV-specific frames
const buildEvFrames = (): FrameDef[] => [
  {
    id: 0x300,
    name: "PWR_Battery",
    dlc: 8,
    cycleMs: 100,
    signals: [
      { name: "BatterySOC", startBit: 0, length: 16, factor: 0.01, offset: 0, min: 0, max: 100, unit: "%" },
      { name: "PackVoltage", startBit: 16, length: 16, factor: 0.1, offset: 0, min: 0, max: 1000, unit: "V" },
      { name: "PackCurrent", startBit: 32, length: 16, factor: 0.1, offset: -1000, min: -500, max: 500, unit: "A" },
      { name: "BatteryTemp", startBit: 48, length: 8, factor: 1, offset: -40, min: -40, max: 100, unit: "C" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      const v = ctx.vehicle;
      const packV = v.nominalPackVolts;
      const peakPackAmps = Math.max(120, Math.min(1500, v.peakMotorTorqueNm * 1.4));
      let soc = 70;
      let current = 0;
      let temp = 28;
      switch (ctx.state) {
        case "charging_20_80": {
          const k = Math.min(1, t / ctx.duration);
          soc = 20 + k * 60;
          current = -Math.min(peakPackAmps * 0.6, 250) + (r() - 0.5) * 4;
          temp = 30 + k * 6;
          break;
        }
        case "launch_0_60":
          soc = 78 - (t / ctx.duration) * 0.4;
          current = Math.min(peakPackAmps, 280 + v.peakMotorTorqueNm * 0.2) + (r() - 0.5) * 10;
          temp = 32 + (t / ctx.duration) * 3;
          break;
        case "top_speed_run":
          soc = 78 - (t / ctx.duration) * 1.5;
          current = Math.min(peakPackAmps, peakPackAmps * 0.8) + (r() - 0.5) * 12;
          temp = 35 + (t / ctx.duration) * 8;
          break;
        case "regen_braking":
          soc = 65 + (t / ctx.duration) * 0.3;
          current = -Math.min(peakPackAmps * 0.4, 100) + (r() - 0.5) * 6;
          temp = 30;
          break;
        case "highway_cruise":
          soc = 72 - (t / ctx.duration) * 0.6;
          current = 60 + (r() - 0.5) * 4;
          temp = 32;
          break;
        case "idle_ac_on":
          soc = 80 - (t / ctx.duration) * 0.05;
          current = v.hvacIdleAmps + (r() - 0.5);
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
      return {
        BatterySOC: soc,
        PackVoltage: packV + (r() - 0.5) * 2,
        PackCurrent: current,
        BatteryTemp: temp,
      };
    },
  },
  {
    id: 0x310,
    name: "PWR_Motor",
    dlc: 8,
    cycleMs: 20,
    signals: [
      { name: "TorqueRequest", startBit: 0, length: 16, factor: 0.1, offset: -3000, min: -1500, max: 1500, unit: "Nm" },
      { name: "TorqueActual", startBit: 16, length: 16, factor: 0.1, offset: -3000, min: -1500, max: 1500, unit: "Nm" },
      { name: "MotorRPM", startBit: 32, length: 16, factor: 1, offset: 0, min: 0, max: 25000, unit: "rpm" },
      { name: "MotorTemp", startBit: 48, length: 8, factor: 1, offset: -40, min: -40, max: 200, unit: "C" },
      { name: "Checksum_310", startBit: 56, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: "" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      const v = ctx.vehicle;
      const peak = v.peakMotorTorqueNm;
      const vMax = Math.max(80, v.topSpeedKph);
      // Approx motor RPM tracks vehicle speed (single-speed reducer for most BEVs)
      const speedToMotorRpm = 75; // rpm per km/h, fictional gearing
      let req = 0;
      let speed = 0;
      switch (ctx.state) {
        case "launch_0_60": {
          const inAccel = t <= v.zeroTo100Sec;
          req = inAccel ? peak * 0.95 + (r() - 0.5) * 6 : peak * 0.25;
          const accelPhase = Math.min(1, t / Math.max(0.5, v.zeroTo100Sec));
          speed = 100 * (1 - Math.exp(-3.0 * accelPhase));
          break;
        }
        case "top_speed_run": {
          const fracToHundred = Math.min(0.95, 100 / vMax);
          const tau60 = Math.max(0.6, v.zeroTo100Sec / -Math.log(1 - fracToHundred));
          const fracV = 1 - Math.exp(-t / tau60);
          req = peak * (1 - 0.55 * fracV) + (r() - 0.5) * 10;
          speed = vMax * fracV;
          break;
        }
        case "regen_braking":
          req = -Math.min(peak * 0.35, 250) + (r() - 0.5) * 8;
          speed = Math.max(0, 80 - (t / ctx.duration) * 75);
          break;
        case "highway_cruise":
          req = Math.min(peak * 0.15, 120) + Math.sin(t * 0.3) * 8;
          speed = v.cruiseKph;
          break;
        case "idle_ac_on":
          req = 0;
          speed = 0;
          break;
        case "charging_20_80":
          req = 0;
          speed = 0;
          break;
        case "city_stop_go":
          req = Math.min(peak * 0.25, 200) + Math.sin(t * 0.5) * 60;
          speed = 25 + Math.sin(t * 0.5) * 15;
          break;
        default:
          req = 50;
          speed = 40;
      }
      req = Math.max(-peak, Math.min(peak, req));
      return {
        TorqueRequest: req,
        TorqueActual: req * 0.97 + (r() - 0.5) * 4,
        MotorRPM: Math.max(0, speed * speedToMotorRpm),
        MotorTemp: 45 + (t / ctx.duration) * 8,
      };
    },
  },
  {
    id: 0x320,
    name: "PWR_Inverter",
    dlc: 8,
    cycleMs: 100,
    signals: [
      { name: "InverterTemp", startBit: 0, length: 8, factor: 1, offset: -40, min: -40, max: 200, unit: "C" },
      { name: "InverterDcCurrent", startBit: 8, length: 16, factor: 0.1, offset: -1000, min: -500, max: 500, unit: "A" },
      { name: "DcLinkVoltage", startBit: 24, length: 16, factor: 0.1, offset: 0, min: 0, max: 1000, unit: "V" },
    ],
    shape: (t, ctx) => {
      const r = ctx.rand;
      const v = ctx.vehicle;
      const heat = ctx.state === "top_speed_run" || ctx.state === "launch_0_60" ? 1 : ctx.state === "highway_cruise" ? 0.3 : 0.1;
      return {
        InverterTemp: 50 + heat * 30 * (t / ctx.duration) + (r() - 0.5),
        InverterDcCurrent: ctx.state === "regen_braking" ? -80 : heat * 200,
        DcLinkVoltage: v.nominalPackVolts + (r() - 0.5) * 3,
      };
    },
  },
];

// Common chassis/body frames (always included)
const buildCommonFrames = (): FrameDef[] => [
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
        case "burnout":
          // Stationary, launch-control like — driven wheels handled in VEH_Wheels via slip
          speed = 0 + (r() - 0.5) * 0.4;
          pedal = 60 + (Math.sin(t * 3) + 1) * 18;
          brake = 18 + (r() - 0.5) * 2; // brake torque holding car
          gear = 1;
          break;
        case "drag_pass": {
          const accelPhase = Math.min(1, t / Math.max(0.5, v.zeroTo100Sec * 2.4));
          speed = (vMax * 0.6) * (1 - Math.exp(-2.6 * accelPhase));
          pedal = 100;
          brake = 0;
          gear = Math.min(gearTopIdx, 1 + Math.floor((speed / vMax) * gearTopIdx));
          break;
        }
        case "track_lap": {
          const lap = (t % 25) / 25;
          if (lap < 0.4) speed = lap * 2.5 * (vMax * 0.85);
          else if (lap < 0.55) speed = vMax * 0.85 - (lap - 0.4) * 6 * (vMax * 0.5);
          else if (lap < 0.85) speed = 80 + Math.sin(lap * 12) * 30;
          else speed = Math.max(0, (1 - lap) * 6 * (vMax * 0.5));
          pedal = lap < 0.4 ? 95 : lap < 0.55 ? 5 : 60 + Math.sin(lap * 8) * 30;
          brake = lap >= 0.4 && lap < 0.55 ? 60 + (r() - 0.5) * 6 : 0;
          gear = Math.min(gearTopIdx, 1 + Math.floor((speed / vMax) * gearTopIdx));
          break;
        }
        default:
          speed = 40 + Math.sin(t * 0.5) * 10;
          pedal = 20;
          brake = 0;
          gear = Math.min(gearTopIdx, 3);
      }
      // Apply drag-aware top-speed squeeze and small pedal/brake jitter + quantization
      const dragSqueeze = speed > vMax * 0.6 ? 1 - 0.12 * Math.pow(speed / vMax, 3) : 1;
      const speedFinal = Math.max(0, speed * dragSqueeze + gauss(r, 0.05));
      const pedalFinal = Math.max(0, Math.min(100, pedal + gauss(r, 0.25)));
      const brakeFinal = Math.max(0, brake + gauss(r, 0.08));
      return {
        VehicleSpeed: quantize(speedFinal, 0.01),
        AcceleratorPedal: quantize(pedalFinal, 0.4),
        BrakePressure: quantize(brakeFinal, 0.1),
        GearPosition: gear,
      };
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
      let base = 0;
      switch (ctx.state) {
        case "idle_ac_on":
        case "charging_20_80":
          base = 0; break;
        case "highway_cruise":
          base = v.cruiseKph; break;
        case "launch_0_60":
          base = 100 * (1 - Math.exp(-3.0 * Math.min(1, t / Math.max(0.5, v.zeroTo100Sec)))) +
            (t > v.zeroTo100Sec ? Math.min(20, (t - v.zeroTo100Sec) * 4) : 0);
          break;
        case "top_speed_run":
          base = vMax * (1 - Math.exp(-t / tau60)); break;
        case "regen_braking":
          base = Math.max(0, 80 - (t / ctx.duration) * 75); break;
        case "burnout":
          base = 0; break;
        case "drag_pass": {
          const accelPhase = Math.min(1, t / Math.max(0.5, v.zeroTo100Sec * 2.4));
          base = (vMax * 0.6) * (1 - Math.exp(-2.6 * accelPhase));
          break;
        }
        case "track_lap": {
          const lap = (t % 25) / 25;
          if (lap < 0.4) base = lap * 2.5 * (vMax * 0.85);
          else if (lap < 0.55) base = vMax * 0.85 - (lap - 0.4) * 6 * (vMax * 0.5);
          else if (lap < 0.85) base = 80 + Math.sin(lap * 12) * 30;
          else base = Math.max(0, (1 - lap) * 6 * (vMax * 0.5));
          break;
        }
        default:
          base = 30 + Math.sin(t * 0.5) * 10;
      }
      // Per-wheel small jitter; left/right divergence under load
      const driveAxle = v.drivetrain;
      let slipDriven = 0;
      if (ctx.state === "burnout") slipDriven = 80 + Math.sin(t * 5) * 20;
      else if (ctx.state === "launch_0_60" && t < v.zeroTo100Sec * 0.5)
        slipDriven = Math.max(0, (10 - base * 0.15));
      else if (ctx.state === "drag_pass" && t < v.zeroTo100Sec * 0.6)
        slipDriven = Math.max(0, (8 - base * 0.1));
      // Traction-control oscillation at ~12-15 Hz when slip > 0
      const tc = slipDriven > 0.5 ? wobble(t, 13.5, slipDriven * 0.18) : 0;
      // High-speed micro-slip on driven axle
      const microSlip = base > vMax * 0.7 ? wobble(t, 7, 0.4) : 0;
      // Left/right divergence (camber/road crown bias)
      const lrBias = base * 0.0015;
      const j = (sigma = 0.15) => gauss(r, sigma);
      const drivenAdd = slipDriven + tc + microSlip;
      const fl = base + j() - lrBias + (driveAxle === "fwd" || driveAxle === "awd" ? drivenAdd * 0.5 : 0);
      const fr = base + j() + lrBias + (driveAxle === "fwd" || driveAxle === "awd" ? drivenAdd * 0.5 : 0);
      const rl = base + j() - lrBias + (driveAxle === "rwd" || driveAxle === "awd" ? drivenAdd : 0);
      const rr = base + j() + lrBias + (driveAxle === "rwd" || driveAxle === "awd" ? drivenAdd : 0);
      return {
        WheelSpeed_FL: quantize(Math.max(0, fl), 0.01),
        WheelSpeed_FR: quantize(Math.max(0, fr), 0.01),
        WheelSpeed_RL: quantize(Math.max(0, rl), 0.01),
        WheelSpeed_RR: quantize(Math.max(0, rr), 0.01),
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

// Powertrain-aware frame selector
const buildFrames = (vehicle: VehicleProfile): FrameDef[] => {
  const common = buildCommonFrames();
  switch (vehicle.powertrain) {
    case "bev":
      return [...common, ...buildEvFrames()];
    case "ice":
    case "diesel":
      return [...common, ...buildIceFrames()];
    case "hybrid":
    case "phev":
      return [...common, ...buildEvFrames(), ...buildIceFrames()];
    default:
      return common;
  }
};

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
    // Realism: timestamp jitter blends bus-load jitter (cycle-relative) + scheduler jitter (~0.2 ms)
    const cycleJitter = f.cycleMs * 0.025; // ~2.5% of cycle
    const schedulerJitterMs = 0.3;
    for (let t = 0; t < duration * 1000; t += f.cycleMs) {
      const jitter = (rand() - 0.5) * cycleJitter + (rand() - 0.5) * schedulerJitterMs;
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
  burnout: "Burnout (stationary, wheels spinning)",
  drag_pass: "Drag pass (1/4 mile)",
  track_lap: "Track lap (mixed throttle/brake/corner)",
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
    `  Peak motor/engine torque: ${vehicle.peakMotorTorqueNm} Nm · Peak power: ${vehicle.peakPowerHp} hp · Curb weight: ${vehicle.curbWeightKg} kg`,
    `  Induction: ${vehicle.induction.replace("_", " ")} · Drivetrain: ${vehicle.drivetrain.toUpperCase()} · Redline: ${vehicle.redlineRpm} rpm · 60→130 mph: ~${vehicle.sixtyTo130Sec.toFixed(1)} s`,
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
    case "burnout":
      lines.push(
        `- Stationary chassis with brake torque held; driven (${vehicle.drivetrain.toUpperCase()}) wheels spin to ~80–100 km/h indicated while non-driven wheels read ~0. Throttle stabs cycle RPM near ${Math.round(vehicle.redlineRpm * 0.85)}.`,
      );
      break;
    case "drag_pass":
      lines.push(
        `- Quarter-mile style: hard launch, full pedal, sequential redline shifts through ${vehicle.gearCount} gears, peak HP near ${vehicle.peakPowerHp} hp, trap speed approaching ${Math.round(vehicle.topSpeedKph * 0.6)} km/h (~${mph(Math.round(vehicle.topSpeedKph * 0.6))} mph).`,
      );
      break;
    case "track_lap":
      lines.push(
        `- ~25 s lap loop: full-throttle straight, hard braking event, mid-corner throttle modulation with steering oscillations. Coolant/oil temps climb under sustained load.`,
      );
      break;
    default:
      lines.push("- Custom mixed behavior with stable plausible payload patterns.");
  }
  if (vehicle.induction === "turbo" || vehicle.induction === "twin_turbo" || vehicle.induction === "supercharged") {
    lines.push(`- Forced induction (${vehicle.induction.replace("_", " ")}): boost rises with throttle, EGT and IAT climb under sustained load.`);
  }
  lines.push(`- Drivetrain: ${vehicle.drivetrain.toUpperCase()} · Tire radius: ${vehicle.tireRadiusM.toFixed(3)} m · Redline: ${vehicle.redlineRpm} rpm`);
  lines.push("");
  lines.push("All signals are fictional and not derived from any OEM, vendor, or proprietary database.");
  return lines.join("\n");
};

export const generateSample = (req: SampleRequest): SampleOutput => {
  const seed = req.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = mulberry32(seed);
  const vehicle = buildVehicleProfile(req.vehicleDescription, req.specOverride);
  const frames = buildFrames(vehicle);
  const duration = Math.max(2, Math.min(120, req.durationSec));
  const dbc = buildDbc(frames, req.vehicleDescription);
  const { log, messageCount } = buildLog(frames, duration, rand, req.drivingState, vehicle);
  const stats = {
    messages: messageCount,
    uniqueIds: frames.length,
    durationSec: duration,
    avgRateHz: messageCount / duration,
  };
  const summary = buildSummary(req, frames, stats, vehicle);
  return { dbc, log, summary, stats };
};

export const drivingStateOptions: Array<{ value: DrivingState; label: string }> = [
  { value: "launch_0_60", label: "0–60 launch" },
  { value: "drag_pass", label: "Drag pass (1/4 mile)" },
  { value: "top_speed_run", label: "Top speed run (0 → Vmax)" },
  { value: "burnout", label: "Burnout (stationary, wheels spinning)" },
  { value: "track_lap", label: "Track lap (mixed)" },
  { value: "idle_ac_on", label: "Idle with HVAC on" },
  { value: "regen_braking", label: "Regen braking" },
  { value: "highway_cruise", label: "Highway cruise (70 mph)" },
  { value: "charging_20_80", label: "DC charging 20% → 80%" },
  { value: "city_stop_go", label: "City stop-and-go" },
  { value: "custom", label: "Custom (describe below)" },
];
