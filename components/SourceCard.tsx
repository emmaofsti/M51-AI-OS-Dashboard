"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SourceBreakdownItem } from "@/lib/mockData";

interface SourceCardProps {
  title: string;
  items: SourceBreakdownItem[];
  total: number;
}

export function SourceCard({ title, items, total }: SourceCardProps) {
  if (items.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ingen data for perioden.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const barWidth = Math.max(pct, 4); // min 4% so bar is always visible
            return (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                    <span className="text-sm font-semibold w-6 text-right">{item.value}</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: item.color, opacity: 0.85 }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend total */}
        <p className="mt-4 text-xs text-muted-foreground text-right">
          Kilde registrert på {total} deals i perioden
        </p>
      </CardContent>
    </Card>
  );
}
