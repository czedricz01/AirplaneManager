# Status

**Nächstes Paket: 1.8**

Stand: 17.11.2026 · Ausgangslage: 504 Tests grün, `tsc --noEmit` grün.

Offene Fragen (werden in 1.9 gesammelt, in 2.1 entschieden):
- aus 1.1: sieben Fragen am Ende von `bestand/1-zufriedenheit.md` (Mehrgang-Menü, zwei Flughäfen,
  SAT-Skala, Wirkungswege, Preisdruck unter 100, Schalter-Pflicht, Forschungstext).
- aus 1.2: sieben Fragen am Ende von `bestand/2-nachfrage.md` (Flugzeug-Geschwindigkeit und
  Marktgröße, Preis doppelt, Klassen-Aufteilung, Schwierigkeit, Wachstum, Namen, Langstrecken-Kurve).
- aus 1.3: sieben Fragen am Ende von `bestand/3-preis.md` (Klassen-Faktoren im Planer, Erlös unter
  Marktpreis, Monatslänge, Preise über die Jahre, Schwierigkeit, Planer-Hauptzahl, Umsteiger-Tarif).
- aus 1.4: sieben Fragen am Ende von `bestand/4-kosten.md` (Marge je Streckenlänge und Jahrzehnt,
  Treibstoff-Quelle und Wert nach 2030, Fluggast-Gebühren an beiden Flughäfen, kostenlose Abstellplätze,
  Kostenindex für Einmalpreise, Abschreibung, Treibstoff-Zuschlag Hard).
- aus 1.5: sieben Fragen am Ende von `bestand/5-ruf-fortschritt.md` (Werbung und Ruf, Einmal-Boni,
  Rang nach einem Monat, Flugzeugklassen nach Rang oder Zeit, Zustand im Ruf, Karriere-Punkte,
  Start-Ruf).
- aus 1.6: sieben Fragen am Ende von `bestand/6-konkurrenz.md` (gleiche Regeln für KI, KI-Schwierigkeit
  nur als Verhalten, Persönlichkeiten und Billigflieger, Wachstumsgrenze und Kasse, Zuschuss,
  Übernahme-Preis, Flugzeuge aufgelöster KI).
- aus 1.7: sieben Fragen am Ende von `bestand/7-monat-ereignisse.md` (Spanne Kauf/Verkauf,
  Wertmodell Flugzeug, Grundüberholung, Charter-Kosten, Strafe für gestrichene Flüge, negative Kasse,
  Ereignisse für alle und Preise der Krisen-Antworten).

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
| 1.1 | Zufriedenheit (SAT) | `src/lib/financeUtils.ts` (Catering bis `seatWeightedSatisfaction`, ca. 307–935), `src/data/catering.ts`, `getPlaneSat`-Aufrufer | `bestand/1-zufriedenheit.md` | erledigt |
| 1.2 | Nachfrage und Marktanteil | `financeUtils.ts` (`calculateDemand`, `eraDemandFactor`, `seasonFactor`, `offerAttractiveness`, `marketShare`, `eventRegionalFactor`), `transferUtils.ts`, `routeMaturity.ts`, `marketing.ts` | `bestand/2-nachfrage.md` | erledigt |
| 1.3 | Preis und Erlös | `financeUtils.ts` (`calculateBasePrices`, `getSatMultiplier`, `getPriceDemandMultiplier`, `scarcityPremium`, `difficultyFareFactor`, Erlösteil von `calculateRouteFinancials`), Preisregler in `RoutePlannerView.tsx` | `bestand/3-preis.md` | erledigt |
| 1.4 | Kosten | `financeUtils.ts` (`getAirportUpkeep`, Landegebühren, Slots, Infrastruktur, `getJetFuelPrice`, Kostenteil von `calculateRouteFinancials`), `fleetCosts.ts`, `staff.ts`, `realCosts.ts`, `hubOwnership.ts`, `malus.ts`, `src/data/fuelPrices.ts` | `bestand/4-kosten.md` | erledigt |
| 1.5 | Ruf, Rang, Fortschritt | `monthClose.ts` (`computeReputationTarget`), `gameState.ts` (Ruf-Wirkung), `airlineRank.ts`, `milestones.ts`, `annualGoals.ts`, `careerScore.ts`, `research.ts`, `aircraftClasses.ts`, `airportAccess.ts` | `bestand/5-ruf-fortschritt.md` | erledigt |
| 1.6 | Konkurrenz (KI) | `aiSimulation.ts`, `rivalCrisis.ts`, `takeover.ts`, `buildRivalOffers` in `monthClose.ts` | `bestand/6-konkurrenz.md` | erledigt |
| 1.7 | Monatsabschluss, Ereignisse, Flottenmarkt | `monthClose.ts` (`closeMonth`), `eventSystem.ts`, `disruptions.ts`, `preorders.ts`, `usedMarket.ts`, `getAircraftResaleValue`, `invariants.ts` | `bestand/7-monat-ereignisse.md` | erledigt |
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
| 17.11.2026 | 1.1 | SAT-Bestand aufgenommen: 35 Größen, 15 Auffälligkeiten (u. a. Zusatzgericht senkt SAT, Planer zeigt andere SAT als Wirtschaft, Rivalen immer SAT 100), 7 offene Fragen |
| 17.11.2026 | 1.2 | Nachfrage-Bestand aufgenommen: 37 Größen, 14 Auffälligkeiten (u. a. Marktgröße hängt vom Flugzeug ab, Aufteilen auf Parallelstrecken gewinnt Anteil, Premium fast immer 9 %, Hard-KI mit schlechterer Wirtschaft), 7 offene Fragen |
| 17.11.2026 | 1.3 | Preis-Bestand aufgenommen: 29 Größen, 11 Auffälligkeiten (u. a. Planer-Hauptzahl „volle Maschine“ steigt mit jedem Preis, feste Klassen-Faktoren 1,6/3/5, Economy unter Marktpreis bringt mehr Erlös, KI-Preise ohne Marktpreis, Monat = 4 Wochen), 7 offene Fragen |
| 17.11.2026 | 1.4 | Kosten-Bestand aufgenommen: 47 Größen, 15 Auffälligkeiten (u. a. Langstrecke verliert bei fast jedem Treibstoffpreis, 2020 kaum eine Strecke mit Gewinn, Treibstoff fällt 2031 auf 1960, Fluggast-Gebühren an beiden Flughäfen, Hard verteuert KI-Treibstoff), 7 offene Fragen |
| 17.11.2026 | 1.5 | Ruf-, Rang- und Fortschritts-Bestand aufgenommen: 46 Größen, 14 Auffälligkeiten (u. a. Werbung hebt Ruf dauerhaft um bis zu 15, Meilenstein-Boni nach einem Jahr fast weg, Rang-Texte zu Forschungsplätzen falsch, Concorde im freien Spiel kaum erreichbar, feste Dollar-Beträge über 60 Jahre), 7 offene Fragen |
| 17.11.2026 | 1.6 | Konkurrenz-Bestand aufgenommen: 63 Größen, 11 Auffälligkeiten (u. a. Persönlichkeit entscheidet über Reichtum, Flag-Carrier mit 20+ Mrd. $ Kasse, KI ohne Flughafen-Kosten, Anlauf und Verschleiß, Hard-KI rechnet schlechter, Easy-KI lebt vom Zuschuss, Übernahme ohne Alter und Kasse), 7 offene Fragen |
| 17.11.2026 | 1.7 | Monatsabschluss-, Ereignis- und Flottenmarkt-Bestand aufgenommen: 59 Größen, 14 Auffälligkeiten (u. a. Gebrauchtkauf mit Sofortverkauf +5 %, Vorbestellung unter Wiederverkaufswert, Grundüberholung 200 000 $ hebt Wert um Millionen, Charter immer teurer als Streichen, Spieler-Kasse ohne Folge negativ, Bericht-Kasse ohne Lieferungen), 7 offene Fragen |
