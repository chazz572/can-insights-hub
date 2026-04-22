import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const normalizeRows = (data: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(data)) {
    return data.map((item, index) => (item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : { item: index + 1, value: item }));
  }

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  }

  return [];
};

interface JsonTableProps {
  data: unknown;
  emptyLabel?: string;
}

export const JsonTable = ({ data, emptyLabel = "No records returned." }: JsonTableProps) => {
  const rows = normalizeRows(data);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  if (!rows.length || !columns.length) {
    return <div className="rounded-md border border-dashed bg-muted/50 p-4 text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {columns.map((column) => (
              <TableHead key={column} className="whitespace-nowrap capitalize">
                {column.replace(/_/g, " ")}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => (
                <TableCell key={column} className="max-w-[24rem] break-words font-mono text-xs">
                  {renderValue(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};