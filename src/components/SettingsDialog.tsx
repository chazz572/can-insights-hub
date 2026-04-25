import { Activity, Bell, Compass, Droplet, FileDown, Gauge, Hash, Layers, Link2, MoonStar, Ruler, Share2, Sparkles, Thermometer, Wand2, Zap } from "lucide-react";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AutoSaveSetting,
  DensitySetting,
  DistanceSetting,
  IdFormatSetting,
  MotionSetting,
  PressureSetting,
  ShareExpirySetting,
  TemperatureSetting,
  type Density,
  type DistanceUnit,
  type IdFormat,
  type MotionPref,
  type PressureUnit,
  type ShareExpiry,
  type TemperatureUnit,
} from "@/lib/settings";
import { type SpeedUnit, useSpeedUnit } from "@/lib/units";

interface SettingsDialogProps {
  trigger: ReactNode;
}

const SegmentedRow = <T extends string>({
  icon,
  title,
  hint,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; sub?: string }>;
}) => (
  <div className="rounded-sm border border-glass-border bg-card/40 p-3">
    <div className="mb-3 flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-sm border border-glass-border bg-secondary text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold uppercase tracking-wider text-foreground">{title}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</p>
      </div>
    </div>
    <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <Label
          key={opt.value}
          htmlFor={`${title}-${opt.value}`}
          className={`flex cursor-pointer items-center gap-2 rounded-sm border p-2 transition-colors ${
            value === opt.value ? "border-primary bg-primary/10 text-primary" : "border-glass-border bg-secondary text-foreground hover:border-primary/50"
          }`}
        >
          <RadioGroupItem id={`${title}-${opt.value}`} value={opt.value} />
          <span className="flex min-w-0 flex-col">
            <span className="font-display text-xs font-bold uppercase tracking-wider">{opt.label}</span>
            {opt.sub ? <span className="truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{opt.sub}</span> : null}
          </span>
        </Label>
      ))}
    </RadioGroup>
  </div>
);

const ToggleRow = ({
  icon,
  title,
  hint,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-sm border border-glass-border bg-card/40 p-3">
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-9 place-items-center rounded-sm border border-glass-border bg-secondary text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold uppercase tracking-wider text-foreground">{title}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export const SettingsDialog = ({ trigger }: SettingsDialogProps) => {
  const [speed, setSpeed] = useSpeedUnit();
  const [distance, setDistance] = DistanceSetting.useValue();
  const [temp, setTemp] = TemperatureSetting.useValue();
  const [pressure, setPressure] = PressureSetting.useValue();
  const [idFormat, setIdFormat] = IdFormatSetting.useValue();
  const [density, setDensity] = DensitySetting.useValue();
  const [motion, setMotion] = MotionSetting.useValue();
  const [autosave, setAutosave] = AutoSaveSetting.useValue();
  const [shareExpiry, setShareExpiry] = ShareExpirySetting.useValue();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider">Shop Settings</DialogTitle>
          <DialogDescription>
            Configure how diagnostic data is displayed and how the workspace behaves.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="units" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="units">Units</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="mt-3 space-y-3">
            <SegmentedRow<SpeedUnit>
              icon={<Gauge className="size-4" />}
              title="Speed"
              hint="Applied to all speed readouts"
              value={speed}
              onChange={setSpeed}
              options={[{ value: "kph", label: "km/h", sub: "Metric" }, { value: "mph", label: "mph", sub: "Imperial" }]}
            />
            <SegmentedRow<DistanceUnit>
              icon={<Ruler className="size-4" />}
              title="Distance"
              hint="Odometer & trip readouts"
              value={distance}
              onChange={setDistance}
              options={[{ value: "km", label: "km" }, { value: "mi", label: "mi" }]}
            />
            <SegmentedRow<TemperatureUnit>
              icon={<Thermometer className="size-4" />}
              title="Temperature"
              hint="Coolant, intake, ambient"
              value={temp}
              onChange={setTemp}
              options={[{ value: "c", label: "°C" }, { value: "f", label: "°F" }]}
            />
            <SegmentedRow<PressureUnit>
              icon={<Droplet className="size-4" />}
              title="Pressure"
              hint="Manifold, fuel, tires"
              value={pressure}
              onChange={setPressure}
              options={[{ value: "kpa", label: "kPa" }, { value: "psi", label: "psi" }, { value: "bar", label: "bar" }]}
            />
            <SegmentedRow<IdFormat>
              icon={<Hash className="size-4" />}
              title="CAN ID Format"
              hint="How identifiers are rendered"
              value={idFormat}
              onChange={setIdFormat}
              options={[{ value: "hex", label: "0x1A4", sub: "Hex" }, { value: "decimal", label: "420", sub: "Decimal" }]}
            />
          </TabsContent>

          <TabsContent value="display" className="mt-3 space-y-3">
            <SegmentedRow<Density>
              icon={<Layers className="size-4" />}
              title="UI Density"
              hint="Spacing across cards & lists"
              value={density}
              onChange={setDensity}
              options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]}
            />
            <SegmentedRow<MotionPref>
              icon={<Sparkles className="size-4" />}
              title="Animations"
              hint="Reduce motion if you prefer"
              value={motion}
              onChange={setMotion}
              options={[{ value: "auto", label: "Auto" }, { value: "reduced", label: "Reduced" }]}
            />
            <div className="rounded-sm border border-glass-border bg-card/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-sm border border-glass-border bg-secondary text-primary"><MoonStar className="size-3.5" /></span>
                <span className="font-mono uppercase tracking-wider">Theme</span>
              </div>
              <p className="mt-2">Use the sun/moon button in the header to switch between dark and light themes.</p>
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="mt-3 space-y-3">
            <ToggleRow
              icon={<Wand2 className="size-4" />}
              title="Auto-Save Analyses"
              hint="Save snapshot to workspace after each scan"
              checked={autosave === "on"}
              onChange={(v) => setAutosave(v ? "on" : "off")}
            />
            <SegmentedRow<ShareExpiry>
              icon={<Link2 className="size-4" />}
              title="Default Share Link Expiry"
              hint="Used by Create Share Link"
              value={shareExpiry}
              onChange={setShareExpiry}
              options={[
                { value: "1", label: "1d" },
                { value: "7", label: "7d" },
                { value: "30", label: "30d" },
                { value: "never", label: "∞" },
              ]}
            />
            <div className="rounded-sm border border-glass-border bg-card/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-sm border border-glass-border bg-secondary text-primary"><Bell className="size-3.5" /></span>
                <span className="font-mono uppercase tracking-wider">Tips</span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Settings persist locally in this browser.</li>
                <li>Unit conversions don't change underlying CAN data — display only.</li>
                <li>Reduced motion also helps on low-power devices.</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// re-export icons used by parent (kept to avoid tree-shake confusion)
export const _SettingsIcons = { Activity, Compass, FileDown, Share2, Zap };
