import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DateRange } from "@/types";
import { DEMO_END_DATE, DEMO_START_DATE } from "@/services/data/mockData";

export function DateRangeInputs({ value, onChange, idPrefix }: { value: DateRange; onChange: (r: DateRange) => void; idPrefix: string }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-from`} className="text-xs text-muted-foreground">From</Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          className="h-8 w-[150px] text-xs"
          min={DEMO_START_DATE}
          max={value.to}
          value={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-to`} className="text-xs text-muted-foreground">To</Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          className="h-8 w-[150px] text-xs"
          min={value.from}
          max={DEMO_END_DATE}
          value={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
        />
      </div>
    </div>
  );
}
