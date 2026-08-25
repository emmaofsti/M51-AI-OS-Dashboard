# M51 AI OS Dashboard

Internt salgsdashboard for M51, bygget med Next.js 16, React 19, TypeScript,
Tailwind CSS og Recharts. Dashboardet leser live CRM-data fra HubSpot.

## Dette vises

- MRR, ARR og minimumsverdi
- Vunne og tapte deals
- Closing rate
- Bookede og gjennomførte møter
- Sendte tilbud
- Møteaktivitet per periode og eier
- Kilde til møtebooking
- Salgstrakt

Aktivitets-KPI-ene beregnes fra HubSpots faktiske deal-steghistorikk. Et senere
steg, som gratis prøveperiode, regnes som at tidligere steg i trakten er nådd.

## Lokal kjøring

Opprett `.env.local`:

```text
HUBSPOT_ACCESS_TOKEN=...
DASHBOARD_PASSWORD=...
```

Installer og start:

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Kontroller

```bash
npm run lint
npm run build
```

`main` deployes automatisk til Vercel via GitHub.
