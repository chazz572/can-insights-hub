import { useEffect, useState } from "react";

export type SpeedUnit = "kph" | "mph";

const STORAGE_KEY = "can_ai_speed_unit";
const EVENT_NAME = "can_ai_speed_unit_changed";

export const getSpeedUnit = (): SpeedUnit => {
  if (typeof window === "undefined") return "kph";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "mph" ? "mph" : "kph";
};

export const setSpeedUnit = (unit: SpeedUnit) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, unit);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: unit }));
};

export const useSpeedUnit = (): [SpeedUnit, (u: SpeedUnit) => void] => {
  const [unit, setUnit] = useState<SpeedUnit>(getSpeedUnit);

  useEffect(() => {
    const sync = () => setUnit(getSpeedUnit());
    window.addEventListener(EVENT_NAME, sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [unit, setSpeedUnit];
};

export const KPH_TO_MPH = 0.621371;

export const kphToMph = (kph: number) => kph * KPH_TO_MPH;
export const mphToKph = (mph: number) => mph / KPH_TO_MPH;

/**
 * Format a speed value (always given in km/h) for display in the user's
 * preferred unit. Returns e.g. "240 km/h" or "149 mph".
 */
export const formatSpeed = (kph: number, unit: SpeedUnit = getSpeedUnit(), digits = 0): string => {
  const value = unit === "mph" ? kphToMph(kph) : kph;
  return `${value.toFixed(digits)} ${unit === "mph" ? "mph" : "km/h"}`;
};

/**
 * Rewrite km/h figures inside a free-form text block to the user's preferred
 * unit. Handles patterns like:
 *   "240 km/h (~149 mph)"  → "149 mph (~240 km/h)"
 *   "100 km/h"             → "62 mph"
 *   "0 → 100 km/h"         → "0 → 62 mph"
 * Leaves the text unchanged when unit is "kph".
 */
export const convertSpeedsInText = (text: string, unit: SpeedUnit): string => {
  if (unit === "kph") return text;

  // Sentinel keeps "km/h" tokens we've already placed safe from later passes.
  const SENTINEL = "\u0001KMHSAFE\u0001";

  // 1) Swap "<X> km/h (~<Y> mph)" → "<Y> mph (~<X> km/h)" using sentinel
  let out = text.replace(
    /(\d+(?:\.\d+)?)\s*km\/h\s*\(~\s*(\d+(?:\.\d+)?)\s*mph\)/g,
    (_, kph, mph) => `${mph} mph (~${kph} ${SENTINEL})`,
  );

  // 2) Convert any remaining bare "<X> km/h" → "<Y> mph"
  out = out.replace(/(\d+(?:\.\d+)?)\s*km\/h/g, (_, kph) => {
    const mph = Math.round(Number(kph) * KPH_TO_MPH);
    return `${mph} mph`;
  });

  // 3) Restore the protected km/h tokens
  out = out.replaceAll(SENTINEL, "km/h");

  // Re-label the canonical 0–100 km/h benchmark (now "0–62 mph") to the
  // customary "0–60 mph" equivalent. Handles both en-dash and hyphen.
  out = out.replace(/0\s*[–-]\s*62\s*mph/g, "0–60 mph");

  // Convert "<X> kg" → "<Y> lb" (curb weight, payloads, etc.)
  out = out.replace(/(\d+(?:\.\d+)?)\s*kg\b/g, (_, kg) => {
    const lb = Math.round(Number(kg) * 2.20462);
    return `${lb} lb`;
  });

  // Convert small "<X> m" values (e.g. tire radius 0.353 m) → inches.
  out = out.replace(/(\d+(?:\.\d{1,3})?)\s*m\b(?!\w)/g, (match, m) => {
    const meters = Number(m);
    if (Number.isNaN(meters) || meters > 5) return match;
    const inches = (meters * 39.3701).toFixed(1);
    return `${inches} in`;
  });

  return out;
};


