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

export interface CustomerStageData {
  key: string;
  name: string;
  subtitle: string;
  value: number;
  tone: "blue" | "violet" | "amber" | "teal" | "green" | "lime" | "red";
}

export interface DashboardData {
  lastUpdated: string;
  primaryKPIs: {
    mrr: KPIData;
    arr: KPIData;
    potentialArr: KPIData;
    customersChurned: KPIData;
    closingRate: KPIData;
    activeTrials: KPIData;
    trialConversion: KPIData;
    trialBounce: KPIData;
  };
  meetingActivity: {
    weekly: KPIData;
    monthly: KPIData;
    yearly: KPIData;
  };
  mrrOverTime: ChartDataPoint[];
  meetingsOverTime: ChartDataPoint[];
  meetingsBySource: SourceBreakdownItem[];
  meetingsBookedTotal: number;
  meetingsLeaderboard: LeaderboardEntry[];
  funnelStages: FunnelStage[];
  customerLifecycle: {
    salesStages: CustomerStageData[];
    customerSuccessStages: CustomerStageData[];
    trackingMessage: string;
  };
}
