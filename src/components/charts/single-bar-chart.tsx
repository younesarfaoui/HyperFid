"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatInt } from "@/lib/format";

import { AXIS_TICK, DataTable, TooltipBox, TooltipRow } from "./chart-parts";

type Row = { label: string; value: number };

/**
 * One series → one color (slot 1), no legend box: the card title names it.
 * `horizontal` suits long category names (e.g. merchants).
 */
export function SingleBarChart({
  data,
  valueLabel,
  horizontal = false,
  height = 240,
}: {
  data: Row[];
  valueLabel: string;
  horizontal?: boolean;
  height?: number;
}) {
  const color = "var(--series-1)";

  return (
    <div>
      <div className="w-full" style={{ height }} role="img" aria-label={valueLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={horizontal ? { top: 0, right: 40, bottom: 0, left: 0 } : { top: 20, right: 4, bottom: 0, left: -16 }}
          >
            <CartesianGrid
              horizontal={!horizontal}
              vertical={horizontal}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            {horizontal ? (
              <>
                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ ...AXIS_TICK, fill: "var(--ink-2)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--axis)" }}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  tick={{ ...AXIS_TICK, fill: "var(--ink-2)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--axis)" }}
                />
                <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
              </>
            )}
            <Tooltip
              cursor={{ fill: "var(--card-2)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                return (
                  <TooltipBox title={row.label}>
                    <TooltipRow color={color} label={valueLabel} value={formatInt(row.value)} />
                  </TooltipBox>
                );
              }}
            />
            <Bar
              dataKey="value"
              fill={color}
              maxBarSize={24}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="value"
                position={horizontal ? "right" : "top"}
                style={{ fill: "var(--ink-2)", fontSize: 11 }}
                formatter={(v: unknown) => formatInt(Number(v))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable headers={["", valueLabel]} rows={data.map((d) => [d.label, d.value])} />
    </div>
  );
}
