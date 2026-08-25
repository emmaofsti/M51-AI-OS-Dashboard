"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { KPICard } from "@/components/KPICard";
import { ChartCard } from "@/components/ChartCard";
import { FunnelCard } from "@/components/FunnelCard";
import { SourceCard } from "@/components/SourceCard";
import { CustomerLifecycleCard } from "@/components/CustomerLifecycleCard";
import type { DashboardData } from "@/lib/mockData";

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");
  const [dealFilter, setDealFilter] = useState<"all" | "ai-os">("ai-os");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const fetchData = useCallback(async (
    signal?: AbortSignal,
    forceRefresh = false,
    background = false,
  ) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const url = `/api/dashboard-data?range=${dateRange}&dealFilter=${dealFilter}${forceRefresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setIsLive(true);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setIsLive(false);
      setError("Kunne ikke hente HubSpot-data. Ingen erstatningstall vises.");
    } finally {
      if (!background) setLoading(false);
    }
  }, [dateRange, dealFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = window.setInterval(() => {
      void fetchData(undefined, false, true);
    }, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [fetchData]);

  const lastUpdated = data?.lastUpdated
    ? new Intl.DateTimeFormat("no-NO", {
        timeZone: "Europe/Oslo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(data.lastUpdated))
    : null;

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
                {isLive ? "Live HubSpot-data" : "HubSpot-data utilgjengelig"}
              </span>
              {isLive && lastUpdated && (
                <>
                  <span className="text-xs text-muted-foreground/50">·</span>
                  <span className="text-xs text-muted-foreground">
                    Oppdatert kl. {lastUpdated}
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">
                Data fra {new Date().getFullYear()}
              </span>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {!data && loading && (
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array(5).fill(null).map((_, i) => <KPISkeleton key={i} />)}
          </section>
        )}

        {data && (
          <>

        <section className="mt-6">
          <CustomerLifecycleCard
            salesStages={data.customerLifecycle.salesStages}
            customerSuccessStages={data.customerLifecycle.customerSuccessStages}
            trackingMessage={data.customerLifecycle.trackingMessage}
          />
        </section>

        {/* Row 1 — revenue / won / lost */}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {loading ? (
              Array(6).fill(null).map((_, i) => <KPISkeleton key={i} />)
            ) : (
              <>
                <KPICard data={data.primaryKPIs.closingRate} />
                <KPICard data={data.primaryKPIs.activeTrials} />
                <KPICard data={data.primaryKPIs.trialConversion} />
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
              title={`Ny MRR per måned (${new Date().getFullYear()})`}
              data={data.mrrOverTime}
              valueFormat="currency"
              color="#10B981"
              variant="bar"
            />
            <div className="flex flex-col gap-2">
              <ChartCard
                title={
                  dateRange === "7d" ? "Møter booket (siste 7 dager)" :
                  dateRange === "90d" ? "Møter booket (siste 90 dager)" :
                  dateRange === "year" ? `Møter booket (${new Date().getFullYear()})` :
                  "Møter booket (siste 30 dager)"
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
            <FunnelCard title="Registrerte salgssteg i perioden" stages={data.funnelStages} />
          </div>
        </section>

        <div className="mt-8" />
          </>
        )}
      </div>
    </div>
  );
}
