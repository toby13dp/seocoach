"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AccessibleTableProps {
  /** Table caption — required for accessibility */
  caption: string;
  /** Column headers */
  headers: string[];
  /** Table rows — each row is an array of cell values (string or ReactNode) */
  rows: (string | React.ReactNode)[][];
  /** Whether the table is sortable */
  sortable?: boolean;
  /** Additional CSS class names for the table wrapper */
  className?: string;
}

type SortDirection = "ascending" | "descending" | null;

/**
 * AccessibleTable — Generates a proper HTML table with accessibility features.
 * Includes `<caption>`, `<thead>`, `<th scope="col">`, `<tbody>`, `<td>`.
 * Optional sorting with `aria-sort` attributes.
 * Responsive: on small screens, transforms to card layout using CSS.
 * Meets WCAG 2.1 AA requirements (A11Y-001, A11Y-002).
 */
export function AccessibleTable({
  caption,
  headers,
  rows,
  sortable = false,
  className,
}: AccessibleTableProps) {
  const [sortColumn, setSortColumn] = React.useState<number | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);

  const handleSort = React.useCallback(
    (columnIndex: number) => {
      if (!sortable) return;

      if (sortColumn === columnIndex) {
        if (sortDirection === "ascending") {
          setSortDirection("descending");
        } else if (sortDirection === "descending") {
          setSortColumn(null);
          setSortDirection(null);
        } else {
          setSortDirection("ascending");
        }
      } else {
        setSortColumn(columnIndex);
        setSortDirection("ascending");
      }
    },
    [sortable, sortColumn, sortDirection]
  );

  const sortedRows = React.useMemo(() => {
    if (sortColumn === null || sortDirection === null) return rows;

    return [...rows].sort((a, b) => {
      const aVal = typeof a[sortColumn] === "string" ? (a[sortColumn] as string) : "";
      const bVal = typeof b[sortColumn] === "string" ? (b[sortColumn] as string) : "";

      const comparison = aVal.localeCompare(bVal, "nl-NL", {
        numeric: true,
        sensitivity: "base",
      });

      return sortDirection === "ascending" ? comparison : -comparison;
    });
  }, [rows, sortColumn, sortDirection]);

  const getAriaSort = React.useCallback(
    (columnIndex: number): React.AriaAttributes["aria-sort"] => {
      if (!sortable || sortColumn !== columnIndex || !sortDirection) {
        return undefined;
      }
      return sortDirection;
    },
    [sortable, sortColumn, sortDirection]
  );

  return (
    <div className={cn("accessible-table-wrapper", className)}>
      {/* Desktop: standard table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b">
              {headers.map((header, index) => (
                <th
                  key={index}
                  scope="col"
                  aria-sort={getAriaSort(index)}
                  className={cn(
                    "h-10 px-4 text-left align-middle font-medium text-muted-foreground",
                    sortable && "cursor-pointer select-none hover:text-foreground transition-colors"
                  )}
                  onClick={sortable ? () => handleSort(index) : undefined}
                  onKeyDown={
                    sortable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSort(index);
                          }
                        }
                      : undefined
                  }
                  tabIndex={sortable ? 0 : undefined}
                  role={sortable ? "button" : undefined}
                  aria-label={
                    sortable
                      ? `${header}, sorteren op ${sortColumn === index && sortDirection === "ascending" ? "aflopend" : "oplopend"}`
                      : undefined
                  }
                >
                  <span className="flex items-center gap-1">
                    {header}
                    {sortable && sortColumn === index && sortDirection && (
                      <span aria-hidden="true" className="text-xs">
                        {sortDirection === "ascending" ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b transition-colors hover:bg-muted/50"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-3 align-middle"
                    data-label={headers[cellIndex]}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card layout */}
      <div className="md:hidden accessible-table-mobile">
        <div className="sr-only">{caption}</div>
        {sortedRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="accessible-table-card rounded-lg border p-4 mb-3 bg-card"
            role="group"
            aria-label={`Rij ${rowIndex + 1}`}
          >
            {row.map((cell, cellIndex) => (
              <div key={cellIndex} className="flex flex-col py-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {headers[cellIndex]}
                </span>
                <span className="text-sm">{cell}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
