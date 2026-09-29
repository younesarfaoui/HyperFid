import type { ReactNode } from "react";

/** Legend swatch + text in ink tokens (identity is never color-alone). */
export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function TooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-ink">{title}</p>
      <div className="space-y-0.5 text-ink-2">{children}</div>
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      {color ? <span aria-hidden className="size-2 rounded-sm" style={{ backgroundColor: color }} /> : null}
      <span>{label}</span>
      <span className="ml-auto pl-3 font-medium tabular-nums text-ink">{value}</span>
    </p>
  );
}

/** Accessible table view of a chart's data. */
export function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-ink-2 hover:text-ink">
        Voir les données
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card-2 text-ink-2">
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums text-ink">
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };
