"use client";

import {
  BadgeCheck,
  CircleDollarSign,
  FlaskConical,
  RefreshCcw,
  Rocket,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CustomerStageData } from "@/lib/mockData";

interface CustomerLifecycleCardProps {
  salesStages: CustomerStageData[];
  customerSuccessStages: CustomerStageData[];
  trackingMessage: string;
}

const toneStyles: Record<CustomerStageData["tone"], string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  teal: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300",
  green: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300",
  lime: "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900 dark:bg-lime-950/30 dark:text-lime-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
};

const icons = {
  trial: FlaskConical,
  won: BadgeCheck,
  onboarding: Rocket,
  pilot: UsersRound,
  active: CircleDollarSign,
  renewal: RefreshCcw,
  churned: UserMinus,
};

function StageTile({ stage }: { stage: CustomerStageData }) {
  const Icon = icons[stage.key as keyof typeof icons] ?? UsersRound;

  return (
    <div className={`rounded-xl border p-4 ${toneStyles[stage.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-lg bg-white/70 p-2 shadow-sm dark:bg-black/20">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          {stage.value.toLocaleString("no-NO")}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{stage.name}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {stage.subtitle}
      </p>
    </div>
  );
}

export function CustomerLifecycleCard({
  salesStages,
  customerSuccessStages,
  trackingMessage,
}: CustomerLifecycleCardProps) {
  return (
    <Card className="overflow-hidden border-0 bg-card shadow-sm ring-1 ring-border">
      <CardHeader className="border-b bg-gradient-to-r from-[#151313] to-[#2d2929] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-[#BDED62]" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Kunder per HubSpot-steg</h2>
            </div>
            <p className="mt-1 text-sm text-white/65">
              Nåværende status, hentet direkte fra dealene i HubSpot
            </p>
          </div>
          <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">
            Live oversikt
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.8fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Salg</h3>
              <span className="text-xs text-muted-foreground">Salgspipeline</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {salesStages.map((stage) => (
                <StageTile key={stage.key} stage={stage} />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Kundereise</h3>
              <span className="text-xs text-muted-foreground">Customer Success</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {customerSuccessStages.map((stage) => (
                <StageTile key={stage.key} stage={stage} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          <p>{trackingMessage}</p>
        </div>
      </CardContent>
    </Card>
  );
}
