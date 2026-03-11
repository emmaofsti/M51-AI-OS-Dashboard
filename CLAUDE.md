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

## GitHub / Deploy
- Repo: https://github.com/emmaofsti/M51-AI-OS-Dashboard
- Hosted på **Vercel** (kobler mot GitHub, auto-deploy ved push til main)
- `git add -A && git commit -m "..." && git push` → deployes automatisk

---

## Nåværende tilstand (sist oppdatert: 11. mars 2026)

### Deal-filter (header)
- **Alle** — viser alle M51 deals og salgsmøter
- **AI OS** — filtrerer deals til AI OS-produktlinjen via `AI_OS_PATTERN`
  - `AI_OS_PATTERN = /ai.?os|pil{1,2}ot|\bpro\b|\bstarter\b|\benterprise\b|\bagency\b|\bdemo\b/i`
  - Påvirker: inntekt, kunder vunnet, closing rate, pipeline, tilbud sendt, funnel, kilde-donut
  - Påvirker IKKE: Møte booket / Møte gjennomført (disse viser alltid alle salgsmøter)

### Dato-filter
7d / 30d / 90d / This year — alle KPI-kort og grafer oppdateres

### KPI-kort (rad 1 — deal-basert, filtreres av AI OS)
- **MRR** — månedlig inntekt fra vunne deals (pilot = månedspris, andre = årsverdi/12)
- **ARR** — MRR × 12
- **Kunder vunnet** — vunne deals i perioden (closedate)
- **Tapte kunder** — tapte deals i perioden

### KPI-kort (rad 2 — aktivitet)
- **Closing Rate** — kunder vunnet / møter gjennomført i perioden
- **Møte booket** — kalender-møter med AI/M51-titler, `hs_createdate` i perioden, floor: 16. feb 2026
- **Møte gjennomført** — samme møter, men `hs_timestamp` (møtedato) er i perioden og <= nå
- **Tilbud sendt** — deals i offer-stage eller vunnet i perioden

### Churn-seksjon
Viser "Kommer senere" (data ikke tilgjengelig ennå)

### Grafer (rad 3)
- **Inntekt per måned (2026)** — månedlig revenue fra vunne deals
- **Meetings booket over tid** — daglig/ukentlig/månedlig, tilpasser seg dato-filter

### Kilde til møtebookinger (SourceCard)
- Basert på `hs_analytics_source` fra **deals** som har nådd meeting-booked-stage
- Kategorier: Direkte salg, Betalt (ads), Direkte kontakt, Webinar, Seminar/Event, E-post/Sekvens, Inbound, Ukjent

### Salgstrakt (Funnel)
Leads → Møte booket → Møte gjennomført → Tilbud sendt → Vunnet

---

## Viktige tekniske detaljer

### HubSpot-datahenting (`lib/hubspot.ts`)
- **`searchDeals`**: Henter deals med `hs_lastmodifieddate >= 2025-01-01`
- **`searchMeetings`**: Henter møter med `hs_timestamp >= 2025-12-31T23:00:00Z` (= Jan 1 CET)
- **`searchContacts`**: Henter kontakter fra 2026
- Cache: 5 min TTL, server-side in-memory (Vercel: instanser gjenbrukes men ikke garantert)
- Refresh: `?refresh=true` query param tømmer cachen
- `maxDuration = 60` i route.ts (Vercel Hobby maks)

### AI OS meetings-floor
- Salgsmøter med AI OS-relaterte titler startet uke 8–9 2026 (ca. 16. feb)
- `AI_OS_MEETINGS_START = new Date("2026-02-15T23:00:00Z")` — brukes som gulv for alle møte-KPI-er
- Møter FØR denne datoen ekskluderes selv om de matcher tittelfilter
- Møtefilter: `MEETING_TITLE_PATTERN = /demo|agenter|\bai\b|m51/i`
- Ekskluder: `MEETING_EXCLUDE_PATTERN = /månedsmøte|frokostseminar|\bstyremøte\b|m51\s*\/\//i`

### Timezone-håndtering (viktig!)
- Vercel kjører i UTC, lokal dev kjører i CET (UTC+1)
- Alle dato-konstanter bruker eksplisitte UTC-strenger:
  - `YEAR_START_2026 = new Date("2025-12-31T23:00:00Z")` — Jan 1 00:00 CET
  - `YEAR_START_2025 = new Date("2024-12-31T23:00:00Z")`
  - `YEAR_END_2025   = new Date("2025-12-31T22:59:59Z")`
  - `AI_OS_MEETINGS_START = new Date("2026-02-15T23:00:00Z")` — Feb 16 00:00 CET
- IKKE bruk `new Date(2026, 0, 1)` — dette er timezone-avhengig!

### HubSpot Owner-mapping (`lib/ownerNames.ts`)
HubSpot-token mangler `crm.objects.owners.read` scope → manuell mapping:
```
"26813296"  → Asgeir
"21417175"  → Eirik
"222734413" → Emma
"111394562" → Mathias
"78966808"  → Daniel
"224568206" → Elisabeth
```

### Pipeline-stages (alle M51 pipelines)
```
WON_STAGES:           closedwon, 1499916, 918641, 1090547557, 18284046, 13114424, deal_registration_closed_won
LOST_STAGES:          closedlost, 1499917, 918642, 1090547558, 18298898, 1090547555, 11359580, deal_registration_closed_lost
MEETING_BOOKED_STAGES: appointmentscheduled, 1499914, 918638, 1090547553, 18284044, 11374877, 13060019
MEETING_HELD_STAGES:  presentationscheduled, 19052976, 918639, 1090547554, 13078631
OFFER_SENT_STAGES:    1499915, 918640, 9b4b0b98-bb9d-4bbc-9f3b-09fc6a6571fd, 1090547556, 18284045
```

---

## Skjult funksjonalitet (klar til å aktiveres)

### Leaderboard "Hvem booket flest møter?"
- Backend: `meetingsLeaderboard` beregnes i `route.ts` og sendes i API-responsen
- Type: `LeaderboardEntry[]` i `mockData.ts`
- UI: fjernet fra `page.tsx` midlertidig — kan legges tilbake under meetings-grafen
- Kode å legge tilbake i `page.tsx` (under ChartCard for meetings):
```tsx
// Importer øverst: import { ChevronDown, ChevronUp } from "lucide-react";
// State: const [showLeaderboard, setShowLeaderboard] = useState(false);

<button onClick={() => setShowLeaderboard(v => !v)}
  className="mt-2 flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-full">
  <span className="font-medium text-foreground">Hvem booket flest møter?</span>
  {showLeaderboard ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
</button>
{showLeaderboard && !loading && (
  <div className="rounded-lg border bg-card px-4 py-3 mt-0.5">
    {data.meetingsLeaderboard.length === 0 ? (
      <p className="text-sm text-muted-foreground">Ingen data for perioden.</p>
    ) : (
      <ol className="space-y-2">
        {data.meetingsLeaderboard.map((entry, i) => (
          <li key={entry.name} className="flex items-center gap-3">
            <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
            <span className="flex-1 text-sm font-medium text-foreground">{entry.name}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 rounded-full bg-[#3C6E71]/20 overflow-hidden" style={{ width: "80px" }}>
                <div className="h-full rounded-full bg-[#3C6E71]"
                  style={{ width: `${Math.round((entry.count / data.meetingsLeaderboard[0].count) * 100)}%` }} />
              </div>
              <span className="text-sm font-semibold tabular-nums w-6 text-right">{entry.count}</span>
            </div>
          </li>
        ))}
      </ol>
    )}
  </div>
)}
```

---

## Kjente problemer / åpne oppgaver

### 🟢 Løst: Lang lastetid ved refresh
- Løst med `hs_lastmodifieddate >= 2025-01-01` filter på deals

### 🟢 Løst: Activeon-pilotkunde manglet
- Deal opprettet 2025, vunnet 2026 → fanges av `closedate >= 2026` filter

### 🟢 Løst: Timezone-feil mellom lokal og Vercel
- Alle dato-konstanter er nå UTC-eksplisitte strenger

### 🟡 "Møte gjennomført" teller på hs_timestamp
- HubSpot `hs_date_entered_{stageId}` returnerer null for M51
- Bruker `hs_timestamp` (møtedato) som proxy — ikke 100% perfekt men bedre enn createdate

### 🟡 HubSpot owner-scope mangler
- Token har ikke `crm.objects.owners.read` → bruker manuell mapping i `ownerNames.ts`
- Løsning: Lag ny Private App i HubSpot med riktig scope, erstatt token i Vercel + `.env.local`

---

## Filstruktur (viktigste filer)
```
app/
  dashboard/page.tsx          — Hoved-dashboardside (client component)
  api/dashboard-data/route.ts — API-rute: beregner alle KPI-er
lib/
  hubspot.ts                  — HubSpot-henting + cache
  mockData.ts                 — Fallback mock-data + TypeScript-typer
  ownerNames.ts               — Manuell HubSpot owner ID → navn mapping
components/
  DashboardHeader.tsx         — Header med dato-filter, AI OS-toggle, refresh
  KPICard.tsx                 — KPI-kort-komponent
  ChartCard.tsx               — Graf-komponent (Recharts)
  FunnelCard.tsx              — Salgstrakt-komponent
  SourceCard.tsx              — Kilde til møtebookinger (donut-graf)
```

---

## Miljøvariabler
- `HUBSPOT_ACCESS_TOKEN` — settes i `.env.local` (lokalt) og Vercel Environment Variables (prod)
