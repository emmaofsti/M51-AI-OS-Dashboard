// Shared dashboard response types. The dashboard deliberately has no mock
// fallback: fabricated business figures must never replace unavailable CRM data.

export interface KPIData {
  label: string;
  value: string;
  trend: number;
  trendLabel: string;
  prefix?: string;
  suffix?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

// Kept for the reusable detail cards, although those cards are no longer part
// of the primary dashboard surface.
export interface FunnelStage {
  name: string;
  subtitle?: string;
  value: number;
  conversionRate?: number;
}

export interface SourceBreakdownItem {
  name: string;
  value: number;
  color: string;
}

export interface LeaderboardEntry {
  name: string;
  count: number;
}

export interface SalesTrialOverview {
  periodLabel: string;
  meetingsBooked: number;
  meetingsHeld: number;
  wonFromMeetings: number;
  closingRate: number;
  activeTrials: number;
  trialsStarted: number;
  trialsResolved: number;
  trialsWon: number;
  trialsBounced: number;
  trialConversionRate: number;
  trialBounceRate: number;
}

export interface DashboardData {
  lastUpdated: string;
  primaryKPIs: {
    mrr: KPIData;
    arr: KPIData;
    potentialArr: KPIData;
    customersChurned: KPIData;
  };
  salesTrialOverview: SalesTrialOverview;
  mrrOverTime: ChartDataPoint[];
  meetingsOverTime: ChartDataPoint[];
  meetingsLeaderboard: LeaderboardEntry[];
}
