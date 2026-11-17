# Status

**Nächstes Paket: 1.1**

Stand: 17.11.2026 · Ausgangslage: 502 Tests grün, `tsc --noEmit` grün.

Status-Werte: `offen` · `läuft` · `erledigt` · `wartet` (auf Entscheidung)

---

## Phase 0 – Einrichtung

| Nr. | Paket | Status | Ergebnis |
|---|---|---|---|
| 0.1 | Projektstruktur anlegen | erledigt | `CLAUDE.md`, `docs/neubau/` |

## Phase 1 – Bestand aufnehmen

Je Bereich: Jede Größe mit Formel, Fundstelle (`datei:zeile`), Wirkung und Widersprüchen
erfassen. Kein Code ändern. Ergebnis nach `bestand/VORLAGE.md`.

| Nr. | Bereich | Zu lesende Dateien (Startpunkt) | Ergebnis | Status |
|---|---|---|---|---|
| 1.1 | Zufriedenheit (SAT) | `src/lib/financeUtils.ts` (Catering bis `seatWeightedSatisfaction`, ca. 307–935), `src/data/catering.ts`, `getPlaneSat`-Aufrufer | `bestand/1-zufriedenheit.md` | offen |
| 1.2 | Nachfrage und Marktanteil | `financeUtils.ts` (`calculateDemand`, `eraDemandFactor`, `seasonFactor`, `offerAttractiveness`, `marketShare`, `eventRegionalFactor`), `transferUtils.ts`, `routeMaturity.ts`, `marketing.ts` | `bestand/2-nachfrage.md` | offen |
| 1.3 | Preis und Erlös | `financeUtils.ts` (`calculateBasePrices`, `getSatMultiplier`, `getPriceDemandMultiplier`, `scarcityPremium`, `difficultyFareFactor`, Erlösteil von `calculateRouteFinancials`), Preisregler in `RoutePlannerView.tsx` | `bestand/3-preis.md` | offen |
| 1.4 | Kosten | `financeUtils.ts` (`getAirportUpkeep`, Landegebühren, Slots, Infrastruktur, `getJetFuelPrice`, Kostenteil von `calculateRouteFinancials`), `fleetCosts.ts`, `staff.ts`, `realCosts.ts`, `hubOwnership.ts`, `malus.ts`, `src/data/fuelPrices.ts` | `bestand/4-kosten.md` | offen |
| 1.5 | Ruf, Rang, Fortschritt | `monthClose.ts` (`computeReputationTarget`), `gameState.ts` (Ruf-Wirkung), `airlineRank.ts`, `milestones.ts`, `annualGoals.ts`, `careerScore.ts`, `research.ts`, `aircraftClasses.ts`, `airportAccess.ts` | `bestand/5-ruf-fortschritt.md` | offen |
| 1.6 | Konkurrenz (KI) | `aiSimulation.ts`, `rivalCrisis.ts`, `takeover.ts`, `buildRivalOffers` in `monthClose.ts` | `bestand/6-konkurrenz.md` | offen |
| 1.7 | Monatsabschluss, Ereignisse, Flottenmarkt | `monthClose.ts` (`closeMonth`), `eventSystem.ts`, `disruptions.ts`, `preorders.ts`, `usedMarket.ts`, `getAircraftResaleValue`, `invariants.ts` | `bestand/7-monat-ereignisse.md` | offen |
| 1.8 | Querschnitt: Doppelrechnungen in der Oberfläche | Suche in `src/components/` und `src/App.tsx` nach Formeln, die die Ansicht selbst rechnet statt `src/lib/` aufzurufen | `bestand/8-oberflaeche.md` | offen |
| 1.9 | Zusammenfassung | alle `bestand/*.md` | Liste aller Widersprüche und Entscheidungsfragen in `ENTSCHEIDUNGEN.md` | offen |

## Phase 2 – Spezifikation

| Nr. | Paket | Status |
|---|---|---|
| 2.1 | Entscheidungsfragen aus 1.9 mit dem Menschen klären | offen |
| 2.2 | Grundbegriffe und Einheiten festlegen (Namen, Skalen, Rundung, Schwierigkeit) | offen |
| 2.3–2.9 | Je Bereich 1.1–1.7 den Soll-Zustand in `SPEZIFIKATION.md` schreiben | offen |

## Phase 3 – Modell neu bauen

| Nr. | Paket | Status |
|---|---|---|
| 3.1 | Gerüst `src/model/`, zentrale Konstanten, Regeltest-Muster | offen |
| 3.2–3.8 | Je Bereich das Modell nach Spezifikation bauen, mit Regeltests | offen |
| 3.9 | Balance-Skript: Beispielwerte für typische Strecken und Jahre | offen |

## Phase 4 – Oberfläche anbinden

| Nr. | Paket | Status |
|---|---|---|
| 4.1 | Glossar und Erklärtexte aus den Konstanten erzeugen | offen |
| 4.2+ | Ansichten nacheinander auf `src/model/` umstellen (Aufteilung nach 1.8) | offen |

## Phase 5 – Abschluss

| Nr. | Paket | Status |
|---|---|---|
| 5.1 | Spielstand-Umwandlung (`saveMigration.ts`, neue Version) | offen |
| 5.2 | Alten Rechencode entfernen, Dokumentation aufräumen | offen |
| 5.3 | Spieltest-Durchlauf mit Balance-Skript, Feinabstimmung | offen |

---

## Verlauf

| Datum | Paket | Ergebnis |
|---|---|---|
| 17.11.2026 | 0.1 | Projektstruktur angelegt |
