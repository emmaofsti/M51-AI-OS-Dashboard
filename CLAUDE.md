# M51 Sales Performance Dashboard — Claude Context

## Prosjektbeskrivelse
Next.js SaaS-dashboard for M51 koblet til HubSpot CRM. Viser salgsdata i sanntid.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript, Tailwind CSS, shadcn/ui
- Recharts (grafer)
- HubSpot CRM API v3 (Search endpoint)

## Kjøre prosjektet
Server starter på **port 3000**. Bruk preview-verktøyet med navn `dashboard`.
Åpne: `http://localhost:3000/dashboard`

---

## Nåværende tilstand (sist oppdatert: mars 2026)

### KPI-kort (7 stk)
**Rad 1:**
- Inntekt (filtrert periode) — basert på `closedate`
- Kunder vunnet (filtrert periode) — basert på `closedate`
- Closing Rate (filtrert periode)
- Deals i pipeline (filtrert periode)

**Rad 2:**
- Møte booket (filtrert periode) — basert på `createdate`
- Møte gjennomført (filtrert periode) — kumulativt: deals som har NÅdd meeting-held-stage eller videre
- Tilbud sendt (filtrert periode) — eksakt stage: kun deals som ER i tilbud-sendt-stage nå

**Dato-filter:** 7d / 30d / 90d / This year — alle KPI-kort oppdateres

**Churn-seksjon:** Viser "Kommer senere" (data ikke tilgjengelig ennå)

### Grafer
- "Revenue vekst (2026)" — månedlig inntekt hittil i år
- "Meetings Booked Over Time" — ukentlig meetings hittil i år

### Salgstrakt (Funnel)
Leads → Møte booket → Møte gjennomført → Tilbud sendt → Vunnet

---

## Viktige tekniske detaljer

### HubSpot-datahenting (`lib/hubspot.ts`)
- **`searchDeals`**: Henter deals med `hs_lastmodifieddate >= 2025-01-01`
  - **Grunn:** Deals opprettet før 2026 men vunnet i 2026 (f.eks. Activeon) ble utelatt med smalere filter
  - Bredt nok til å fange opp eldre deals som ble oppdatert i 2025/2026, men ikke hele historikken
  - Ingen filter = 20+ sek lastetid, dette er ~5–8 sek
- **`searchContacts`**: Henter kun kontakter fra 2026 (createdate >= 2026-01-01)
- Cache: 5 min TTL, server-side in-memory
- Refresh: `?refresh=true` query param tømmer cachen

### Lokal filtrering (`app/api/dashboard-data/route.ts`)
- `deals2026`: filtrerer til deals der `closedate >= 2026` ELLER `createdate >= 2026`
- Vunne/tapte deals filtreres på `closedate`
- Meetings filtreres på `createdate`

### Pipeline-stages (alle M51 pipelines)
```
WON_STAGES: closedwon, 1499916, 918641, 1090547557, 18284046, 13114424, deal_registration_closed_won
LOST_STAGES: closedlost, 1499917, 918642, 1090547558, 18298898, 1090547555, 11359580, deal_registration_closed_lost
MEETING_BOOKED_STAGES: appointmentscheduled, 1499914, 918638, 1090547553, 18284044, 11374877, 13060019
MEETING_HELD_STAGES: presentationscheduled, 19052976, 918639, 1090547554, 13078631
OFFER_SENT_STAGES: 1499915, 918640, 9b4b0b98-bb9d-4bbc-9f3b-09fc6a6571fd, 1090547556, 18284045
```

---

## Kjente problemer / åpne oppgaver

### 🟢 Løst: Lang lastetid ved refresh
- Opprinnelig ble alle deals hentet (ingen datofilter) = 20+ sek lastetid
- Løst ved å bruke `hs_lastmodifieddate >= 2025-01-01` — fanger opp Activeon og lignende, men ikke all historikk

### 🟡 Møte gjennomført vs Tilbud sendt
- Begge kan vise samme tall (f.eks. 22) fordi cumulative logic inkluderer offers og won deals
- Dette er teknisk korrekt: alle som sendte tilbud hadde jo et møte
- Vurder om vi skal bruke en annen metrikk

### 🟡 "Møte gjennomført" teller på createdate
- HubSpot `hs_date_entered_{stageId}` finnes men returnerer null for M51
- Bruker `createdate` på dealen som proxy — ikke perfekt

### 🟢 Løst: Activeon - Pilotkunde mangler
- Deal opprettet i 2025, vunnet i 2026 → fanges nå opp via `closedate >= 2026` filter

---

## Filstruktur (viktigste filer)
```
app/
  dashboard/page.tsx          — Hoved-dashboardside (client component)
  api/dashboard-data/route.ts — API-rute: beregner alle KPI-er
lib/
  hubspot.ts                  — HubSpot-henting + cache
  mockData.ts                 — Fallback mock-data (vises hvis API feiler)
components/
  DashboardHeader.tsx         — Header med dato-filter og refresh-knapp
  KPICard.tsx                 — KPI-kort-komponent
  ChartCard.tsx               — Graf-komponent (Recharts)
  FunnelCard.tsx              — Salgstrakt-komponent
```

---

## Miljøvariabler
- `HUBSPOT_ACCESS_TOKEN` — settes i `.env.local`
