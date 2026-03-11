"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from "recharts";
import type { ChartDataPoint } from "@/lib/mockData";

interface ChartCardProps {
  title: string;
  data: ChartDataPoint[];
  /** "currency" formats Y-axis as kr, "number" leaves it plain */
  valueFormat?: "currency" | "number";
  color?: string;
  variant?: "line" | "area" | "bar";
}

function formatValue(value: number, format: "currency" | "number") {
  if (format === "currency") {
    return `${(value / 1000).toFixed(0)}k kr`;
  }
  return value.toString();
}

export function ChartCard({
  title,
  data,
  valueFormat = "number",
  color = "#0ea5e9",
  variant = "area",
}: ChartCardProps) {
  const ChartComponent = variant === "area" ? AreaChart : variant === "bar" ? BarChart : LineChart;

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={data}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                tickFormatter={(v) => formatValue(v, valueFormat)}
                dx={-4}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                  fontSize: "13px",
                }}
                formatter={(value: number | undefined) => [
                  formatValue(value ?? 0, valueFormat),
                  "",
                ]}
              />
              {variant === "area" ? (
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.5}
                  fill={`url(#gradient-${title})`}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }}
                />
              ) : variant === "bar" ? (
                <Bar
                  dataKey="value"
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }}
                />
              )}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
