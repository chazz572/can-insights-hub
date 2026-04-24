import { supabase } from "@/integrations/supabase/client";
import type { VehicleSpecOverride } from "@/lib/sampleGenerator";

interface RawSpecs {
  canonical_name?: string;
  powertrain?: string;
  top_speed_kph?: number;
  zero_to_100_kph_sec?: number;
  sixty_to_130_mph_sec?: number;
  redline_rpm?: number;
  idle_rpm?: number;
  gear_count?: number;
  gear_ratios?: number[];
  final_drive?: number;
  pack_kwh?: number;
  nominal_pack_volts?: number;
  peak_power_hp?: number;
  peak_torque_nm?: number;
  curb_weight_kg?: number;
  induction?: string;
  drivetrain?: string;
  tire_radius_m?: number;
  notes?: string;
}

export interface VehicleSpecsResult {
  override: VehicleSpecOverride;
  canonicalName?: string;
  notes?: string;
}

const CACHE_KEY = "cjl_vehicle_specs_cache_v1";
const cacheKey = (desc: string) => desc.trim().toLowerCase().replace(/\s+/g, " ");

const readCache = (): Record<string, VehicleSpecsResult> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeCache = (cache: Record<string, VehicleSpecsResult>) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
};

const VALID_POWERTRAIN = new Set(["bev", "phev", "hybrid", "ice", "diesel"]);
const VALID_INDUCTION = new Set(["na", "turbo", "twin_turbo", "supercharged", "electric"]);
const VALID_DRIVETRAIN = new Set(["fwd", "rwd", "awd"]);

const normalize = (raw: RawSpecs): VehicleSpecOverride => {
  const o: VehicleSpecOverride = {};
  if (raw.powertrain && VALID_POWERTRAIN.has(raw.powertrain)) o.powertrain = raw.powertrain as VehicleSpecOverride["powertrain"];
  if (typeof raw.top_speed_kph === "number" && raw.top_speed_kph > 60 && raw.top_speed_kph < 600) o.topSpeedKph = raw.top_speed_kph;
  if (typeof raw.zero_to_100_kph_sec === "number" && raw.zero_to_100_kph_sec > 1 && raw.zero_to_100_kph_sec < 30) o.zeroTo100Sec = raw.zero_to_100_kph_sec;
  if (typeof raw.sixty_to_130_mph_sec === "number" && raw.sixty_to_130_mph_sec > 1 && raw.sixty_to_130_mph_sec < 60) o.sixtyTo130Sec = raw.sixty_to_130_mph_sec;
  if (typeof raw.redline_rpm === "number" && raw.redline_rpm > 1000 && raw.redline_rpm < 25000) o.redlineRpm = Math.round(raw.redline_rpm);
  if (typeof raw.idle_rpm === "number" && raw.idle_rpm > 200 && raw.idle_rpm < 2000) o.idleRpm = Math.round(raw.idle_rpm);
  if (typeof raw.gear_count === "number" && raw.gear_count >= 1 && raw.gear_count <= 12) o.gearCount = Math.round(raw.gear_count);
  if (Array.isArray(raw.gear_ratios) && raw.gear_ratios.length && raw.gear_ratios.every((n) => typeof n === "number" && n > 0)) o.gearRatios = raw.gear_ratios;
  if (typeof raw.final_drive === "number" && raw.final_drive > 1 && raw.final_drive < 10) o.finalDrive = raw.final_drive;
  if (typeof raw.pack_kwh === "number" && raw.pack_kwh >= 0 && raw.pack_kwh < 500) o.packKwh = raw.pack_kwh;
  if (typeof raw.nominal_pack_volts === "number" && raw.nominal_pack_volts > 0 && raw.nominal_pack_volts < 2000) o.nominalPackVolts = raw.nominal_pack_volts;
  if (typeof raw.peak_power_hp === "number" && raw.peak_power_hp > 30 && raw.peak_power_hp < 3000) o.peakPowerHp = Math.round(raw.peak_power_hp);
  if (typeof raw.peak_torque_nm === "number" && raw.peak_torque_nm > 50 && raw.peak_torque_nm < 5000) o.peakMotorTorqueNm = Math.round(raw.peak_torque_nm);
  if (typeof raw.curb_weight_kg === "number" && raw.curb_weight_kg > 200 && raw.curb_weight_kg < 5000) o.curbWeightKg = Math.round(raw.curb_weight_kg);
  if (raw.induction && VALID_INDUCTION.has(raw.induction)) o.induction = raw.induction as VehicleSpecOverride["induction"];
  if (raw.drivetrain && VALID_DRIVETRAIN.has(raw.drivetrain)) o.drivetrain = raw.drivetrain as VehicleSpecOverride["drivetrain"];
  if (typeof raw.tire_radius_m === "number" && raw.tire_radius_m > 0.2 && raw.tire_radius_m < 0.6) o.tireRadiusM = raw.tire_radius_m;
  return o;
};

export const fetchVehicleSpecs = async (description: string): Promise<VehicleSpecsResult | null> => {
  const desc = description.trim();
  if (!desc) return null;

  const cache = readCache();
  const key = cacheKey(desc);
  if (cache[key]) return cache[key];

  const { data, error } = await supabase.functions.invoke("vehicle-specs", { body: { description: desc } });
  if (error) {
    console.warn("vehicle-specs edge function error", error);
    return null;
  }
  if (!data || data.error) {
    console.warn("vehicle-specs returned error", data?.error);
    return null;
  }

  const raw = (data.specs ?? {}) as RawSpecs;
  const override = normalize(raw);
  if (Object.keys(override).length === 0) return null;

  const result: VehicleSpecsResult = {
    override,
    canonicalName: raw.canonical_name,
    notes: raw.notes,
  };
  cache[key] = result;
  writeCache(cache);
  return result;
};
