import { Gauge } from "lucide-react";
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
import { type SpeedUnit, useSpeedUnit } from "@/lib/units";

interface SettingsDialogProps {
  trigger: ReactNode;
}

export const SettingsDialog = ({ trigger }: SettingsDialogProps) => {
  const [unit, setUnit] = useSpeedUnit();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider">Shop Settings</DialogTitle>
          <DialogDescription>
            Configure how diagnostic data is displayed across the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-sm border border-glass-border bg-secondary text-primary">
              <Gauge className="size-4" />
            </span>
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                Speed Units
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Applied to all speed readouts
              </p>
            </div>
          </div>

          <RadioGroup
            value={unit}
            onValueChange={(value) => setUnit(value as SpeedUnit)}
            className="grid grid-cols-2 gap-2"
          >
            <Label
              htmlFor="unit-kph"
              className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 transition-colors ${
                unit === "kph"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-glass-border bg-secondary text-foreground hover:border-primary/50"
              }`}
            >
              <RadioGroupItem id="unit-kph" value="kph" />
              <span className="flex flex-col">
                <span className="font-display text-sm font-bold uppercase tracking-wider">km/h</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Metric
                </span>
              </span>
            </Label>
            <Label
              htmlFor="unit-mph"
              className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 transition-colors ${
                unit === "mph"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-glass-border bg-secondary text-foreground hover:border-primary/50"
              }`}
            >
              <RadioGroupItem id="unit-mph" value="mph" />
              <span className="flex flex-col">
                <span className="font-display text-sm font-bold uppercase tracking-wider">mph</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Imperial
                </span>
              </span>
            </Label>
          </RadioGroup>

          <p className="rounded-sm border border-glass-border bg-card/40 p-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Underlying CAN signals are stored in their native units. This setting only affects how
            speed values are displayed in summaries and readouts.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
