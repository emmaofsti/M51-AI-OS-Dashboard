"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { KPIData } from "@/lib/mockData";

interface KPICardProps {
  data: KPIData;
}

export function KPICard({ data }: KPICardProps) {
  const isPositiveTrend = data.trend > 0;
  const isNeutralTrend = data.trend === 0;
  // For churn-related metrics, a negative trend is actually good
  const isChurnMetric =
    data.label.toLowerCase().includes("churn") ||
    data.label.toLowerCase().includes("lost") ||
    data.label.toLowerCase().includes("bounce");
  const isGood = isChurnMetric ? data.trend < 0 : isPositiveTrend;

  const trendDisplay = data.prefix
    ? `${data.prefix}${Math.abs(data.trend)}`
    : `${isPositiveTrend ? "+" : ""}${data.trend}%`;

  return (
    <Card className="bg-card">
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">
          {data.label}
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-urbanist), sans-serif" }}>
          {data.value}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`text-sm font-medium ${
              isNeutralTrend
                ? "text-muted-foreground"
                : isGood
                  ? "text-green-600"
                  : "text-red-500"
            }`}
          >
            {isNeutralTrend ? "\u2192" : isPositiveTrend ? "\u2191" : "\u2193"} {trendDisplay}
          </span>
          <span className="text-sm text-muted-foreground">
            {data.trendLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
