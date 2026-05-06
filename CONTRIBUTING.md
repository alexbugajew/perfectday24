# Contributing

## Vor einem PR

Bitte vor jedem PR mindestens diesen Check lokal ausfuehren:

```bash
npm run check:planner
```

Der Check umfasst:

- Typecheck
- Build der Regression-Runner
- Planner-Trace-Regression
- Drei-Staedte-Kernflow-Regression
- Daten-/Qualitaetscheck fuer Berlin, Hamburg und Muenchen

Ein PR sollte nur geoeffnet werden, wenn dieser Check gruen ist.

## Planner-spezifische Regeln

- Aenderungen an [lib/planner](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/lib/planner) sollten die Regressionen nicht verschlechtern.
- Aenderungen an [lib/events](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/lib/events) sollten die Qualitaetschecks nicht verschlechtern.
- Die Kernjourneys `date + show`, `friends + event_visit` und `tourism + market_festival` fuer Berlin, Hamburg und Muenchen muessen gruen bleiben.
- Neue Planner-Heuristiken moeglichst mit Trace pruefen und die Reports unter [reports](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/reports) kontrollieren.

## CI

Der Workflow unter [.github/workflows/planner-regression.yml](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/.github/workflows/planner-regression.yml) fuehrt denselben `check:planner`-Stack fuer PRs aus und laedt die Reports als Artefakte hoch.
