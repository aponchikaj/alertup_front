import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/* ============================================================================
   DataTable — token-themed, responsive (scrolls inside its own container so
   the page never scrolls sideways), with an empty state built in.
   ========================================================================= */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  /** Extra classes for both the header and body cells of this column. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Rendered inside the table body when there are no rows. */
  emptyLabel?: ReactNode;
  /** Accessible description of what the table contains. */
  caption: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = "No data yet.",
  caption,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm",
        className,
      )}
    >
      <table className="w-full min-w-[24rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm text-ink-subtle"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className="transition-colors duration-150 hover:bg-surface-hover"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 text-ink-muted", col.className)}
                  >
                    {col.render(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
