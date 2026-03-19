// Mock data for M51 Sales Performance Dashboard
// TODO: Replace with API calls to HubSpot integration
// Example: const data = await fetch("/api/dashboard-data")

export interface KPIData {
  label: string;
  value: string;
  trend: number; // percentage change
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
  conversionRate?: number; // percentage to next stage
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

export interface DashboardData {
  primaryKPIs: {
    mrr: KPIData;
    arr: KPIData;
    minArr: KPIData;
    totalCustomers: KPIData;
    closingRate: KPIData;
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
  churnAndRetention: {
    churnRate: KPIData;
    customersLost: KPIData;
    retention3Month: KPIData;
  };
}

export const mockData: DashboardData = {
  primaryKPIs: {
    mrr: {
      label: "MRR",
      value: "128,400 kr",
      trend: 8.2,
      trendLabel: "vs last month",
    },
    arr: {
      label: "Potensiell ARR",
      value: "1,540,800 kr",
      trend: 8.2,
      trendLabel: "yearly projection",
    },
    minArr: {
      label: "Minimum ARR",
      value: "385,200 kr",
      trend: 8.2,
      trendLabel: "yearly projection",
    },
    totalCustomers: {
      label: "Total Customers",
      value: "83",
      trend: 6,
      trendLabel: "this month",
      prefix: "+",
    },
    closingRate: {
      label: "Closing Rate",
      value: "34%",
      trend: 3.4,
      trendLabel: "vs last month",
    },
  },

  meetingActivity: {
    weekly: {
      label: "Meetings Booked (This Week)",
      value: "42",
      trend: 12,
      trendLabel: "vs last week",
    },
    monthly: {
      label: "Meetings Booked (This Month)",
      value: "156",
      trend: 9.1,
      trendLabel: "vs last month",
    },
    yearly: {
      label: "Meetings Booked (This Year)",
      value: "812",
      trend: 22,
      trendLabel: "vs last year",
    },
  },

  mrrOverTime: [
    { label: "Jan", value: 98000 },
    { label: "Feb", value: 102500 },
    { label: "Mar", value: 108200 },
    { label: "Apr", value: 112800 },
    { label: "May", value: 119600 },
    { label: "Jun", value: 128400 },
  ],

  meetingsBySource: [
    { name: "Webinar", value: 12, color: "#3C6E71" },
    { name: "Betalt (ads)", value: 8, color: "#FF3B3D" },
    { name: "E-post / Sekvens", value: 6, color: "#F59E0B" },
    { name: "Direkte salg", value: 10, color: "#6366F1" },
    { name: "Inbound", value: 4, color: "#10B981" },
  ],
  meetingsBookedTotal: 40,
  meetingsLeaderboard: [
    { name: "Eirik Myreng", count: 18 },
    { name: "Asgeir Johnsen", count: 12 },
    { name: "Sara Nilsen", count: 7 },
    { name: "Jonas Berg", count: 3 },
  ],

  meetingsOverTime: [
    { label: "W1", value: 28 },
    { label: "W2", value: 35 },
    { label: "W3", value: 31 },
    { label: "W4", value: 42 },
    { label: "W5", value: 38 },
    { label: "W6", value: 45 },
    { label: "W7", value: 40 },
    { label: "W8", value: 48 },
    { label: "W9", value: 36 },
    { label: "W10", value: 42 },
    { label: "W11", value: 50 },
    { label: "W12", value: 44 },
  ],

  funnelStages: [
    { name: "Leads", value: 420, conversionRate: 37.1 },
    { name: "Meetings Booked", value: 156, conversionRate: 76.9 },
    { name: "Meetings Held", value: 120, conversionRate: 48.3 },
    { name: "Deals Created", value: 58, conversionRate: 58.6 },
    { name: "Customers Won", value: 34 },
  ],

  churnAndRetention: {
    churnRate: {
      label: "Monthly Churn Rate",
      value: "4.2%",
      trend: -1.1,
      trendLabel: "improvement",
    },
    customersLost: {
      label: "Customers Lost This Month",
      value: "3",
      trend: -2,
      trendLabel: "vs last month",
    },
    retention3Month: {
      label: "3-Month Retention",
      value: "89%",
      trend: 2.3,
      trendLabel: "vs last quarter",
    },
  },
};
