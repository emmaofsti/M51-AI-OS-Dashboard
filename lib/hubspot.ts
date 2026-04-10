// HubSpot API helper — fetches CRM data for M51 Dashboard

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BASE_URL = "https://api.hubapi.com";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hubspotFetch(
  endpoint: string,
  options?: RequestInit,
  retries = 3
): Promise<any> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (res.status === 429 && retries > 0) {
    await delay(1200);
    return hubspotFetch(endpoint, options, retries - 1);
  }

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HubSpot API error (${res.status}): ${error}`);
  }

  return res.json();
}

// --- Server-side cache (5 min TTL) ---
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 min — reduces how often the slow HubSpot fetch runs

export async function getCachedDashboardData() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }
  const data = await fetchAllData();
  cache = { data, timestamp: Date.now() };
  return data;
}

export function clearCache() {
  cache = null;
}

// --- Fetch all deals modified since 2025-01-01 ---
// Wide net: catches deals created before 2026 but won/updated in 2026 (e.g. Activeon),
// without fetching years of completely irrelevant historical data.
async function searchDeals(after?: string) {
  const since2025 = new Date(2025, 0, 1).getTime().toString();
  const body: any = {
    filterGroups: [
      {
        filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: since2025 }],
      },
    ],
    properties: [
      "dealname",
      "amount",
      "dealstage",
      "closedate",
      "createdate",
      "pipeline",
      "hs_lastmodifieddate",
      // Source / channel tracking fields
      "hs_analytics_source",
      "hs_analytics_source_data_1",
      "hs_analytics_source_data_2",
      "hs_latest_source",
      "hs_latest_source_data_1",
      "lead_source",
      "hubspot_owner_id",
    ],
    limit: 100,
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
  };
  if (after) body.after = after;

  return hubspotFetch("/crm/v3/objects/deals/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function searchContacts(after?: string) {
  const body: any = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "createdate",
            operator: "GTE",
            value: new Date(2026, 0, 1).getTime().toString(),
          },
        ],
      },
    ],
    properties: ["createdate", "lifecyclestage"],
    limit: 100,
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
  };
  if (after) body.after = after;

  return hubspotFetch("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Fetch all HubSpot meeting activities from 2026 onwards
async function searchMeetings(after?: string) {
  const since2026 = new Date("2025-12-31T23:00:00Z").getTime().toString(); // Jan 1 00:00 CET
  const body: any = {
    filterGroups: [
      {
        filters: [{ propertyName: "hs_timestamp", operator: "GTE", value: since2026 }],
      },
    ],
    properties: ["hs_meeting_title", "hs_timestamp", "hs_meeting_start_time", "hs_createdate", "hubspot_owner_id"],
    limit: 100,
    sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
  };
  if (after) body.after = after;

  return hubspotFetch("/crm/v3/objects/meetings/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Fetch monthly MRR per deal by summing associated line item amounts.
// Line items in M51 HubSpot use monthly prices — amount = price × qty after discount.
async function fetchLineItemMRR(dealIds: string[]): Promise<Map<string, number>> {
  if (dealIds.length === 0) return new Map();

  // Step 1: Get associations deal → line items (batch, max 100 per request)
  const lineItemToDeal = new Map<string, string>();
  for (let i = 0; i < dealIds.length; i += 100) {
    const chunk = dealIds.slice(i, i + 100);
    const res = await hubspotFetch("/crm/v4/associations/deals/line_items/batch/read", {
      method: "POST",
      body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
    });
    for (const result of res.results || []) {
      for (const assoc of result.to || []) {
        lineItemToDeal.set(String(assoc.toObjectId), String(result.from.id));
      }
    }
    if (i + 100 < dealIds.length) await delay(100);
  }

  if (lineItemToDeal.size === 0) return new Map();

  // Step 2: Fetch line item objects and sum amounts per deal
  const lineItemIds = [...lineItemToDeal.keys()];
  const dealMRR = new Map<string, number>();
  for (let i = 0; i < lineItemIds.length; i += 100) {
    const chunk = lineItemIds.slice(i, i + 100);
    const res = await hubspotFetch("/crm/v3/objects/line_items/batch/read", {
      method: "POST",
      body: JSON.stringify({
        inputs: chunk.map((id) => ({ id })),
        properties: ["amount"],
      }),
    });
    for (const li of res.results || []) {
      const dealId = lineItemToDeal.get(String(li.id));
      if (!dealId) continue;
      const amount = parseFloat(li.properties.amount) || 0;
      dealMRR.set(dealId, (dealMRR.get(dealId) ?? 0) + amount);
    }
    if (i + 100 < lineItemIds.length) await delay(100);
  }

  return dealMRR;
}

// Fetch hs_latest_source (and _data_1/_data_2) from contacts associated with the given deal IDs.
// Returns a Map<dealId, { src, d1, d2 }> for use in source categorization.
export async function fetchContactSourcesForDeals(
  dealIds: string[]
): Promise<Map<string, { src: string; d1: string; d2: string }>> {
  if (dealIds.length === 0) return new Map();

  // Step 1: Get deal → contact associations (batch)
  const dealToContact = new Map<string, string>();
  for (let i = 0; i < dealIds.length; i += 100) {
    const chunk = dealIds.slice(i, i + 100);
    const res = await hubspotFetch("/crm/v4/associations/deals/contacts/batch/read", {
      method: "POST",
      body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
    });
    for (const result of res.results || []) {
      const first = result.to?.[0];
      if (first) dealToContact.set(String(result.from.id), String(first.toObjectId));
    }
    if (i + 100 < dealIds.length) await delay(100);
  }

  if (dealToContact.size === 0) return new Map();

  // Step 2: Batch fetch contact source properties
  const contactIds = [...new Set(dealToContact.values())];
  const contactSource = new Map<string, { src: string; d1: string; d2: string }>();
  for (let i = 0; i < contactIds.length; i += 100) {
    const chunk = contactIds.slice(i, i + 100);
    const res = await hubspotFetch("/crm/v3/objects/contacts/batch/read", {
      method: "POST",
      body: JSON.stringify({
        inputs: chunk.map((id) => ({ id })),
        properties: ["hs_latest_source", "hs_latest_source_data_1", "hs_latest_source_data_2"],
      }),
    });
    for (const c of res.results || []) {
      contactSource.set(String(c.id), {
        src: c.properties.hs_latest_source ?? "",
        d1: (c.properties.hs_latest_source_data_1 ?? "").toLowerCase(),
        d2: (c.properties.hs_latest_source_data_2 ?? "").toLowerCase(),
      });
    }
    if (i + 100 < contactIds.length) await delay(100);
  }

  // Step 3: Map back to deal IDs
  const result = new Map<string, { src: string; d1: string; d2: string }>();
  for (const [dealId, contactId] of dealToContact.entries()) {
    const src = contactSource.get(contactId);
    if (src) result.set(dealId, src);
  }
  return result;
}

async function fetchOwners() {
  // Try legacy v2 endpoint first — works without crm.objects.owners.read scope
  try {
    const data = await hubspotFetch("/owners/v2/owners");
    if (Array.isArray(data)) return data;
  } catch {}
  // Fall back to v3
  try {
    const data = await hubspotFetch("/crm/v3/owners?limit=100");
    return data.results || [];
  } catch {
    return [];
  }
}

async function fetchAllData() {
  // Fetch deals (paginated) — 50ms delay between pages to stay within rate limits
  let allDeals: any[] = [];
  let after: string | undefined;
  do {
    const data = await searchDeals(after);
    allDeals = allDeals.concat(data.results || []);
    after = data.paging?.next?.after;
    if (after) await delay(50);
  } while (after);

  await delay(200); // Brief pause before contacts

  // Fetch contacts (paginated)
  let allContacts: any[] = [];
  after = undefined;
  do {
    const data = await searchContacts(after);
    allContacts = allContacts.concat(data.results || []);
    after = data.paging?.next?.after;
    if (after) await delay(50);
  } while (after);

  await delay(200);

  // Fetch meeting activities (paginated)
  let allMeetings: any[] = [];
  after = undefined;
  do {
    const data = await searchMeetings(after);
    allMeetings = allMeetings.concat(data.results || []);
    after = data.paging?.next?.after;
    if (after) await delay(50);
  } while (after);

  const owners = await fetchOwners();

  await delay(200);

  // Fetch line items for all deals — used for accurate MRR/ARR calculation
  // Requires HubSpot scope: crm.objects.line_items.read
  let dealMRR: Map<string, number> = new Map();
  try {
    dealMRR = await fetchLineItemMRR(allDeals.map((d: any) => d.id));
  } catch (e) {
    console.warn("Line items fetch failed (missing scope?), falling back to deal amount:", e);
  }

  return { deals: allDeals, contacts: allContacts, meetings: allMeetings, owners, dealMRR };
}
