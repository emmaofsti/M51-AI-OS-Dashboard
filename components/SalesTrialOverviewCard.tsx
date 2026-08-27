import {
  CalendarCheck,
  CheckCircle2,
  FlaskConical,
  Handshake,
  Trophy,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SalesTrialOverview } from "@/lib/mockData";

interface SalesTrialOverviewCardProps {
  data: SalesTrialOverview;
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-background/70 p-4">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">
        {value.toLocaleString("no-NO")}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function SalesTrialOverviewCard({ data }: SalesTrialOverviewCardProps) {
  return (
    <Card className="overflow-hidden bg-card shadow-sm">
      <CardHeader className="border-b px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Salg og 14 dager gratis</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              To separate løp, samlet på ett sted
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {data.periodLabel}
          </span>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-muted/35 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Handshake className="h-5 w-5 text-[#3C6E71]" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold">Møter til kunde</h3>
              <p className="text-xs text-muted-foreground">
                Closing beregnes kun fra gjennomførte møter
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Metric icon={CalendarCheck} label="Booket" value={data.meetingsBooked} />
            <Metric icon={CheckCircle2} label="Gjennomført" value={data.meetingsHeld} />
            <Metric icon={Trophy} label="Vunnet" value={data.wonFromMeetings} />
          </div>

          <div className="mt-4 rounded-xl border border-[#3C6E71]/20 bg-[#F2FAFA] p-4 dark:bg-[#1E2F30]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3C6E71] dark:text-[#8fc4c7]">
                  Closing rate
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.wonFromMeetings} av {data.meetingsHeld} gjennomførte møter
                </p>
              </div>
              <span className="text-4xl font-bold tabular-nums text-[#3C6E71] dark:text-[#8fc4c7]">
                {data.closingRate}%
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-violet-50/70 p-4 dark:bg-violet-950/20 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold">14 dager gratis</h3>
              <p className="text-xs text-muted-foreground">
                Teller ikke som vunnet eller MRR før konvertering
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Metric icon={FlaskConical} label="Aktive nå" value={data.activeTrials} />
            <Metric icon={CalendarCheck} label="Startet" value={data.trialsStarted} />
            <Metric icon={CheckCircle2} label="Avgjort" value={data.trialsResolved} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold">Konvertert</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{data.trialConversionRate}%</p>
              <p className="text-xs text-muted-foreground">{data.trialsWon} vunnet</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold">Bounce</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{data.trialBounceRate}%</p>
              <p className="text-xs text-muted-foreground">{data.trialsBounced} falt fra</p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
