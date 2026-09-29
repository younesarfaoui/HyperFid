"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDay } from "@/lib/format";

import { AXIS_TICK, DataTable, LegendItem, TooltipBox, TooltipRow } from "./chart-parts";

type Point = { day: string; new: number; returning: number; wins: number };

const NEW = "var(--series-1)";
const RETURNING = "var(--series-2)";

/** Daily scans, stacked: first visits vs returning customers. */
export function DailyScansChart({ data }: { data: Point[] }) {
  const total = data.reduce((sum, d) => sum + d.new + d.returning, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4" aria-label="Légende">
        <LegendItem color={NEW} label="Premières visites" />
        <LegendItem color={RETURNING} label="Clients fidèles" />
      </div>
      <div className="h-64 w-full" role="img" aria-label={`Scans quotidiens, ${total} au total sur la période`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDay}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ fill: "var(--card-2)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                return (
                  <TooltipBox title={formatDay(String(label))}>
                    <TooltipRow color={NEW} label="Premières visites" value={p.new} />
                    <TooltipRow color={RETURNING} label="Clients fidèles" value={p.returning} />
                    <TooltipRow label="Gains instantanés" value={p.wins} />
                  </TooltipBox>
                );
              }}
            />
            <Bar
              dataKey="new"
              stackId="scans"
              fill={NEW}
              stroke="var(--chart-surface)"
              strokeWidth={1}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="returning"
              stackId="scans"
              fill={RETURNING}
              stroke="var(--chart-surface)"
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        headers={["Jour", "Premières visites", "Clients fidèles", "Gains"]}
        rows={data.map((d) => [formatDay(d.day), d.new, d.returning, d.wins])}
      />
    </div>
  );
}
