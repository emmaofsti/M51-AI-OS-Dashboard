import { NextResponse, type NextRequest } from "next/server";
import {
  clearCache,
  fetchContactSourcesForDeals,
  fetchMeetingsForDeals,
  getCachedDashboardData,
  type HubSpotDeal,
  type HubSpotHistoryEntry,
  type HubSpotMeeting,
} from "@/lib/hubspot";
import {
  AI_OS_PATTERN,
  AI_OS_SERVICE,
  DISQUALIFIED_STAGES,
  LOST_STAGES,
  MEETING_BOOKED_STAGES,
  OFFER_SENT_STAGES,
  SALES_PIPELINE_ID,
  TRIAL_STAGES,
  WON_STAGES,
} from "@/lib/dashboardConfig";
import type { DashboardData } from "@/lib/mockData";
import { OWNER_NAMES } from "@/lib/ownerNames";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OSLO_TIME_ZONE = "Europe/Oslo";
const osloPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OSLO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface DealActivity {
  deal: HubSpotDeal;
  date: Date;
}

function osloParts(date: Date): DateParts {
  const values = Object.fromEntries(
    osloPartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as unknown as DateParts;
}

function osloOffsetMilliseconds(date: Date): number {
  const parts = osloParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function osloMidnight(year: number, month: number, day: number): Date {
  const normalized = new Date(Date.UTC(year, month - 1, day));
  const utcMidnight = Date.UTC(
    normalized.getUTCFullYear(),
    normalized.getUTCMonth(),
    normalized.getUTCDate(),
  );
  let result = utcMidnight - osloOffsetMilliseconds(new Date(utcMidnight));
  result = utcMidnight - osloOffsetMilliseconds(new Date(result));
  return new Date(result);
}

function addOsloDays(date: Date, days: number): Date {
  const parts = osloParts(date);
  return osloMidnight(parts.year, parts.month, parts.day + days);
}

function startOfOsloWeek(date: Date): Date {
  const parts = osloParts(date);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = utcDate.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return osloMidnight(parts.year, parts.month, parts.day - daysSinceMonday);
}

function getISOWeekAndYear(date: Date): { week: number; year: number } {
  const parts = osloParts(date);
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() + 4 - weekday);
  const isoYear = localDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((localDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return { week, year: isoYear };
}

function getDateRange(range: string) {
  const now = new Date();
  const current = osloParts(now);
  const todayStart = osloMidnight(current.year, current.month, current.day);

  if (range === "year") {
    const periodStart = osloMidnight(current.year, 1, 1);
    const prevPeriodStart = osloMidnight(current.year - 1, 1, 1);
    const prevPeriodEnd = new Date(periodStart.getTime() - 1);
    return {
      periodStart,
      prevPeriodStart,
      prevPeriodEnd,
      now,
      year: current.year,
    };
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const periodStart = addOsloDays(todayStart, -(days - 1));
  const prevPeriodEnd = new Date(periodStart.getTime() - 1);
  const prevPeriodStart = addOsloDays(periodStart, -days);
  return {
    periodStart,
    prevPeriodStart,
    prevPeriodEnd,
    now,
    year: current.year,
  };
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function historyFor(deal: HubSpotDeal): HubSpotHistoryEntry[] {
  const history = deal.propertiesWithHistory?.dealstage ?? [];
  if (history.length > 0) {
    return [...history].sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );
  }

  const stage = deal.properties.dealstage;
  const timestamp =
    deal.properties.closedate ??
    deal.properties.createdate ??
    deal.properties.hs_lastmodifieddate;
  return stage && timestamp ? [{ value: stage, timestamp }] : [];
}

function activitiesInPeriod(
  deals: HubSpotDeal[],
  stages: ReadonlySet<string>,
  start: Date,
  end: Date,
): DealActivity[] {
  const activities: DealActivity[] = [];
  for (const deal of deals) {
    const event = historyFor(deal).find((entry) => {
      const date = new Date(entry.timestamp);
      return stages.has(entry.value) && date >= start && date <= end;
    });
    if (event) activities.push({ deal, date: new Date(event.timestamp) });
  }
  return activities;
}

function firstHeldMeetingActivities(
  deals: HubSpotDeal[],
  meetingsByDeal: Map<string, HubSpotMeeting[]>,
  now: Date,
): DealActivity[] {
  return deals.flatMap((deal) => {
    const bookedAt = historyFor(deal).find((entry) =>
      MEETING_BOOKED_STAGES.has(entry.value),
    );
    if (!bookedAt) return [];
    const bookedDate = new Date(bookedAt.timestamp);
    const meeting = (meetingsByDeal.get(deal.id) ?? [])
      .filter((candidate) => {
        const outcome = candidate.properties.hs_meeting_outcome ?? "";
        if (["CANCELED", "NO_SHOW", "RESCHEDULED"].includes(outcome)) {
          return false;
        }
        const startValue =
          candidate.properties.hs_meeting_start_time ??
          candidate.properties.hs_timestamp;
        if (!startValue) return false;
        const start = new Date(startValue);
        const end = new Date(
          candidate.properties.hs_meeting_end_time ?? startValue,
        );
        return start >= bookedDate && end <= now;
      })
      .sort((left, right) => {
        const leftDate = new Date(
          left.properties.hs_meeting_start_time ??
            left.properties.hs_timestamp ??
            0,
        );
        const rightDate = new Date(
          right.properties.hs_meeting_start_time ??
            right.properties.hs_timestamp ??
            0,
        );
        return leftDate.getTime() - rightDate.getTime();
      })[0];
    if (!meeting) return [];
    const date = new Date(
      meeting.properties.hs_meeting_start_time ??
        meeting.properties.hs_timestamp ??
        0,
    );
    return [{ deal, date }];
  });
}

function trialConversionForCohort(
  deals: HubSpotDeal[],
  start: Date,
  end: Date,
): { rate: number; resolved: number; won: number; bounced: number } {
  const cohort = activitiesInPeriod(deals, TRIAL_STAGES, start, end);
  const resolved = cohort.filter(({ deal }) => {
    const stage = deal.properties.dealstage ?? "";
    return (
      WON_STAGES.has(stage) ||
      LOST_STAGES.has(stage) ||
      DISQUALIFIED_STAGES.has(stage)
    );
  });
  const won = resolved.filter(({ deal }) =>
    WON_STAGES.has(deal.properties.dealstage ?? ""),
  ).length;
  return {
    rate: resolved.length ? Math.round((won / resolved.length) * 100) : 0,
    resolved: resolved.length,
    won,
    bounced: resolved.length - won,
  };
}

function dealsCreatedInPeriod(
  deals: HubSpotDeal[],
  start: Date,
  end: Date,
): DealActivity[] {
  return deals.flatMap((deal) => {
    if (!deal.properties.createdate) return [];
    const date = new Date(deal.properties.createdate);
    return date >= start && date <= end ? [{ deal, date }] : [];
  });
}

function categorizeMeetingSource(src: string, d1: string, d2: string): string {
  if (d1.includes("webinar") || d2.includes("webinar")) return "Webinar";
  if (
    d1.includes("seminar") ||
    d1.includes("konferansen") ||
    d1.includes("julefest") ||
    d2.includes("seminar") ||
    d2.includes("konferanse")
  ) {
    return "Seminar / Event";
  }
  if (
    src === "EMAIL_MARKETING" ||
    d1 === "sequences" ||
    d1 === "hs_email" ||
    d1 === "email_integration" ||
    d2.includes("sequence")
  ) {
    return "E-post / Sekvens";
  }
  if (src === "PAID_SOCIAL" || src === "PAID_SEARCH") return "Betalt (ads)";
  if (src === "SOCIAL_MEDIA") return "Sosiale medier";
  if (src === "ORGANIC_SEARCH" || src === "REFERRALS" || src === "AI_REFERRALS") {
    return "Inbound";
  }
  if (src === "OFFLINE") return "Direkte salg";
  if (src === "DIRECT_TRAFFIC") return "Direkte kontakt";
  return "Ukjent";
}

const SOURCE_COLORS: Record<string, string> = {
  Webinar: "#3C6E71",
  "Seminar / Event": "#0EA5E9",
  "E-post / Sekvens": "#F59E0B",
  "Betalt (ads)": "#FF3B3D",
  "Sosiale medier": "#8B5CF6",
  Inbound: "#10B981",
  "Direkte salg": "#6366F1",
  "Direkte kontakt": "#9CA3AF",
  Ukjent: "#D1D5DB",
};

function periodText(range: string, year: number) {
  if (range === "7d") {
    return { label: "siste 7 dager", comparison: "mot forrige 7 dager" };
  }
  if (range === "90d") {
    return { label: "siste 90 dager", comparison: "mot forrige 90 dager" };
  }
  if (range === "year") {
    return { label: String(year), comparison: `mot ${year - 1}` };
  }
  return { label: "siste 30 dager", comparison: "mot forrige 30 dager" };
}

function isAiOsDeal(deal: HubSpotDeal): boolean {
  const services = (deal.properties.tjenester ?? "").split(";");
  return (
    services.includes(AI_OS_SERVICE) ||
    AI_OS_PATTERN.test(deal.properties.dealname ?? "")
  );
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("refresh") === "true") clearCache();

    const range = request.nextUrl.searchParams.get("range") ?? "30d";
    const dealFilter = request.nextUrl.searchParams.get("dealFilter") ?? "all";
    const { periodStart, prevPeriodStart, prevPeriodEnd, now, year } =
      getDateRange(range);
    const { deals, dealMRR, fetchedAt } = await getCachedDashboardData();

    // Every sales metric is scoped to the actual M51 sales pipeline. "Alle"
    // means all products in that pipeline, not Customer Success/partner deals.
    const salesDeals = deals.filter(
      (deal) => deal.properties.pipeline === SALES_PIPELINE_ID,
    );
    const filteredDeals =
      dealFilter === "ai-os"
        ? salesDeals.filter(isAiOsDeal)
        : salesDeals;
    const wonThisPeriod = activitiesInPeriod(
      filteredDeals,
      WON_STAGES,
      periodStart,
      now,
    );
    const meetingsThisPeriod = activitiesInPeriod(
      filteredDeals,
      MEETING_BOOKED_STAGES,
      periodStart,
      now,
    );
    const meetingsPrevPeriod = activitiesInPeriod(
      filteredDeals,
      MEETING_BOOKED_STAGES,
      prevPeriodStart,
      prevPeriodEnd,
    );
    const dealsWithDocumentedBooking = filteredDeals.filter((deal) =>
      historyFor(deal).some((entry) =>
        MEETING_BOOKED_STAGES.has(entry.value),
      ),
    );
    const meetingsByDeal = await fetchMeetingsForDeals(
      dealsWithDocumentedBooking.map((deal) => deal.id),
    );
    const heldMeetingActivities = firstHeldMeetingActivities(
      dealsWithDocumentedBooking,
      meetingsByDeal,
      now,
    );
    const meetingsHeldPeriod = heldMeetingActivities.filter(
      ({ date }) => date >= periodStart && date <= now,
    );
    const meetingsHeldPrev = heldMeetingActivities.filter(
      ({ date }) => date >= prevPeriodStart && date <= prevPeriodEnd,
    );
    const offersSentPeriod = activitiesInPeriod(
      filteredDeals,
      OFFER_SENT_STAGES,
      periodStart,
      now,
    );
    const offersSentPrev = activitiesInPeriod(
      filteredDeals,
      OFFER_SENT_STAGES,
      prevPeriodStart,
      prevPeriodEnd,
    );
    const trialsThisPeriod = activitiesInPeriod(
      filteredDeals,
      TRIAL_STAGES,
      periodStart,
      now,
    );
    const trialsPrevPeriod = activitiesInPeriod(
      filteredDeals,
      TRIAL_STAGES,
      prevPeriodStart,
      prevPeriodEnd,
    );
    const activeTrials = filteredDeals.filter((deal) =>
      TRIAL_STAGES.has(deal.properties.dealstage ?? ""),
    );
    const allWonDeals = filteredDeals.filter((deal) =>
      WON_STAGES.has(deal.properties.dealstage ?? ""),
    );
    const churnedCustomerDeals = filteredDeals.filter((deal) => {
      const currentStage = deal.properties.dealstage ?? "";
      return (
        LOST_STAGES.has(currentStage) &&
        historyFor(deal).some((entry) => WON_STAGES.has(entry.value))
      );
    });
    const trialConversion = trialConversionForCohort(
      filteredDeals,
      periodStart,
      now,
    );
    const prevTrialConversion = trialConversionForCohort(
      filteredDeals,
      prevPeriodStart,
      prevPeriodEnd,
    );

    const documentedMonthlyRevenue = (deal: HubSpotDeal): number => {
      const lineItemMRR = dealMRR.get(deal.id);
      if (lineItemMRR !== undefined && lineItemMRR > 0) return lineItemMRR;
      return Number.parseFloat(deal.properties.hs_mrr ?? "") || 0;
    };

    const activeCustomerDeals = allWonDeals.filter(
      (deal) => documentedMonthlyRevenue(deal) > 0,
    );
    const totalMRR = Math.round(
      activeCustomerDeals.reduce(
        (sum, deal) => sum + documentedMonthlyRevenue(deal),
        0,
      ),
    );
    const totalARR = totalMRR * 12;
    const potentialDeals = filteredDeals.filter((deal) => {
      const stage = deal.properties.dealstage ?? "";
      return TRIAL_STAGES.has(stage) || OFFER_SENT_STAGES.has(stage);
    });
    const valuedPotentialDeals = potentialDeals.filter(
      (deal) => documentedMonthlyRevenue(deal) > 0,
    );
    const potentialARR = Math.round(
      valuedPotentialDeals.reduce(
        (sum, deal) => sum + documentedMonthlyRevenue(deal) * 12,
        0,
      ),
    );
    // Closing rate is cohort-based: among deals whose first documented meeting
    // was held in the period, how many have since reached Won?
    const wonFromHeldMeetings = meetingsHeldPeriod.filter(({ deal }) =>
      historyFor(deal).some((entry) => WON_STAGES.has(entry.value)),
    );
    const wonFromHeldMeetingsPrev = meetingsHeldPrev.filter(({ deal }) =>
      historyFor(deal).some((entry) => WON_STAGES.has(entry.value)),
    );
    const closingRate = meetingsHeldPeriod.length
      ? Math.round((wonFromHeldMeetings.length / meetingsHeldPeriod.length) * 100)
      : 0;
    const prevClosingRate = meetingsHeldPrev.length
      ? Math.round(
          (wonFromHeldMeetingsPrev.length / meetingsHeldPrev.length) * 100,
        )
      : 0;

    const ownerCounts = new Map<string, number>();
    for (const { deal } of meetingsThisPeriod) {
      const ownerId = deal.properties.hubspot_owner_id;
      if (ownerId) ownerCounts.set(ownerId, (ownerCounts.get(ownerId) ?? 0) + 1);
    }
    const meetingsLeaderboard = [...ownerCounts]
      .map(([id, count]) => ({
        name: OWNER_NAMES[id] ?? `Bruker ${id}`,
        count,
      }))
      .sort((left, right) => right.count - left.count);

    const mrrOverTime = [];
    for (let month = 1; month <= osloParts(now).month; month += 1) {
      const monthStart = osloMidnight(year, month, 1);
      const monthEnd = new Date(osloMidnight(year, month + 1, 1).getTime() - 1);
      const wonInMonth = activitiesInPeriod(
        filteredDeals,
        WON_STAGES,
        monthStart,
        monthEnd > now ? now : monthEnd,
      );
      mrrOverTime.push({
        label: monthStart.toLocaleString("no-NO", {
          month: "short",
          timeZone: OSLO_TIME_ZONE,
        }),
        value: Math.round(
          wonInMonth.reduce(
            (sum, { deal }) => sum + documentedMonthlyRevenue(deal),
            0,
          ),
        ),
      });
    }

    const meetingsOverTime: Array<{ label: string; value: number }> = [];
    if (range === "7d") {
      for (let day = 0; day < 7; day += 1) {
        const start = addOsloDays(periodStart, day);
        const end = new Date(addOsloDays(start, 1).getTime() - 1);
        meetingsOverTime.push({
          label: start.toLocaleString("no-NO", {
            weekday: "short",
            timeZone: OSLO_TIME_ZONE,
          }),
          value: meetingsThisPeriod.filter(
            ({ date }) => date >= start && date <= end,
          ).length,
        });
      }
    } else if (range === "year") {
      for (let month = 1; month <= osloParts(now).month; month += 1) {
        const start = osloMidnight(year, month, 1);
        const end = new Date(osloMidnight(year, month + 1, 1).getTime() - 1);
        meetingsOverTime.push({
          label: start.toLocaleString("no-NO", {
            month: "short",
            timeZone: OSLO_TIME_ZONE,
          }),
          value: meetingsThisPeriod.filter(
            ({ date }) => date >= start && date <= end,
          ).length,
        });
      }
    } else {
      let weekStart = startOfOsloWeek(periodStart);
      while (weekStart <= now) {
        const weekEnd = new Date(addOsloDays(weekStart, 7).getTime() - 1);
        const iso = getISOWeekAndYear(weekStart);
        meetingsOverTime.push({
          label: iso.year < year ? `Uke ${iso.week} '${String(iso.year).slice(2)}` : `Uke ${iso.week}`,
          value: meetingsThisPeriod.filter(
            ({ date }) =>
              date >= periodStart && date >= weekStart && date <= weekEnd,
          ).length,
        });
        weekStart = addOsloDays(weekStart, 7);
      }
    }

    let contactSources = new Map<
      string,
      { src: string; d1: string; d2: string }
    >();
    try {
      contactSources = await fetchContactSourcesForDeals(
        meetingsThisPeriod.map(({ deal }) => deal.id),
      );
    } catch (error) {
      console.warn("Contact source fetch failed; using Unknown.", error);
    }

    const sourceCounts = new Map<string, number>();
    for (const { deal } of meetingsThisPeriod) {
      const source = contactSources.get(deal.id);
      const category = source
        ? categorizeMeetingSource(source.src, source.d1, source.d2)
        : "Ukjent";
      sourceCounts.set(category, (sourceCounts.get(category) ?? 0) + 1);
    }
    const meetingsBySource = [...sourceCounts]
      .map(([name, value]) => ({
        name,
        value,
        color: SOURCE_COLORS[name] ?? SOURCE_COLORS.Ukjent,
      }))
      .sort((left, right) => right.value - left.value);

    const leadsThisPeriod = dealsCreatedInPeriod(filteredDeals, periodStart, now);

    // These are independent, documented stage events in the selected period.
    // They intentionally have no between-stage conversion percentages because
    // self-serve trials and manually skipped stages are parallel paths.
    const funnelStages = [
      {
        name: "Nye deals",
        subtitle: "Deals opprettet i perioden",
        value: leadsThisPeriod.length,
      },
      {
        name: "Møte booket",
        value: meetingsThisPeriod.length,
      },
      {
        name: "Møte gjennomført",
        value: meetingsHeldPeriod.length,
      },
      {
        name: "Gratis prøveperiode startet",
        value: trialsThisPeriod.length,
      },
      {
        name: "Tilbud sendt",
        value: offersSentPeriod.length,
      },
      { name: "Vunnet", value: wonThisPeriod.length },
    ];

    const { label: periodLabel, comparison: comparisonLabel } = periodText(
      range,
      year,
    );
    const dashboardData: DashboardData = {
      lastUpdated: fetchedAt,
      primaryKPIs: {
        mrr: {
          label: "MRR",
          value: `${totalMRR.toLocaleString("no-NO")} kr`,
          trend: 0,
          trendLabel: "aktive betalende kunder",
        },
        arr: {
          label: "ARR",
          value: `${totalARR.toLocaleString("no-NO")} kr`,
          trend: 0,
          trendLabel: "MRR × 12",
        },
        potentialArr: {
          label: "Potensiell ny ARR",
          value: `${potentialARR.toLocaleString("no-NO")} kr`,
          trend: 0,
          trendLabel: `${valuedPotentialDeals.length} av ${potentialDeals.length} trials/tilbud har dokumentert MRR`,
        },
        customersChurned: {
          label: "Kunder sluttet",
          value: churnedCustomerDeals.length.toString(),
          trend: 0,
          trendLabel: "tidligere vunnet, nå tapt",
        },
        closingRate: {
          label: `Closing rate (${periodLabel})`,
          value: `${closingRate}%`,
          trend: closingRate - prevClosingRate,
          trendLabel: `${wonFromHeldMeetings.length} av ${meetingsHeldPeriod.length} gjennomførte møter`,
        },
        activeTrials: {
          label: "Aktive prøveperioder (nå)",
          value: activeTrials.length.toString(),
          trend: percentChange(trialsThisPeriod.length, trialsPrevPeriod.length),
          trendLabel: `${trialsThisPeriod.length} startet ${periodLabel} · ${comparisonLabel}`,
        },
        trialConversion: {
          label: `Trial → vunnet (${periodLabel})`,
          value: `${trialConversion.rate}%`,
          trend: trialConversion.rate - prevTrialConversion.rate,
          trendLabel: `${trialConversion.won} av ${trialConversion.resolved} avgjorte trials`,
        },
        trialBounce: {
          label: `Trial bounce (${periodLabel})`,
          value: trialConversion.resolved
            ? `${Math.round((trialConversion.bounced / trialConversion.resolved) * 100)}%`
            : "0%",
          trend: prevTrialConversion.resolved
            ? Math.round(
                (trialConversion.bounced / Math.max(trialConversion.resolved, 1)) * 100,
              ) -
              Math.round(
                (prevTrialConversion.bounced / prevTrialConversion.resolved) * 100,
              )
            : 0,
          trendLabel: `${trialConversion.bounced} av ${trialConversion.resolved} avgjorte trials`,
        },
      },
      meetingActivity: {
        weekly: {
          label: `Møte booket (${periodLabel})`,
          value: meetingsThisPeriod.length.toString(),
          trend: percentChange(meetingsThisPeriod.length, meetingsPrevPeriod.length),
          trendLabel: comparisonLabel,
        },
        monthly: {
          label: `Møte gjennomført (${periodLabel})`,
          value: meetingsHeldPeriod.length.toString(),
          trend: percentChange(meetingsHeldPeriod.length, meetingsHeldPrev.length),
          trendLabel: comparisonLabel,
        },
        yearly: {
          label: `Tilbud sendt (${periodLabel})`,
          value: offersSentPeriod.length.toString(),
          trend: percentChange(offersSentPeriod.length, offersSentPrev.length),
          trendLabel: comparisonLabel,
        },
      },
      mrrOverTime,
      meetingsOverTime,
      meetingsBySource,
      meetingsBookedTotal: meetingsThisPeriod.length,
      meetingsLeaderboard,
      funnelStages,
      customerLifecycle: {
        salesStages: [
          {
            key: "meeting",
            name: "Møte booket",
            subtitle: "Venter på møte eller neste steg",
            value: filteredDeals.filter((deal) =>
              MEETING_BOOKED_STAGES.has(deal.properties.dealstage ?? ""),
            ).length,
            tone: "blue",
          },
          {
            key: "trial",
            name: "Gratis prøveperiode",
            subtitle: "14 dager – ikke vunnet ennå",
            value: activeTrials.length,
            tone: "violet",
          },
          {
            key: "offer",
            name: "Tilbud sendt",
            subtitle: "Åpne tilbud som ikke er avgjort",
            value: filteredDeals.filter((deal) =>
              OFFER_SENT_STAGES.has(deal.properties.dealstage ?? ""),
            ).length,
            tone: "amber",
          },
        ],
        customerSuccessStages: [
          {
            key: "active",
            name: "Aktiv kunde",
            subtitle: "Vunnet deal med dokumentert MRR",
            value: activeCustomerDeals.length,
            tone: "teal",
          },
          {
            key: "churned",
            name: "Kunder sluttet",
            subtitle: "Tidligere vunnet deal som nå er tapt",
            value: churnedCustomerDeals.length,
            tone: "red",
          },
        ],
        trackingMessage: `${allWonDeals.length - activeCustomerDeals.length} vunne deals mangler dokumentert MRR og er derfor ikke tatt med som aktive kunder. «Kunder sluttet» teller bare deals som først var vunnet og senere ble flyttet til tapt.`,
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error: unknown) {
    console.error("Dashboard API error:", error);
    const message = error instanceof Error ? error.message : "Ukjent feil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
