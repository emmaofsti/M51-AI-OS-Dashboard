import { NextResponse, type NextRequest } from "next/server";
import { getCachedDashboardData, clearCache, fetchContactSourcesForDeals } from "@/lib/hubspot";
import type { DashboardData } from "@/lib/mockData";
import { OWNER_NAMES } from "@/lib/ownerNames";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel max for Hobby plan — HubSpot fetch can take 5–15s

// --- Date range helpers ---
// Use explicit UTC midnight for Norwegian "start of day" (CET = UTC+1 in winter)
// This ensures consistent results regardless of where the server runs (local CET vs Vercel UTC)
const YEAR_START_2026  = new Date("2025-12-31T23:00:00Z"); // Jan  1 00:00 CET
const YEAR_START_2025  = new Date("2024-12-31T23:00:00Z"); // Jan  1 00:00 CET 2025
const YEAR_END_2025    = new Date("2025-12-31T22:59:59Z"); // Dec 31 23:59 CET 2025

function getDateRange(range: string) {
  const now = new Date();
  const yearStart = YEAR_START_2026;

  let periodStart: Date;
  let prevPeriodStart: Date;
  let prevPeriodEnd: Date;

  if (range === "7d") {
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);
    prevPeriodEnd = new Date(periodStart);
    prevPeriodStart = new Date(prevPeriodEnd);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
  } else if (range === "90d") {
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 90);
    prevPeriodEnd = new Date(periodStart);
    prevPeriodStart = new Date(prevPeriodEnd);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - 90);
  } else if (range === "year") {
    periodStart = yearStart;
    prevPeriodStart = YEAR_START_2025;
    prevPeriodEnd   = YEAR_END_2025;
  } else {
    // default 30d
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 30);
    prevPeriodEnd = new Date(periodStart);
    prevPeriodStart = new Date(prevPeriodEnd);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - 30);
  }

  // Clamp to 2026
  if (periodStart < yearStart) periodStart = yearStart;
  if (prevPeriodStart < yearStart) prevPeriodStart = yearStart;

  return { periodStart, prevPeriodStart, prevPeriodEnd, now };
}

// --- Stage ID mapping across all M51 pipelines ---
const WON_STAGES = new Set([
  "closedwon",             // M51-Pipe
  "1499916",               // Salg: Vunnet
  "918641",                // Eirik test: Kontrakt vunnet
  "1090547557",            // M51-2025: Closed Won
  "18284046",              // Byrå på tur: Vunnet
  "13114424",              // Innovation Support: Vunnet
  "deal_registration_closed_won", // HubSpot Shared
]);

const LOST_STAGES = new Set([
  "closedlost",            // M51-Pipe
  "1499917",               // Salg: Tapt
  "918642",                // Eirik test: Kontrakt tapt
  "1090547558",            // M51-2025: Closed Lost
  "18298898",              // Byrå på tur: Tapt
  "1090547555",            // M51-2025: Ikke aktuelt
  "11359580",              // Innovation Support: Ikke aktuelt
  "deal_registration_closed_lost", // HubSpot Shared
]);

const MEETING_BOOKED_STAGES = new Set([
  "appointmentscheduled",  // M51-Pipe
  "1499914",               // Salg: Møte booket
  "918638",                // Eirik test: Møte booket
  "1090547553",            // M51-2025: Møte booket
  "18284044",              // Byrå på tur: Møte booket
  "11374877",              // Innovation Support: Møte booket
  "13060019",              // Asgeir: Møte booket
]);

const MEETING_HELD_STAGES = new Set([
  "presentationscheduled", // M51-Pipe
  "19052976",              // Salg: Møte gjennomført
  "918639",                // Eirik test: Møte gjennomført
  "1090547554",            // M51-2025: Møte gjennomført
  "13078631",              // Innovation Support: Møte gjennomført
]);

const OFFER_SENT_STAGES = new Set([
  "1499915",               // Salg: Tilbud sendt
  "918640",                // Eirik test: Tilbud sendt
  "9b4b0b98-bb9d-4bbc-9f3b-09fc6a6571fd", // M51-Pipe: Tilbud sendt
  "1090547556",            // M51-2025: Contract Sent
  "18284045",              // Byrå på tur: Tilbud sendt
]);

// A deal has "progressed" if it reached meeting held or beyond
function hasReachedStage(stage: string, minStage: "booked" | "held" | "offer" | "won"): boolean {
  if (minStage === "won") return WON_STAGES.has(stage);
  if (minStage === "offer") return WON_STAGES.has(stage) || OFFER_SENT_STAGES.has(stage);
  if (minStage === "held") return WON_STAGES.has(stage) || OFFER_SENT_STAGES.has(stage) || MEETING_HELD_STAGES.has(stage);
  // booked
  return WON_STAGES.has(stage) || OFFER_SENT_STAGES.has(stage) || MEETING_HELD_STAGES.has(stage) || MEETING_BOOKED_STAGES.has(stage);
}

// --- Date helpers ---
function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getISOWeekAndYear(date: Date): { week: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const year = d.getFullYear(); // ISO year — may differ from calendar year at boundaries
  const week1 = new Date(year, 0, 4);
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { week, year };
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
    if (forceRefresh) clearCache();
    const { deals, contacts, meetings, owners, dealMRR } = await getCachedDashboardData();

    const range = request.nextUrl.searchParams.get("range") || "30d";
    const dealFilter = request.nextUrl.searchParams.get("dealFilter") || "all";
    const { periodStart, prevPeriodStart, prevPeriodEnd, now } = getDateRange(range);
    const yearStart = YEAR_START_2026;
    const weekStart = startOfWeek(now); // used for meetingsOverTime chart

    // Filter locally: include deals relevant to 2026.
    // closedate >= 2026 catches deals created pre-2026 but won in 2026 (e.g. Activeon).
    // createdate >= 2026 catches new deals created this year.
    const deals2026base = deals.filter((d: any) => {
      const closedate = d.properties.closedate ? new Date(d.properties.closedate) : null;
      const createdate = d.properties.createdate ? new Date(d.properties.createdate) : null;
      return (closedate && closedate >= yearStart) || (createdate && createdate >= yearStart);
    });

    // Apply deal type filter: "ai-os" shows only M51 AI OS deals.
    // These are deals whose name contains any of the M51 AI OS product tiers/types:
    // "AI OS", "Pilotkunde" / "Pilot", "Pro", "Starter", "Enterprise", "Agency"
    // Matches deal names that belong to the M51 AI OS product line:
    // "AI OS", any pilot variant, or product tiers (Pro / Starter / Enterprise / Agency / X)
    const AI_OS_PATTERN = /ai.?os|pil{1,2}ot|\bpro\b|\bstarter\b|\benterprise\b|\bagency\b|\bdemo\b|\bx\b/i;
    const deals2026 = dealFilter === "ai-os"
      ? deals2026base.filter((d: any) =>
          AI_OS_PATTERN.test(d.properties.dealname ?? "")
        )
      : deals2026base;

    // --- Categorize by stage ---
    const wonDeals = deals2026.filter((d: any) => WON_STAGES.has(d.properties.dealstage));
    const lostDeals = deals2026.filter((d: any) => LOST_STAGES.has(d.properties.dealstage));



    // Won this period vs prev period.
    // Use closedate if set; fall back to createdate for deals created directly as Won.
    const wonDate = (d: any) =>
      new Date(d.properties.closedate ?? d.properties.createdate);
    const wonThisPeriod = wonDeals.filter((d: any) => wonDate(d) >= periodStart);
    const wonPrevPeriod = wonDeals.filter(
      (d: any) => wonDate(d) >= prevPeriodStart && wonDate(d) <= prevPeriodEnd
    );
    // MRR per deal: bruk line item-sum hvis tilgjengelig (monthly priser bekreftet).
    // Fallback: pilot = monthly amount, andre = årsverdi / 12.
    const toMonthly = (d: any): number => {
      const lineItemMRR = (dealMRR as Map<string, number> | undefined)?.get?.(d.id);
      if (lineItemMRR !== undefined && lineItemMRR > 0) return lineItemMRR;
      const amount = parseFloat(d.properties.amount) || 0;
      return /pil{1,2}ot/i.test(d.properties.dealname ?? "") ? amount : amount / 12;
    };

const totalMRR = Math.round(wonDeals.reduce((s: number, d: any) => s + toMonthly(d), 0));
    const totalARR = totalMRR * 12;
    const totalMinARR = totalMRR * 3;

    // Ny MRR denne perioden vs forrige (for trend-pil)
    const newMRRThisPeriod = wonThisPeriod.reduce((s: number, d: any) => s + toMonthly(d), 0);
    const newMRRPrevPeriod = wonPrevPeriod.reduce((s: number, d: any) => s + toMonthly(d), 0);
    const mrrTrend = percentChange(newMRRThisPeriod, newMRRPrevPeriod);

    // --- Customers ---
    const totalCustomers = wonDeals.length;
    const customersThisPeriod = wonThisPeriod.length;

    // lostThisPeriod brukes i churn-seksjonen
    const lostThisPeriod = lostDeals.filter(
      (d: any) => new Date(d.properties.closedate) >= periodStart
    );
    // Closing rate beregnes etter meetingsHeldPeriod er definert (se lenger nede)

    // --- Meetings: HubSpot meeting activities filtered by title keywords ---
    // Counts actual calendar meetings logged in HubSpot where the title contains
    // one of: "demo", "agenter", "ai", "m51" — these are M51 sales/discovery meetings.
    // hs_timestamp = when the meeting is scheduled (used as the meeting date).
    const MEETING_TITLE_PATTERN = /demo|agenter|\bai\b|m51/i;
    // Exclude recurring customer meetings, events, and check-ins that aren't AI OS sales meetings:
    // - "månedsmøte"   → monthly check-ins with existing customers
    // - "frokostseminar" / "seminar" → external events / breakfast seminars
    // - "styremøte"    → board meetings
    // - "m51 //"       → M51-initiated existing-customer meetings (M51 on the left of "//")
    const MEETING_EXCLUDE_PATTERN = /månedsmøte|frokostseminar|\bstyremøte\b|m51\s*\/\//i;

    // bookedDate = when the meeting was created/logged in HubSpot (when it was "booked")
    // meetingDate = when the meeting actually takes place (hs_timestamp)
    // These two dates are used for different KPIs:
    //   "Møte booket"      → bookedDate (pipeline activity: when did we schedule this?)
    //   "Møte gjennomført" → meetingDate, capped at now (when did it actually happen?)
    const bookedDate = (m: any) => new Date(m.properties.hs_createdate);
    const meetingDate = (m: any) =>
      new Date(m.properties.hs_timestamp ?? m.properties.hs_meeting_start_time);

    // AI OS sales meetings only started in week 8-9 (mid-Feb 2026).
    // Meetings before this date match the same keywords ("demo", "AI", "agenter", "M51")
    // but are unrelated M51 agency/marketing work — not AI OS pipeline activity.
    // We clamp all meeting-based metrics to this floor so 90d/year views aren't inflated.
    const AI_OS_MEETINGS_START = new Date("2026-02-15T23:00:00Z"); // Feb 16 00:00 CET (UTC+1)
    const meetingsFloor = (d: Date) => d > AI_OS_MEETINGS_START ? d : AI_OS_MEETINGS_START;

    const salesMeetings2026 = meetings.filter((m: any) => {
      const title = m.properties.hs_meeting_title ?? "";
      return MEETING_TITLE_PATTERN.test(title) && !MEETING_EXCLUDE_PATTERN.test(title);
    });

    // "Booket" = meeting was created/added to the calendar in this period
    // Møte-KPI-ene (booket/gjennomført) bruker alltid alle salgsmøter uavhengig av deal-filter
    const meetingsThisPeriod = salesMeetings2026.filter(
      (m: any) => bookedDate(m) >= meetingsFloor(periodStart)
    );
    const meetingsPrevPeriod = salesMeetings2026.filter(
      (m: any) => bookedDate(m) >= meetingsFloor(prevPeriodStart) && bookedDate(m) <= prevPeriodEnd
    );

    // --- Meetings leaderboard: who booked the most meetings this period ---
    const ownerMap = new Map<string, string>();
    for (const o of (owners ?? [])) {
      // v2 uses ownerId, v3 uses id
      const id = String(o.ownerId ?? o.id);
      // v2 uses firstName/lastName, v3 same
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `Bruker ${id}`;
      ownerMap.set(id, name);
    }
    const ownerCounts: Record<string, number> = {};
    for (const m of meetingsThisPeriod) {
      const ownerId = m.properties.hubspot_owner_id;
      if (ownerId) ownerCounts[ownerId] = (ownerCounts[ownerId] ?? 0) + 1;
    }
    const meetingsLeaderboard = Object.entries(ownerCounts)
      .map(([id, count]) => ({
        name: ownerMap.get(id) ?? OWNER_NAMES[id] ?? `Bruker ${id}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // --- Revenue over time (monthly in 2026) ---
    const mrrOverTime = [];
    for (let m = 0; m <= now.getMonth(); m++) {
      const mStart = new Date(2026, m, 1);
      const mEnd = new Date(2026, m + 1, 0, 23, 59, 59);
      const label = mStart.toLocaleString("en", { month: "short" });
      const monthRevenue = wonDeals
        .filter(
          (d: any) =>
            new Date(d.properties.closedate) >= mStart &&
            new Date(d.properties.closedate) <= mEnd
        )
        .reduce((s: number, d: any) => s + toMonthly(d), 0);
      mrrOverTime.push({ label, value: Math.round(monthRevenue) });
    }

    // --- Meetings over time (granularity adapts to selected range) ---
    const meetingsOverTime: { label: string; value: number }[] = [];

    if (range === "7d") {
      // Daily — last 7 days: grouped by when the meeting was BOOKED (hs_createdate)
      // Use CET (UTC+1) day boundaries so days align with Norwegian midnight,
      // regardless of whether the server runs in UTC (Vercel) or CET (local dev).
      const CET_OFFSET_MS = 60 * 60 * 1000; // UTC+1
      for (let i = 6; i >= 0; i--) {
        // Compute the Norwegian calendar date for this iteration
        const nowInCET = new Date(now.getTime() + CET_OFFSET_MS);
        const cetDay = new Date(nowInCET);
        cetDay.setUTCDate(cetDay.getUTCDate() - i);
        cetDay.setUTCHours(0, 0, 0, 0);
        // Convert CET midnight back to UTC for filtering
        const day = new Date(cetDay.getTime() - CET_OFFSET_MS);
        const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1);
        const label = cetDay.toLocaleString("no", { weekday: "short" });
        const count = salesMeetings2026.filter((m: any) => {
          const d = bookedDate(m);
          return d >= AI_OS_MEETINGS_START && d >= day && d <= dayEnd;
        }).length;
        meetingsOverTime.push({ label, value: count });
      }
    } else if (range === "year") {
      // Monthly — each month of 2026 so far: grouped by when the meeting was BOOKED
      for (let m = 0; m <= now.getMonth(); m++) {
        const mStart = new Date(2026, m, 1);
        const mEnd = new Date(2026, m + 1, 0, 23, 59, 59);
        const label = mStart.toLocaleString("no", { month: "short" });
        const count = salesMeetings2026.filter((mtg: any) => {
          const d = bookedDate(mtg);
          return d >= AI_OS_MEETINGS_START && d >= mStart && d <= mEnd;
        }).length;
        meetingsOverTime.push({ label, value: count });
      }
    } else {
      // Weekly — for 30d or 90d: grouped by when the meeting was BOOKED
      const days = range === "90d" ? 90 : 30;
      const periodStartDate = new Date(now);
      periodStartDate.setDate(periodStartDate.getDate() - days);
      // Start from AI_OS_MEETINGS_START or first week of 2026, whichever is later
      const clampedStart = periodStartDate < AI_OS_MEETINGS_START ? AI_OS_MEETINGS_START : periodStartDate;
      let wStart = startOfWeek(clampedStart);
      while (wStart <= now) {
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 7);
        const { week: isoWeek, year: isoYear } = getISOWeekAndYear(wStart);
        const label = isoYear < now.getFullYear() ? `Uke ${isoWeek} '${String(isoYear).slice(2)}` : `Uke ${isoWeek}`;
        const count = salesMeetings2026.filter((m: any) => {
          const d = bookedDate(m);
          return d >= AI_OS_MEETINGS_START && d >= wStart && d < wEnd;
        }).length;
        meetingsOverTime.push({ label, value: count });
        wStart = new Date(wEnd);
      }
    }

    // --- Meeting source breakdown ---
    // Uses hs_latest_source from the contact associated with the deal (more accurate than deal-level source).
    // Categorises each meeting-booked deal into a human-readable channel bucket.
    function categorizeMeetingSource(src: string, d1: string, d2: string): string {

      if (d1.includes("webinar") || d2.includes("webinar")) return "Webinar";
      if (
        d1.includes("seminar") ||
        d1.includes("konferansen") ||
        d1.includes("julefest") ||
        d2.includes("seminar") ||
        d2.includes("konferanse")
      )
        return "Seminar / Event";
      if (
        src === "EMAIL_MARKETING" ||
        d1 === "sequences" ||
        d1 === "hs_email" ||
        d1 === "email_integration" ||
        d2.includes("sequence")
      )
        return "E-post / Sekvens";
      if (src === "PAID_SOCIAL" || src === "PAID_SEARCH") return "Betalt (ads)";
      if (src === "SOCIAL_MEDIA") return "Sosiale medier";
      if (src === "ORGANIC_SEARCH" || src === "REFERRALS" || src === "AI_REFERRALS")
        return "Inbound";
      if (src === "OFFLINE") return "Direkte salg";
      if (src === "DIRECT_TRAFFIC") return "Direkte kontakt";
      return "Ukjent";
    }

    const SOURCE_COLORS: Record<string, string> = {
      "Webinar":          "#3C6E71",
      "Seminar / Event":  "#0EA5E9",
      "E-post / Sekvens": "#F59E0B",
      "Betalt (ads)":     "#FF3B3D",
      "Sosiale medier":   "#8B5CF6",
      "Inbound":          "#10B981",
      "Direkte salg":     "#6366F1",
      "Direkte kontakt":  "#9CA3AF",
      "Ukjent":           "#D1D5DB",
    };

    // periodDeals: deals created in the selected period (also used for pipeline KPI and source breakdown)
    const periodDeals = range === "year" ? deals2026 : deals2026.filter(
      (d: any) => new Date(d.properties.createdate) >= periodStart
    );

    // Count by source for deals that have reached the meeting-booked stage in the period.
    // Source is fetched from the associated contact's hs_latest_source for better accuracy.
    const sourceDeals = periodDeals.filter((d: any) =>
      hasReachedStage(d.properties.dealstage, "booked")
    );
    const contactSources = await fetchContactSourcesForDeals(sourceDeals.map((d: any) => d.id));
    const sourceCounts: Record<string, number> = {};
    for (const d of sourceDeals) {
      const cs = contactSources.get(d.id);
      const cat = cs
        ? categorizeMeetingSource(cs.src, cs.d1, cs.d2)
        : "Ukjent";
      sourceCounts[cat] = (sourceCounts[cat] ?? 0) + 1;
    }

    const meetingsBySource = Object.entries(sourceCounts)
      .map(([name, value]) => ({ name, value, color: SOURCE_COLORS[name] ?? "#D1D5DB" }))
      .sort((a, b) => b.value - a.value);

    // funnelStages computed below, after meetingsHeldPeriod + offersSentPeriod are defined

    // --- Churn ---
    const lostInPeriod = lostThisPeriod.length;
    const lostInPrevPeriod = lostDeals.filter(
      (d: any) =>
        new Date(d.properties.closedate) >= prevPeriodStart &&
        new Date(d.properties.closedate) <= prevPeriodEnd
    ).length;
    const churnRate =
      totalCustomers > 0
        ? Math.round((lostInPeriod / totalCustomers) * 1000) / 10
        : 0;
    const prevChurnRate =
      totalCustomers > 0
        ? Math.round((lostInPrevPeriod / totalCustomers) * 1000) / 10
        : 0;

    // 3-month retention
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const wonBeforeThreeMonths = wonDeals.filter(
      (d: any) =>
        new Date(d.properties.closedate) >= yearStart &&
        new Date(d.properties.closedate) <= threeMonthsAgo
    ).length;
    const lostSinceThen = lostDeals.filter(
      (d: any) => new Date(d.properties.closedate) >= threeMonthsAgo
    ).length;
    const retention =
      wonBeforeThreeMonths > 0
        ? Math.round(((wonBeforeThreeMonths - lostSinceThen) / wonBeforeThreeMonths) * 100)
        : totalCustomers > 0 ? 100 : 0;

    // Period labels
    const periodLabel =
      range === "7d" ? "Last 7 Days" :
      range === "90d" ? "Last 90 Days" :
      range === "year" ? "2026" : "Last 30 Days";
    const vsLabel =
      range === "7d" ? "vs prev 7 days" :
      range === "90d" ? "vs prev 90 days" :
      range === "year" ? "vs 2025" : "vs prev 30 days";

    // --- Deals in pipeline (active, period) ---
    const pipelineDeals = periodDeals.filter(
      (d: any) => !WON_STAGES.has(d.properties.dealstage) && !LOST_STAGES.has(d.properties.dealstage)
    );
    const prevPipelineDeals = deals2026.filter(
      (d: any) =>
        new Date(d.properties.createdate) >= prevPeriodStart &&
        new Date(d.properties.createdate) <= prevPeriodEnd &&
        !WON_STAGES.has(d.properties.dealstage) &&
        !LOST_STAGES.has(d.properties.dealstage)
    );

    // --- Meetings held: sales meetings where hs_timestamp is in the past ---
    // Using calendar data (HubSpot meeting activities) is more accurate than deal stages.
    // A meeting is "held" if it took place in the period (>= floor) AND hs_timestamp < now.
    const meetingsHeldPeriod = salesMeetings2026.filter(
      (m: any) => meetingDate(m) >= meetingsFloor(periodStart) && meetingDate(m) <= now
    );
    const meetingsHeldPrev = salesMeetings2026.filter(
      (m: any) => meetingDate(m) >= meetingsFloor(prevPeriodStart) && meetingDate(m) <= prevPeriodEnd
    );
    // --- Closing Rate: Kunder vunnet / Møte gjennomført i perioden ---
    // Mer meningsfull for M51 enn won/(won+lost) siden closedate sjelden settes på tapte deals
    const closingRate = meetingsHeldPeriod.length > 0
      ? Math.round((wonThisPeriod.length / meetingsHeldPeriod.length) * 100)
      : 0;
    const prevClosingRate = meetingsHeldPrev.length > 0
      ? Math.round((wonPrevPeriod.length / meetingsHeldPrev.length) * 100)
      : 0;

    // --- Tilbud sendt: deals that have REACHED the offer stage (currently there, or progressed to won) ---
    // Previous logic only counted deals currently stuck in the offer stage, missing deals that
    // moved on to Vunnet. Now we count both:
    //   - Deals still in OFFER_SENT_STAGES: use hs_lastmodifieddate as proxy for when offer was sent
    //   - Deals in WON_STAGES: use closedate (they must have received an offer before winning)
    const hasReachedOffer = (d: any) =>
      OFFER_SENT_STAGES.has(d.properties.dealstage) || WON_STAGES.has(d.properties.dealstage);

    const offersSentPeriod = deals2026.filter((d: any) => {
      if (!hasReachedOffer(d)) return false;
      if (WON_STAGES.has(d.properties.dealstage)) return wonDate(d) >= periodStart;
      return new Date(d.properties.hs_lastmodifieddate) >= periodStart;
    });
    const offersSentPrev = deals2026.filter((d: any) => {
      if (!hasReachedOffer(d)) return false;
      if (WON_STAGES.has(d.properties.dealstage)) {
        const d_ = wonDate(d);
        return d_ >= prevPeriodStart && d_ <= prevPeriodEnd;
      }
      const lastMod = new Date(d.properties.hs_lastmodifieddate);
      return lastMod >= prevPeriodStart && lastMod <= prevPeriodEnd;
    });

    // --- Funnel — mirrors the KPI cards exactly ---
    // Uses the same data sources as the KPI row so numbers are always consistent:
    //   Leads           → HubSpot contacts created in period
    //   Møte booket     → meetingsThisPeriod  (calendar meetings CREATED in period)
    //   Møte gjennomf.  → meetingsHeldPeriod  (calendar meetings that have HAPPENED)
    //   Tilbud sendt    → offersSentPeriod    (deals that reached offer stage)
    //   Vunnet          → wonThisPeriod       (won deals)
    const periodContacts = range === "year" ? contacts : contacts.filter(
      (c: any) => new Date(c.properties.createdate) >= periodStart
    );
    const totalLeads  = periodContacts.length;
    const funnelBooked = meetingsThisPeriod.length;
    const funnelHeld   = meetingsHeldPeriod.length;
    const funnelOffer  = offersSentPeriod.length;
    const funnelWon    = wonThisPeriod.length;

    const funnelStages = [
      {
        name: "Leads",
        subtitle: "Nye HubSpot-kontakter opprettet i perioden",
        value: totalLeads,
        conversionRate: totalLeads > 0 ? Math.round((funnelBooked / totalLeads) * 1000) / 10 : 0,
      },
      {
        name: "Møte booket",
        value: funnelBooked,
        conversionRate: funnelBooked > 0 ? Math.round((funnelHeld / funnelBooked) * 1000) / 10 : 0,
      },
      {
        name: "Møte gjennomført",
        value: funnelHeld,
        conversionRate: funnelHeld > 0 ? Math.round((funnelOffer / funnelHeld) * 1000) / 10 : 0,
      },
      {
        name: "Tilbud sendt",
        value: funnelOffer,
        conversionRate: funnelOffer > 0 ? Math.round((funnelWon / funnelOffer) * 1000) / 10 : 0,
      },
      {
        name: "Vunnet",
        value: funnelWon,
      },
    ];

    const dashboardData: DashboardData = {
      primaryKPIs: {
        mrr: {
          label: "MRR",
          value: `${totalMRR.toLocaleString("no-NO")} kr`,
          trend: mrrTrend,
          trendLabel: vsLabel,
        },
        arr: {
          label: "Potensiell ARR",
          value: `${totalARR.toLocaleString("no-NO")} kr`,
          trend: mrrTrend,
          trendLabel: vsLabel,
        },
        minArr: {
          label: "Minimum ARR",
          value: `${totalMinARR.toLocaleString("no-NO")} kr`,
          trend: mrrTrend,
          trendLabel: vsLabel,
        },
        totalCustomers: {
          label: `Kunder vunnet (${periodLabel})`,
          value: customersThisPeriod.toString(),
          trend: percentChange(customersThisPeriod, wonPrevPeriod.length),
          trendLabel: vsLabel,
        },
        closingRate: {
          label: `Closing Rate (${periodLabel})`,
          value: `${closingRate}%`,
          trend: closingRate - prevClosingRate,
          trendLabel: vsLabel,
        },
      },
      meetingActivity: {
        weekly: {
          label: `Møte booket (${periodLabel})`,
          value: meetingsThisPeriod.length.toString(),
          trend: percentChange(meetingsThisPeriod.length, meetingsPrevPeriod.length),
          trendLabel: vsLabel,
        },
        monthly: {
          label: `Møte gjennomført (${periodLabel})`,
          value: meetingsHeldPeriod.length.toString(),
          trend: percentChange(meetingsHeldPeriod.length, meetingsHeldPrev.length),
          trendLabel: vsLabel,
        },
        yearly: {
          label: `Tilbud sendt (${periodLabel})`,
          value: offersSentPeriod.length.toString(),
          trend: percentChange(offersSentPeriod.length, offersSentPrev.length),
          trendLabel: vsLabel,
        },
      },
      mrrOverTime,
      meetingsOverTime,
      meetingsBySource,
      meetingsBookedTotal: meetingsThisPeriod.length,
      meetingsLeaderboard,
      funnelStages,
      churnAndRetention: {
        churnRate: {
          label: `Churn Rate (${periodLabel})`,
          value: `${churnRate}%`,
          trend: -(churnRate - prevChurnRate),
          trendLabel: churnRate <= prevChurnRate ? "improvement" : "increase",
        },
        customersLost: {
          label: `Tapte kunder (${periodLabel})`,
          value: lostInPeriod.toString(),
          trend: -(lostInPeriod - lostInPrevPeriod),
          trendLabel: vsLabel,
        },
        retention3Month: {
          label: "3-Month Retention",
          value: `${retention}%`,
          trend: 0,
          trendLabel: "last 3 months",
        },
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error: any) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
