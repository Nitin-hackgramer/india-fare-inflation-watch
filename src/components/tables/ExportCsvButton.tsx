import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv, type CsvColumn } from "@/utils/csv";

/** Exports exactly the rows passed in — callers pass the currently filtered dataset. */
export function ExportCsvButton<T>({ rows, columns, filename }: { rows: T[]; columns: CsvColumn<T>[]; filename: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      disabled={!rows.length}
      onClick={() => downloadCsv(filename, toCsv(rows, columns))}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      Export CSV
    </Button>
  );
}
