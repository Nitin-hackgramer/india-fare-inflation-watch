import type { FareObservation } from "@/types";
import type { Column } from "./DataTable";
import type { CsvColumn } from "@/utils/csv";
import { airlineByCode, routeLabel } from "@/services/data/mockData";
import { formatDate, formatDateTime, formatINR, formatWindow } from "@/utils/format";

export const observationColumns: Column<FareObservation>[] = [
  { key: "route", header: "Route", cell: (o) => <span className="font-medium">{routeLabel(o.routeId)}</span>, sortValue: (o) => o.routeId },
  { key: "airline", header: "Airline", cell: (o) => airlineByCode(o.airlineCode)?.name ?? o.airlineCode, sortValue: (o) => o.airlineCode },
  { key: "travel", header: "Travel date", cell: (o) => formatDate(o.travelDate), sortValue: (o) => o.travelDate },
  { key: "window", header: "Window", cell: (o) => formatWindow(o.advanceDays), sortValue: (o) => o.advanceDays },
  { key: "fare", header: "Observed fare", cell: (o) => formatINR(o.fare ?? 0), sortValue: (o) => o.fare ?? 0, align: "right" },
  { key: "collected", header: "Collected at", cell: (o) => <span className="text-muted-foreground">{formatDateTime(o.collectedAt)}</span>, sortValue: (o) => o.collectedAt },
];

export const observationCsv: CsvColumn<FareObservation>[] = [
  { header: "observation_id", value: (o) => o.id },
  { header: "route", value: (o) => o.routeId },
  { header: "airline", value: (o) => airlineByCode(o.airlineCode)?.name ?? o.airlineCode },
  { header: "observed_date", value: (o) => o.observedDate },
  { header: "travel_date", value: (o) => o.travelDate },
  { header: "advance_days", value: (o) => o.advanceDays },
  { header: "fare_inr", value: (o) => o.fare },
  { header: "collected_at", value: (o) => o.collectedAt },
  { header: "data_status", value: () => "DEMO DATA" },
];
