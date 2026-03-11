"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelStage } from "@/lib/mockData";

interface FunnelCardProps {
  title: string;
  stages: FunnelStage[];
}

// Logarithmic scale: prevents huge first-stage values (e.g. Leads=421) from
// squashing the rest of the funnel bars into invisibility.
// Formula: log(value+1) / log(max+1) × 100, floored at 8% so bars are always readable.
function logWidth(value: number, max: number): number {
  if (max <= 0) return 8;
  return Math.max((Math.log(value + 1) / Math.log(max + 1)) * 100, 8);
}

export function FunnelCard({ title, stages }: FunnelCardProps) {
  const maxValue = stages[0]?.value ?? 1;

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage, i) => {
            const widthPercent = logWidth(stage.value, maxValue);
            return (
              <div key={stage.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {stage.name}
                    </span>
                    {stage.subtitle && (
                      <p className="text-xs text-muted-foreground">{stage.subtitle}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {stage.value.toLocaleString()}
                  </span>
                </div>
                <div className="relative h-9 w-full overflow-hidden rounded-md bg-muted/50">
                  <div
                    className="flex h-full items-center rounded-md bg-primary/10 transition-all duration-500"
                    style={{ width: `${widthPercent}%` }}
                  >
                    <div
                      className="h-full rounded-md bg-primary/80"
                      style={{
                        width: "100%",
                        opacity: 1 - i * 0.15,
                      }}
                    />
                  </div>
                </div>
                {stage.conversionRate !== undefined && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className="text-muted-foreground/60"
                    >
                      <path
                        d="M6 2.5V9.5M6 9.5L3 6.5M6 9.5L9 6.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>
                      {stage.conversionRate}% conversion to{" "}
                      {stages[i + 1]?.name ?? "next stage"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
