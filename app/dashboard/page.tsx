"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { KPICard } from "@/components/KPICard";
import { ChartCard } from "@/components/ChartCard";
import { FunnelCard } from "@/components/FunnelCard";
import { SourceCard } from "@/components/SourceCard";
import { mockData, type DashboardData } from "@/lib/mockData";

function KPISkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm animate-pulse">
      <div className="h-4 w-32 rounded bg-muted mb-3" />
      <div className="h-8 w-24 rounded bg-muted mb-3" />
      <div className="h-4 w-20 rounded bg-muted" />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(mockData);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");
  const [dealFilter, setDealFilter] = useState<"all" | "ai-os">("ai-os");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const fetchData = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
    setLoading(true);
    try {
      const url = `/api/dashboard-data?range=${dateRange}&dealFilter=${dealFilter}${forceRefresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setIsLive(true);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setData(mockData);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [dateRange, dealFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <DashboardHeader
          onDateRangeChange={(range) => setDateRange(range)}
          onRefresh={() => fetchData(undefined, true)}
          dealFilter={dealFilter}
          onDealFilterChange={(f) => setDealFilter(f)}
        />

        {/* Data source indicator */}
        <div className="mt-3 flex items-center gap-2">
          {loading ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">Laster HubSpot-data…</span>
            </>
          ) : (
            <>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isLive ? "bg-green-500" : "bg-amber-400"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {isLive ? "Live HubSpot data" : "Mock data (API unavailable)"}
              </span>
              <span className="text-xs text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">
                All data from 2026
              </span>
            </>
          )}
        </div>

        {/* Row 1 — MRR / Potensiell ARR / Minimum ARR / Kunder vunnet / Tapte kunder */}
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {loading ? (
              Array(5).fill(null).map((_, i) => <KPISkeleton key={i} />)
            ) : (
              <>
                <KPICard data={data.primaryKPIs.mrr} />
                <KPICard data={data.primaryKPIs.arr} />
                <KPICard data={data.primaryKPIs.minArr} />
                <KPICard data={data.primaryKPIs.totalCustomers} />
                <KPICard data={data.churnAndRetention.customersLost} />
              </>
            )}
          </div>
        </section>

        {/* Row 2 — Salgsaktivitet */}
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {loading ? (
              Array(4).fill(null).map((_, i) => <KPISkeleton key={i} />)
            ) : (
              <>
                <KPICard data={data.primaryKPIs.closingRate} />
                <KPICard data={data.meetingActivity.weekly} />
                <KPICard data={data.meetingActivity.monthly} />
                <KPICard data={data.meetingActivity.yearly} />
              </>
            )}
          </div>
        </section>

        {/* Row 3 — Revenue + Meetings charts */}
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard
              title="Inntekt per måned (2026)"
              data={data.mrrOverTime}
              valueFormat="currency"
              color="#10B981"
              variant="bar"
            />
            <div className="flex flex-col gap-2">
              <ChartCard
                title={
                  dateRange === "7d" ? "Meetings booket (siste 7 dager)" :
                  dateRange === "90d" ? "Meetings booket (siste 90 dager)" :
                  dateRange === "year" ? "Meetings booket (2026)" :
                  "Meetings booket (siste 30 dager)"
                }
                data={data.meetingsOverTime}
                valueFormat="number"
                color="#3C6E71"
                variant="bar"
              />
              <button
                onClick={() => setShowLeaderboard(v => !v)}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-full">
                <span className="font-medium text-foreground">Hvem booket flest møter?</span>
                {showLeaderboard ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showLeaderboard && !loading && (
                <div className="rounded-lg border bg-card px-4 py-3">
                  {data.meetingsLeaderboard.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen data for perioden.</p>
                  ) : (
                    <ol className="space-y-2">
                      {data.meetingsLeaderboard.map((entry, i) => (
                        <li key={entry.name} className="flex items-center gap-3">
                          <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                          <span className="flex-1 text-sm font-medium text-foreground">{entry.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 rounded-full bg-[#3C6E71]/20 overflow-hidden" style={{ width: "80px" }}>
                              <div className="h-full rounded-full bg-[#3C6E71]"
                                style={{ width: `${Math.round((entry.count / data.meetingsLeaderboard[0].count) * 100)}%` }} />
                            </div>
                            <span className="text-sm font-semibold tabular-nums w-6 text-right">{entry.count}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Row 4 — Meeting source + Sales Funnel */}
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SourceCard
              title="Kilde til møtebookinger"
              items={data.meetingsBySource}
              total={loading ? 0 : data.meetingsBySource.reduce((s, i) => s + i.value, 0)}
            />
            <FunnelCard title="Sales Funnel" stages={data.funnelStages} />
          </div>
        </section>

        <div className="mt-8" />
      </div>
    </div>
  );
}
