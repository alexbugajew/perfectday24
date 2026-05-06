# PerfectDay24

## Entwicklung

Lokalen Dev-Server starten:

```bash
npm run dev
```

Typecheck ausfuehren:

```bash
npm run typecheck
```

## Planner-Checks

Der Standard-Check fuer lokale Merges und PRs ist jetzt:

```bash
npm run check:planner
```

Er umfasst:

- Typecheck
- Build der Regression-Runner
- klassische Planner-Trace-Regression
- Drei-Staedte-Kernflow-Regression
- Daten-/Qualitaetscheck fuer Berlin, Hamburg und Muenchen

Die erzeugten Reports landen unter [reports](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/reports).

Einzelschritte:

```bash
npm run regression:build
npm run regression:planner
npm run regression:core-cities
npm run check:quality
```

Wichtige Runner:

- [planner-trace-regression.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/scripts/planner-trace-regression.ts)
- [planner-city-core-regression.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/scripts/planner-city-core-regression.ts)
- [planner-quality-check.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/scripts/planner-quality-check.ts)

Voraussetzungen:

- `.env.local` muss gesetzt sein
- benoetigt werden insbesondere:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Event-Ingestion

Der erste echte Provider-MVP fuer Planner-Events ist Ticketmaster.

Build fuer Event-Skripte:

```bash
npm run events:build
```

Ticketmaster-Ingestion ausfuehren:

```bash
npm run events:ingest:ticketmaster -- --city=berlin-berlin --from=2026-04-10 --to=2026-05-10 --pages=3
```

Voraussetzungen:

- `.env.local` muss gesetzt sein
- benoetigt werden:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TICKETMASTER_API_KEY`
  - optional fuer Maerkte/Festivals: `OPENAGENDA_API_KEY`
  - optional fuer OpenAgenda-Mapping:
    - `OPENAGENDA_AGENDAS=berlin-berlin|123456|Berlin|DE|Berlin Feste;hamburg-hamburg|234567|Hamburg|DE|Hamburg Events`

Das Script lebt in [ingest-ticketmaster-events.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/scripts/ingest-ticketmaster-events.ts) und schreibt normalisierte Events nach `planner_events`.

OpenAgenda-Ingestion ausfuehren:

```bash
npm run events:ingest:openagenda -- --city=berlin-berlin --pages=3
```

Das Script lebt in [ingest-openagenda-events.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/scripts/ingest-openagenda-events.ts) und eignet sich besonders fuer Maerkte, Festivals und lokale Community-/Saison-Events.

## Profil und OAuth

Es gibt jetzt eine Profilseite unter [app/profile/page.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/app/profile/page.tsx).

Sie unterstuetzt:

- gespeicherte Interessen pro Nutzer
- oeffentliche Profildaten wie `display_name`, `username`, `avatar_url`
- Login-Start ueber Google und Microsoft
- Uebernahme von Interessen aus einem anonymen Gastprofil nach OAuth-Login

Damit Google und Microsoft live funktionieren, muessen die Provider in Supabase aktiviert werden:

- `Authentication -> Providers -> Google` aktivieren
- `Authentication -> Providers -> Azure / Microsoft` aktivieren
- Redirect-URL auf eure App mit `/profile` setzen
- Client-ID und Client-Secret der Provider in Supabase hinterlegen

## CI

Es gibt einen GitHub-Workflow unter [.github/workflows/planner-regression.yml](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/.github/workflows/planner-regression.yml).

Er fuehrt denselben `check:planner`-Stack aus wie lokal und laedt die Reports als Artefakte hoch.

Damit der Workflow laeuft, muessen in GitHub Actions diese Secrets gesetzt sein:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Weitere Beitragsregeln stehen in [CONTRIBUTING.md](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/CONTRIBUTING.md).
