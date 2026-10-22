import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { IndexPeriod } from "@/types";

const OPTIONS: { value: IndexPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function PeriodToggle({ value, onChange }: { value: IndexPeriod; onChange: (p: IndexPeriod) => void }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as IndexPeriod)}
      aria-label="Index aggregation period"
    >
      {OPTIONS.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
