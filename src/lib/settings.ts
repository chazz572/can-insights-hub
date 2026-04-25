import { useEffect, useState } from "react";

// Generic localStorage-backed setting hook with cross-tab + same-tab event sync.
export const createSetting = <T extends string>(key: string, defaultValue: T, validate?: (v: string) => v is T) => {
  const eventName = `setting:${key}`;

  const read = (): T => {
    if (typeof window === "undefined") return defaultValue;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    if (validate) return validate(raw) ? raw : defaultValue;
    return raw as T;
  };

  const write = (value: T) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
  };

  const useValue = (): [T, (v: T) => void] => {
    const [value, setValue] = useState<T>(read);
    useEffect(() => {
      const sync = () => setValue(read());
      window.addEventListener(eventName, sync as EventListener);
      window.addEventListener("storage", sync);
      return () => {
        window.removeEventListener(eventName, sync as EventListener);
        window.removeEventListener("storage", sync);
      };
    }, []);
    return [value, write];
  };

  return { read, write, useValue };
};

export type DistanceUnit = "km" | "mi";
export const DistanceSetting = createSetting<DistanceUnit>("can_ai_distance_unit", "km", (v): v is DistanceUnit => v === "km" || v === "mi");

export type TemperatureUnit = "c" | "f";
export const TemperatureSetting = createSetting<TemperatureUnit>("can_ai_temp_unit", "c", (v): v is TemperatureUnit => v === "c" || v === "f");

export type PressureUnit = "kpa" | "psi" | "bar";
export const PressureSetting = createSetting<PressureUnit>("can_ai_pressure_unit", "kpa", (v): v is PressureUnit => v === "kpa" || v === "psi" || v === "bar");

export type Density = "comfortable" | "compact";
export const DensitySetting = createSetting<Density>("can_ai_density", "comfortable", (v): v is Density => v === "comfortable" || v === "compact");

export type MotionPref = "auto" | "reduced";
export const MotionSetting = createSetting<MotionPref>("can_ai_motion", "auto", (v): v is MotionPref => v === "auto" || v === "reduced");

export type AutoSavePref = "on" | "off";
export const AutoSaveSetting = createSetting<AutoSavePref>("can_ai_autosave", "off", (v): v is AutoSavePref => v === "on" || v === "off");

export type ShareExpiry = "1" | "7" | "30" | "never";
export const ShareExpirySetting = createSetting<ShareExpiry>("can_ai_share_expiry", "30", (v): v is ShareExpiry => ["1", "7", "30", "never"].includes(v));

export type IdFormat = "hex" | "decimal";
export const IdFormatSetting = createSetting<IdFormat>("can_ai_id_format", "hex", (v): v is IdFormat => v === "hex" || v === "decimal");

// Apply UI-affecting settings to the document root so CSS can react.
export const useApplyGlobalSettings = () => {
  const [density] = DensitySetting.useValue();
  const [motion] = MotionSetting.useValue();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = density;
    root.dataset.motion = motion;
    if (motion === "reduced") root.classList.add("motion-reduced");
    else root.classList.remove("motion-reduced");
  }, [density, motion]);
};
