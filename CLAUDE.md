# M51 AI OS Dashboard — prosjektkontekst

## Formål

Passordbeskyttet Next.js-dashboard som viser M51-salgstall fra HubSpot. `main`
deployes automatisk til Vercel fra GitHub-repoet `emmaofsti/M51-AI-OS-Dashboard`.

## Teknologi

- Next.js 16 App Router, React 19 og TypeScript
- Tailwind CSS 4 og shadcn/ui
- Recharts
- HubSpot CRM API v3/v4

## Dataprinsipper

- Dashboardet viser aldri mocktall hvis HubSpot feiler.
- Alle aktivitets-KPI-er bruker `dealstage` med `propertiesWithHistory`.
- En deal teller som å ha nådd tidligere trinn når den går direkte til et
  senere trinn. Eksempel: gratis prøveperiode teller som både booket og
  gjennomført møte.
- Hver deal telles maksimalt én gang per KPI og valgt periode.
- `createdate` brukes bare for «Nye deals», ikke som proxy for stegovergang.
- Closing rate er `vunnet / (vunnet + tapt)` basert på steghistorikk.
- Både dato- og AI OS-filteret gjelder hele dashboardet.
- Kalendergrenser beregnes i `Europe/Oslo`, inkludert sommertid.

## MRR

- Månedlige line items: hele `amount`.
- Årlige line items: `amount / 12`.
- Engangs-line items: 0 i MRR.
- Eldre AI-line items uten frekvens: `amount` som dokumentert fallback.
- AI-deals uten line items: pilotbeløp er månedlig, annet dealbeløp deles på 12.
- Ikke-AI-deals uten gjentakende line items bidrar ikke til MRR.

## AI OS-filter

Definert i `lib/dashboardConfig.ts`. Det dekker historiske AI OS-/pilotnavn og
nyere navn som `M51 AI`, `m51.ai`, gratis prøveperiode og produktnivåene Pro,
Starter, Enterprise og Agency. Det gamle generelle treffet på ordet `x` er
fjernet fordi det inkluderte uvedkommende deals.

## Eiernavn

HubSpot-tokenet mangler owner-read-scope. Manuell mapping ligger i
`lib/ownerNames.ts`:

```text
26813296  Asgeir
21417175  Eirik
222734413 Elisabeth
111394562 Mathias
78966808  Daniel
224568206 Emma
97198504  Hedda
```

## Viktige filer

```text
app/api/dashboard-data/route.ts  KPI- og grafberegninger
lib/dashboardConfig.ts           Pipeline-steg og AI OS-filter
lib/hubspot.ts                   HubSpot-henting, historikk, cache og MRR
lib/ownerNames.ts                Manuell eiermapping
app/dashboard/page.tsx           Dashboard-UI
proxy.ts                         Innloggingsbeskyttelse
```

## Lokal kjøring og kontroll

Miljøvariabler i `.env.local` og Vercel:

```text
HUBSPOT_ACCESS_TOKEN=...
DASHBOARD_PASSWORD=...
```

```bash
npm run dev
npm run lint
npm run build
```

HubSpot-cache er 30 minutter. `refresh=true` tømmer cachen.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
