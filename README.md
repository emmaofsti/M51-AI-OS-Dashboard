# M51 AI OS Dashboard

Internt salgsdashboard for M51, bygget med Next.js 16, React 19, TypeScript,
Tailwind CSS og Recharts. Dashboardet leser live CRM-data fra HubSpot.

## Dette vises

- Ny MRR, annualisert verdi og minimumsverdi
- Vunne og tapte deals
- Closing rate
- Bookede og gjennomførte møter
- Sendte tilbud
- Aktive 14-dagers prøveperioder og trial-til-vunnet-konvertering
- Møteaktivitet per periode og eier
- Kilde til møtebooking
- Registrerte salgssteg i perioden

Aktivitets-KPI-ene beregnes fra HubSpots faktiske deal-steghistorikk i «Salg»-pipen.
En prøveperiode teller bare som møte hvis dealen faktisk har vært i
«Møte booket». Trial, vunnet og MRR rapporteres separat.

Dashboardet oppdaterer automatisk fra HubSpot hvert minutt. Tidspunktet for
siste fullførte HubSpot-henting vises i toppen, og oppdateringsknappen tvinger
en umiddelbar ny henting.

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
