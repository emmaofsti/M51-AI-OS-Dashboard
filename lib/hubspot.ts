import { AI_OS_PATTERN, WON_STAGES } from "@/lib/dashboardConfig";

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BASE_URL = "https://api.hubapi.com";
// Keep HubSpot requests near-live without refetching the full deal history for
// every browser request. The client polls on the same cadence and the manual
// refresh button bypasses this cache entirely.
const CACHE_TTL = 60 * 1000;

const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "dealstage",
  "closedate",
  "createdate",
  "pipeline",
  "hs_lastmodifieddate",
  "hubspot_owner_id",
  "tjenester",
] as const;

export interface HubSpotHistoryEntry {
  value: string;
  timestamp: string;
  sourceType?: string;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    closedate?: string;
    createdate?: string;
    pipeline?: string;
    hs_lastmodifieddate?: string;
    hubspot_owner_id?: string;
    tjenester?: string;
  };
  propertiesWithHistory?: {
    dealstage?: HubSpotHistoryEntry[];
  };
}

interface SearchResponse<T> {
  results?: T[];
  paging?: { next?: { after?: string } };
}

interface BatchResponse<T> {
  results?: T[];
}

interface AssociationResult {
  from: { id: string };
  to?: Array<{ toObjectId: number | string }>;
}

interface AssociationResponse {
  results?: AssociationResult[];
}

interface ContactSourceRecord {
  id: string;
  properties: {
    hs_latest_source?: string;
    hs_latest_source_data_1?: string;
    hs_latest_source_data_2?: string;
  };
}

export interface HubSpotMeeting {
  id: string;
  properties: {
    hs_meeting_title?: string;
    hs_meeting_outcome?: string;
    hs_timestamp?: string;
    hs_meeting_start_time?: string;
    hs_meeting_end_time?: string;
    hubspot_owner_id?: string;
  };
}

interface LineItemRecord {
  id: string;
  properties: {
    name?: string;
    amount?: string;
    hs_mrr?: string;
    hs_arr?: string;
    recurringbillingfrequency?: string;
  };
}

export interface DashboardSourceData {
  deals: HubSpotDeal[];
  dealMRR: Map<string, number>;
  fetchedAt: string;
}

let cache: { data: DashboardSourceData; timestamp: number } | null = null;
let meetingsCache: {
  key: string;
  data: Map<string, HubSpotMeeting[]>;
  timestamp: number;
} | null = null;

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function hubspotFetch<T>(
  endpoint: string,
  options?: RequestInit,
  retries = 5,
): Promise<T> {
  if (!HUBSPOT_TOKEN) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (response.status === 429 && retries > 0) {
    await delay(1200);
    return hubspotFetch<T>(endpoint, options, retries - 1);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot API error (${response.status}): ${error}`);
  }

  return response.json() as Promise<T>;
}

function dashboardDataStart(): number {
  const currentYear = new Date().getUTCFullYear();
  return Date.UTC(currentYear - 1, 0, 1);
}

async function searchDeals(after?: string): Promise<SearchResponse<HubSpotDeal>> {
  const start = dashboardDataStart().toString();
  const body: Record<string, unknown> = {
    filterGroups: [
      {
        filters: [
          { propertyName: "createdate", operator: "GTE", value: start },
        ],
      },
      {
        filters: [
          { propertyName: "closedate", operator: "GTE", value: start },
        ],
      },
    ],
    properties: [...DEAL_PROPERTIES],
    limit: 100,
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
  };
  if (after) body.after = after;

  return hubspotFetch<SearchResponse<HubSpotDeal>>(
    "/crm/v3/objects/deals/search",
    { method: "POST", body: JSON.stringify(body) },
  );
}

async function fetchDealHistories(deals: HubSpotDeal[]): Promise<HubSpotDeal[]> {
  const byId = new Map(deals.map((deal) => [deal.id, deal]));

  // HubSpot limits property-history batches to 50 records.
  for (let index = 0; index < deals.length; index += 50) {
    const chunk = deals.slice(index, index + 50);
    const response = await hubspotFetch<BatchResponse<HubSpotDeal>>(
      "/crm/v3/objects/deals/batch/read",
      {
        method: "POST",
        body: JSON.stringify({
          inputs: chunk.map(({ id }) => ({ id })),
          properties: [...DEAL_PROPERTIES],
          propertiesWithHistory: ["dealstage"],
        }),
      },
    );

    for (const deal of response.results ?? []) byId.set(deal.id, deal);
    if (index + 50 < deals.length) await delay(250);
  }

  return [...byId.values()];
}

async function fetchLineItemMRR(
  dealIds: string[],
): Promise<Map<string, number>> {
  if (dealIds.length === 0) return new Map();

  const lineItemToDeal = new Map<string, string>();
  for (let index = 0; index < dealIds.length; index += 100) {
    const chunk = dealIds.slice(index, index + 100);
    const response = await hubspotFetch<AssociationResponse>(
      "/crm/v4/associations/deals/line_items/batch/read",
      {
        method: "POST",
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
      },
    );

    for (const result of response.results ?? []) {
      for (const association of result.to ?? []) {
        lineItemToDeal.set(
          String(association.toObjectId),
          String(result.from.id),
        );
      }
    }
  }

  const lineItemIds = [...lineItemToDeal.keys()];
  const dealMRR = new Map<string, number>();
  for (const dealId of lineItemToDeal.values()) dealMRR.set(dealId, 0);

  for (let index = 0; index < lineItemIds.length; index += 100) {
    const chunk = lineItemIds.slice(index, index + 100);
    const response = await hubspotFetch<BatchResponse<LineItemRecord>>(
      "/crm/v3/objects/line_items/batch/read",
      {
        method: "POST",
        body: JSON.stringify({
          inputs: chunk.map((id) => ({ id })),
          properties: [
            "name",
            "amount",
            "hs_mrr",
            "hs_arr",
            "recurringbillingfrequency",
          ],
        }),
      },
    );

    for (const lineItem of response.results ?? []) {
      const dealId = lineItemToDeal.get(String(lineItem.id));
      if (!dealId) continue;
      const amount = Number.parseFloat(lineItem.properties.amount ?? "") || 0;
      const hubspotMRR =
        Number.parseFloat(lineItem.properties.hs_mrr ?? "") || 0;
      const hubspotARR =
        Number.parseFloat(lineItem.properties.hs_arr ?? "") || 0;
      const frequency = (
        lineItem.properties.recurringbillingfrequency ?? ""
      ).toLowerCase();
      const monthlyAmount =
        hubspotMRR > 0
          ? hubspotMRR
          : hubspotARR > 0
            ? hubspotARR / 12
            : frequency === "monthly" || frequency === "p1m"
          ? amount
          : frequency === "annually" || frequency === "yearly" || frequency === "p1y"
            ? amount / 12
            : !frequency && AI_OS_PATTERN.test(lineItem.properties.name ?? "")
              ? amount
              : 0;
      dealMRR.set(dealId, (dealMRR.get(dealId) ?? 0) + monthlyAmount);
    }
  }

  return dealMRR;
}

async function fetchAllData(): Promise<DashboardSourceData> {
  const searchedDeals: HubSpotDeal[] = [];
  let after: string | undefined;
  do {
    const response = await searchDeals(after);
    searchedDeals.push(...(response.results ?? []));
    after = response.paging?.next?.after;
    if (after) await delay(100);
  } while (after);

  const deals = await fetchDealHistories(searchedDeals);
  const wonDealIds = deals
    .filter((deal) => WON_STAGES.has(deal.properties.dealstage ?? ""))
    .map((deal) => deal.id);

  let dealMRR = new Map<string, number>();
  try {
    dealMRR = await fetchLineItemMRR(wonDealIds);
  } catch (error) {
    console.warn(
      "Line items fetch failed; falling back to deal amount.",
      error,
    );
  }

  return { deals, dealMRR, fetchedAt: new Date().toISOString() };
}

export async function getCachedDashboardData(): Promise<DashboardSourceData> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) return cache.data;
  const data = await fetchAllData();
  cache = { data, timestamp: Date.now() };
  return data;
}

export function clearCache(): void {
  cache = null;
  meetingsCache = null;
}

export async function fetchContactSourcesForDeals(
  dealIds: string[],
): Promise<Map<string, { src: string; d1: string; d2: string }>> {
  if (dealIds.length === 0) return new Map();

  const dealToContact = new Map<string, string>();
  for (let index = 0; index < dealIds.length; index += 100) {
    const chunk = dealIds.slice(index, index + 100);
    const response = await hubspotFetch<AssociationResponse>(
      "/crm/v4/associations/deals/contacts/batch/read",
      {
        method: "POST",
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
      },
    );

    for (const result of response.results ?? []) {
      const first = result.to?.[0];
      if (first) {
        dealToContact.set(String(result.from.id), String(first.toObjectId));
      }
    }
  }

  const contactIds = [...new Set(dealToContact.values())];
  const contactSources = new Map<
    string,
    { src: string; d1: string; d2: string }
  >();

  for (let index = 0; index < contactIds.length; index += 100) {
    const chunk = contactIds.slice(index, index + 100);
    const response = await hubspotFetch<BatchResponse<ContactSourceRecord>>(
      "/crm/v3/objects/contacts/batch/read",
      {
        method: "POST",
        body: JSON.stringify({
          inputs: chunk.map((id) => ({ id })),
          properties: [
            "hs_latest_source",
            "hs_latest_source_data_1",
            "hs_latest_source_data_2",
          ],
        }),
      },
    );

    for (const contact of response.results ?? []) {
      contactSources.set(String(contact.id), {
        src: contact.properties.hs_latest_source ?? "",
        d1: (contact.properties.hs_latest_source_data_1 ?? "").toLowerCase(),
        d2: (contact.properties.hs_latest_source_data_2 ?? "").toLowerCase(),
      });
    }
  }

  const result = new Map<string, { src: string; d1: string; d2: string }>();
  for (const [dealId, contactId] of dealToContact) {
    const source = contactSources.get(contactId);
    if (source) result.set(dealId, source);
  }
  return result;
}

export async function fetchMeetingsForDeals(
  dealIds: string[],
): Promise<Map<string, HubSpotMeeting[]>> {
  if (dealIds.length === 0) return new Map();
  const cacheKey = [...dealIds].sort().join(",");
  if (
    meetingsCache &&
    meetingsCache.key === cacheKey &&
    Date.now() - meetingsCache.timestamp < CACHE_TTL
  ) {
    return meetingsCache.data;
  }

  const contactToDeals = new Map<string, Set<string>>();
  for (let index = 0; index < dealIds.length; index += 100) {
    const chunk = dealIds.slice(index, index + 100);
    const response = await hubspotFetch<AssociationResponse>(
      "/crm/v4/associations/deals/contacts/batch/read",
      {
        method: "POST",
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
      },
    );
    for (const result of response.results ?? []) {
      for (const association of result.to ?? []) {
        const contactId = String(association.toObjectId);
        const dealsForContact = contactToDeals.get(contactId) ?? new Set<string>();
        dealsForContact.add(String(result.from.id));
        contactToDeals.set(contactId, dealsForContact);
      }
    }
  }

  const contactIds = [...contactToDeals.keys()];
  const meetingToDeals = new Map<string, Set<string>>();
  for (let index = 0; index < contactIds.length; index += 100) {
    const chunk = contactIds.slice(index, index + 100);
    const response = await hubspotFetch<AssociationResponse>(
      "/crm/v4/associations/contacts/meetings/batch/read",
      {
        method: "POST",
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
      },
    );
    for (const result of response.results ?? []) {
      const dealsForContact = contactToDeals.get(String(result.from.id));
      if (!dealsForContact) continue;
      for (const association of result.to ?? []) {
        const meetingId = String(association.toObjectId);
        const dealsForMeeting = meetingToDeals.get(meetingId) ?? new Set<string>();
        for (const dealId of dealsForContact) dealsForMeeting.add(dealId);
        meetingToDeals.set(meetingId, dealsForMeeting);
      }
    }
  }

  const meetingsByDeal = new Map<string, Map<string, HubSpotMeeting>>();
  const meetingIds = [...meetingToDeals.keys()];
  for (let index = 0; index < meetingIds.length; index += 100) {
    const chunk = meetingIds.slice(index, index + 100);
    const response = await hubspotFetch<BatchResponse<HubSpotMeeting>>(
      "/crm/v3/objects/meetings/batch/read",
      {
        method: "POST",
        body: JSON.stringify({
          inputs: chunk.map((id) => ({ id })),
          properties: [
            "hs_meeting_title",
            "hs_meeting_outcome",
            "hs_timestamp",
            "hs_meeting_start_time",
            "hs_meeting_end_time",
            "hubspot_owner_id",
          ],
        }),
      },
    );
    for (const meeting of response.results ?? []) {
      for (const dealId of meetingToDeals.get(String(meeting.id)) ?? []) {
        const meetings = meetingsByDeal.get(dealId) ?? new Map();
        meetings.set(String(meeting.id), meeting);
        meetingsByDeal.set(dealId, meetings);
      }
    }
  }

  const result = new Map(
    [...meetingsByDeal].map(([dealId, meetings]) => [
      dealId,
      [...meetings.values()],
    ]),
  );
  meetingsCache = { key: cacheKey, data: result, timestamp: Date.now() };
  return result;
}
