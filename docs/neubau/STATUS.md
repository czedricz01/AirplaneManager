# Status

**Nächstes Paket: 3.9b** – Balance-Skript Teil 2: Langläufe mit `closeMonth` ohne Spieler (KI ab 1960, je Persönlichkeit
10 Läufe): „ähnlicher Erfolg“ (7.4), Abschaffung des Zuschusses (7.14), Preise und Preiskampf mit Rivalen (7.6, Nachweis
zu O60; nach E65 auch, ob die Optimizer-Preise störend springen), Umsteiger-Anteil (3.13), Slot-Anteile, Dividende, neue
Drehkreuze, KI-Stärke, Eröffnungen und Käufe je Jahr, Rechenzeit. Zuerst die Rechenzeit eines Laufs messen und die Flughafen-Auswahl festlegen. Liste in
`BALANCE.md`, Abschnitt „Noch offene Prüfregeln“. Startpunkt: `src/balance/` (Gerüst aus 3.9a), `src/model/rivalMonth.ts`
(`rivalDecisions`, `rivalRefill`, `foundRivalCompany`), `src/model/monthClose.ts` (`closeMonth`).

Stand: 19.11.2026 · Paket 3.9a erledigt: Balance-Skript `npm run balance` (Rechnung in `src/balance/`, Aufruf
`scripts/balance.ts`) mit 19 Prüfregeln zu den Abschnitten 1–5: 5 ok, 2 Abweichung, 12 Info; Bericht
`docs/neubau/balance/3.9a-bericht.md`, Bewertung `docs/neubau/BALANCE.md`. Wichtigster Fund: Ein Flugzeug allein ist fast
überall bei jedem Preis voll; bester Preis 1,3–4 × Marktpreis, Margen 59–77 % (O60). Paket 3.9 geteilt (F44).
1215 Tests grün, `tsc --noEmit` grün.

Nachtrag 19.11.2026: O61 → E64 (Regel 3.3 gilt für die Summe aller Paare, `DEMAND_GROWTH_1960_2019` = 2,25),
O62 → E65 (kein fester Punkt beim Preiskampf nötig, B4.3 nur Info). Spezifikation 3.3 und 7.6 angepasst; Bericht neu:
`docs/neubau/balance/O61-O62-bericht.md` mit 6 ok, 0 Abweichung, 13 Info. 1215 Tests grün, `tsc --noEmit` grün.

Offene Frage: O60 (Marktgröße gegenüber einem Flugzeug); Empfehlung in `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“.
Blockiert 3.9b nicht; erst mit dem Ergebnis von 3.9b entscheiden.

Offen aus 3.9a (kein Blocker): Prüfregeln der Abschnitte 6 und 8 ohne Langlauf in 3.9c (Liste in `BALANCE.md`). Nach
der Entscheidung zu O60 die Konstanten ändern, `npm run balance -- --out docs/neubau/balance/<paket>-bericht.md` neu
erzeugen und die Spezifikation (3.6) anpassen. Schwierigkeit (B3.5) erst nach O60 einstellen. E65: Zeigt 3.9b störende
Sprünge der Optimizer-Preise, bekommt der Optimizer eine Schrittgrenze `FARE_STEP` (7.6).

Offen aus 3.2a (kein Blocker): Der Test „Kaufdialog-Anzeige = Modellwert“ (2.3) folgt, wenn der Kaufdialog
auf `interiorScoreParts` umgestellt wird (Phase 4).
Offen aus 3.2b (kein Blocker): „Planer-Wert = Wert im Monatsabschluss“ (2.7) wird geprüft, wenn Planer und
Monatsabschluss `satisfactionBreakdown` nutzen (Phase 4 / 3.8). Wer `GroundSide` (Einrichtungen je Ende),
Cabin rating, Service points und Moral aus dem Spielstand baut, regeln 3.8 bzw. Phase 4 (F22). Stärke der
Service-Abzüge und Kurve von `satisfactionFactor` prüft das Balance-Skript (3.9, E15).
Offen aus 3.3a (kein Blocker): Die Balance-Regeln aus 3.3 (Marktgröße im Mittel aller Paare 1960 → 2019 × 2,5)
und 3.7 (Premium-Anteil schwankt über alle Paare um mindestens 3 Prozentpunkte) prüft das Balance-Skript (3.9).
Offen aus 3.3b (kein Blocker): Balance-Skript (3.9) prüft Umsteiger typisch unter 25 % in Märkten mit
Direktangebot (3.13) und die Stärke von `FLIGHT_TIME_EXP` (3.9.3). Die Regel „Planer-Wert = Wert im
Monatsabschluss“ (3.11, R2) wird geprüft, wenn Planer und Monatsabschluss das Modell nutzen (Phase 4 / 3.8).
Wer Angebote aus dem Spielstand baut (Strecken je Paar, Fahrpläne, Alter, Laufmonate), regelt 3.8 bzw. Phase 4.
Offen aus 3.4 (kein Blocker): Planer-Hauptzahl „Expected weekly profit“, Nebenzahlen „First month“ und
„Full aircraft“ mit Kosten (4.12) sowie `bestFare` / `breakEvenFareLevel` mit echten Kosten: Bausteine seit 3.5b
(`costPerPassenger`, `fixedWeeklyCost`, `routeResult`), Anschluss in Phase 4. Die Regeln „Planer-Erlös = Erlös im Monatsabschluss“
(4.7, R2), „Preisänderung ändert die Fluggäste des laufenden Monats nicht“ (4.5) und „Hauptzahl = Gewinn im
Monatsabschluss“ (4.12) prüft 3.8 / Phase 4. Ob gegenseitiges Unterbieten mit `bestFare` in Grenzen bleibt
(4.10, Hinweis), prüft das Balance-Skript (3.9) mit Abschnitt 7.
Offen aus 3.5a (kein Blocker): „Planer-Kosten = Kosten im Abschluss“ (5.16, R2) prüft 3.8 / Phase 4. Höhe von Landegebühr (26–40 % der Kurzstrecken-Kosten) und Abfertigung
ohne Bodenpersonal-Aufschlag prüft das Balance-Skript (3.9). Lohn-Grenzen 80 … 130 setzt 8.7.
Offen aus 3.5b (kein Blocker): `bestFare` und `breakEvenFareLevel` nehmen `costPerPassenger` und `fixedWeeklyCost`
als Zahlen; wer sie aus dem Spielstand baut (Strecken, Flugzeuge, Blockstunden, Slots, Schalter-Last), regeln 3.8
und Phase 4, ebenso „Planer-Ergebnis = Strecken-Ergebnis im Abschluss“ (5.9, R2). Die Abschnitt-8-Posten
(`MonthEventCosts`) und die Buchung von `monthlyCosts` liefert 3.8; dort auch die Überholungs-Regel aus 5.19 (Preis ≥
Wertgewinn `CONDITION_VALUE_SPAN × AIRFRAME_VALUE_SHARE` je Zustandspunkt) und die Slot-Grenze beim Kauf (E50,
auch KI, 3.7). `milestoneSlotFactor` liefert 3.6. Höhe der Listenpreise (E54), Abschreibung (`DEPRECIATION_YEARS`,
`RESIDUAL_SHARE`) und die hohe Langstrecken-Marge aus 5.18 prüft das Balance-Skript (3.9).

Offen aus 3.6a (kein Blocker): Die Regel „keine andere Funktion schreibt den Ruf“ (6.5, R10) und die Reihenfolge
im Abschluss (6.15) prüft 3.8. Wer `cancelledShare`, die Regionen der Strecken-Enden und die Rang-Werte der letzten
3 Monate aus dem Spielstand baut, regeln 3.8 und Phase 4. Ruf-Steigungen, `CANCELLED_REPUTATION_WEIGHT`, Werbe-Beitrag,
Ruf-Schwellen der Ränge und die Bezahlbarkeit der Klassen-Forschung (6.8) prüft das Balance-Skript (3.9). E63 setzt 3.7
um (Sperre in 7.9, 7.10, 7.13).

Offen aus 3.6b (kein Blocker): Die Felder `defectFactor`, `wearFactor`, `resaleBonus`, `moralePoints` aus
`researchEffects` wendet 3.8 an (Ausfälle, Verschleiß, Verkauf, Personal); `demandFactor`, `hubQualityFactor` und
`rampBonus` reicht der Aufrufer (3.8 / Phase 4) an `offerAppeal`, `hubQuality` und `rampFactor` weiter. Wer
`MilestoneContext`, Jahres-Berichte und `companyValue` aus dem Spielstand baut und Prämien, Strafe und Forschungspreis
in der Kasse bucht (nicht im Monatsergebnis), regelt 3.8. Spielstand (5.1): alte Meilenstein-Ids `continents-*` und
`reputation-60/80/95` nach Stufe auf `regions-*` und `reputation-bronze/silver/gold`, `startedOffset` → `startMonth`,
Ruhmeshalle mit `splitHall` teilen (F37). Ziel-, Prämien- und Straf-Anteile (6.11) prüft das Balance-Skript (3.9).

Offen aus 3.7a (kein Blocker): Den Kaufdialog auf `cabinSpace`, `seatSpace`, `economySeatsLeft` umstellen und den
Spieler-Start auf `START_HUB_SETUP` (Phase 4). Wer `RIVAL_INPUTS` an die Funktionen reicht, Lage und Preiskampf je
Paar speichert und die Zufallszahlen aus `rng` holt, regeln 3.7b / 3.8. Kabinen-Werte, `FARE_POSITION`, Preiskampf
und Optimizer-Antworten über dem Boden, KI-Stärke-Werte prüft das Balance-Skript (3.9, Prüfregel „ähnlicher Erfolg“).
Spielstand (5.1): alte KI-Stärke `Easy/Normal/Hard` über `rivalStrengthOf`, KI-Flugzeuge mit Kabine nach `rivalCabin`.

Offen aus 3.7b (kein Blocker): 3.8 setzt die Entscheidungen aus `rivalMonth.ts` in der Reihenfolge
`RIVAL_DECISION_STEPS` nach der Buchung zusammen und liefert die Zahlen dafür (Planer-Hauptzahl je Plan,
`saleProceeds`, `overhaulPrice`, `creditLimit`, Gebrauchtmarkt). Dort auch die Tests „Buchung unabhängig von der
Reihenfolge der KI“ (7.8), „Verkaufserlös KI = Spieler“, „verkaufte KI-Flugzeuge im Gebrauchtmarkt“ (7.11),
„Dividende ändert weder Ergebnis noch Ruf“ (7.13) und „Übernahme ändert das Monatsergebnis nicht“ (7.16), F39 (10).
Slot-Anteile, Dividenden-Grenze, `NEW_HUB_MIN_SEATS`, Zuschuss-Abschaffung und „ähnlicher Erfolg“ prüft das
Balance-Skript (3.9). Rivalen-Ansicht, Ticker und Meldungstexte aus dem Modell: Phase 4. Spielstand (5.1): Notlage
als `{ status, distressMonths, forSaleMonths }`.

Offen aus 3.8a (kein Blocker): 3.8b setzt die Bausteine in `closeMonth` zusammen (Reihenfolge 8.0) und prüft dort
„Buchung unabhängig von der Reihenfolge der KI“ (7.8), „Dividende ändert weder Ergebnis noch Ruf“ (7.13), „Übernahme
ändert das Monatsergebnis nicht“ (7.16), die Kassen-Gleichung (8.2), Vogelschlag und Lieferung im Bericht dieses Monats
(8.6, 8.12), „ein Test mit `closeMonth` ändert keine globalen Daten“ (8.3) und „ein halber Flugplan bringt höchstens die
Hälfte weniger Fluggäste“ mit der Marktaufteilung (8.9). `HEDGE_PRICE_SHARE`, `RECOVERY_PRICE_SHARE`, `CHARTER_MARKUP`,
Spanne, Rabatt, `OVERHAUL_PRICE_SHARE`, Verschleiß, `CREDIT_LIMIT_SHARE`, `CREDIT_RATE` prüft das Balance-Skript (3.9).
Phase 4: Fragen (Krise, Charter, Streik), Gebrauchtmarkt (Verkäufer-Text) und Kopfzeile „Credit used“ aus dem Modell.
Spielstand (5.1): Zufallsereignisse in den Spielstand, Störungen als `{ month, kind, target, share, charter? }`, Streik
als `{ month, answer?, agreedPct? }`.

Offen aus 3.8b (kein Blocker): Phase 4 / 5.1: alten Spielstand in `ModelState` umwandeln (Typ-Werte, Interior score, Service je
Klasse, Kassenbuch), Einweg-Umläufe, Störungs-Antworten des Spielers je Gesellschaft. Ein voll ausgelastetes A320 auf
FRA–MAD (14 Abflüge) bleibt bei jedem Preis voll; ob die Marktgröße zu groß ist, prüft das Balance-Skript (3.9).

Offen aus 3.8c (kein Blocker): Entscheidungen der KI stehen im Bericht X als `decisionsCash` / `decisionsValueChange`,
nicht im Ergebnis (F42). 3.8d: Eröffnungen, Wachstum, Slots, Schalter, Lounge, Zuschuss, Nachrücken, Kabinen-Umbau
und Fahrpläne der KI (ohne Fahrplan bietet auch die KI keine Umsteiger an). Phase 4: Fahrpläne der Spieler-Strecken als
`RouteSchedule`, Wahl des Jahresziels aus `goalOffers`, Meldungstexte zu `CloseNews`, Szenario-Daten in Werte von 1960
(5.1). Balance-Skript (3.9): Umsteiger-Anteil unter 25 % in Märkten mit Direktangebot (3.13), Szenario-Ziele.

Offen aus 3.8d (kein Blocker): Phase 4 füllt `ModelState.catalog` (aus `src/data/aircraft.ts`) und alle Flughäfen mit
`maxIcaoCode`, ruft `closeMonth(state, rivalDecisions, rivalRefill({ wanted, strength }))` auf und zeigt die neuen
Meldungen (`routeOpened`, `planeBought`, `modernized`, `cabinRenewed`, `slotsSold`, `loungeBuilt`, `newHub`, `newRival`)
und die Zeile „Subsidy“. Rechenzeit der KI-Planung mit allen Flughäfen (Vorauswahl über alle, Bewertung nur der
Suchbreite) prüft das Balance-Skript (3.9). Balance-Skript: Zahl der Eröffnungen und Käufe je Jahr, Slot-Anteile,
`RIVAL_TURN_MINUTES`, Zuschuss-Abschaffung (7.14), „ähnlicher Erfolg“ (7.4). Spielstand (5.1): KI-Agent mit `slotFree`,
`hubNoProfit`, `refits`; KI-Strecken mit Fahrplan; `inputs.subsidized` für die KI.

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
| 1.8 | Querschnitt: Doppelrechnungen in der Oberfläche | Suche in `src/components/` und `src/App.tsx` nach Formeln, die die Ansicht selbst rechnet statt `src/lib/` aufzurufen | `bestand/8-oberflaeche.md` | erledigt |
| 1.9 | Zusammenfassung | alle `bestand/*.md` | Liste aller Widersprüche und Entscheidungsfragen in `ENTSCHEIDUNGEN.md` | erledigt |

## Phase 2 – Spezifikation

| Nr. | Paket | Status |
|---|---|---|
| 2.1a | Block A (Querschnitt: O3–O11) aus `ENTSCHEIDUNGEN.md` mit dem Menschen klären, inkl. Bauregeln R1–R16 | erledigt |
| 2.1b | Block B (Markt: O2, O12–O24) klären | erledigt |
| 2.1c | Block C (Kosten, Flottenwert, Monat, Ereignisse: O25–O33) klären | erledigt |
| 2.1d | Block D (Ruf, Rang, Konkurrenz, Oberfläche: O1, O34–O49) klären | erledigt |
| 2.2 | Grundbegriffe und Einheiten festlegen (Namen, Skalen, Rundung, Schwierigkeit) | erledigt |
| 2.3 | Soll-Zustand Zufriedenheit (`SPEZIFIKATION.md` Abschnitt 2) | erledigt |
| 2.4 | Soll-Zustand Nachfrage und Marktanteil (`SPEZIFIKATION.md` Abschnitt 3) | erledigt |
| 2.5 | Soll-Zustand Preis und Erlös (`SPEZIFIKATION.md` Abschnitt 4) | erledigt |
| 2.6 | Soll-Zustand Kosten (`SPEZIFIKATION.md` Abschnitt 5) | erledigt |
| 2.7 | Soll-Zustand Ruf, Rang, Fortschritt (`SPEZIFIKATION.md` Abschnitt 6) | erledigt |
| 2.8 | Soll-Zustand Konkurrenz (`SPEZIFIKATION.md` Abschnitt 7) | erledigt |
| 2.9 | Soll-Zustand Monatsabschluss, Ereignisse, Flottenmarkt (`SPEZIFIKATION.md` Abschnitt 8) | erledigt |

## Phase 3 – Modell neu bauen

| Nr. | Paket | Status |
|---|---|---|
| 3.1 | Gerüst `src/model/`, zentrale Konstanten, Regeltest-Muster | erledigt |
| 3.2a | Zufriedenheit Teil 1 (`SPEZIFIKATION.md` 2.1–2.5): Flugzeit-Index, Type appeal, Interior score, Cabin rating, Service points | erledigt |
| 3.2b | Zufriedenheit Teil 2 (2.6–2.10): Teile der Satisfaction, Satisfaction je Klasse, Offer/Route/Airline satisfaction, `satisfactionFactor` | erledigt |
| 3.3a | Nachfrage Teil 1 (3.1–3.7): Bezugs-Flugzeit, Verflechtung, Wachstum, Entfernung, Ereignisse, Marktgröße, Klassen-Anteil | erledigt |
| 3.3b | Nachfrage Teil 2 (3.8–3.14): Anziehung, „Nicht fliegen“, Aufteilung, Anlauf, Umsteiger; `satisfactionFactor` als Eingabe, solange 3.2b wartet | erledigt |
| 3.4 | Preis und Erlös (Abschnitt 4) | erledigt |
| 3.5a | Kosten Teil 1 (5.1–5.8): Kosten-Faktoren, Treibstoffpreis mit Krisen (E61), Treibstoff, Besatzung, Landung, Check-in und Abfertigung, Verpflegung, Kosten je Fluggast | erledigt |
| 3.5b | Kosten Teil 2 (5.9–5.18): feste Kosten je Strecke (E57), Flughäfen, Verwaltungsstufen, Einrichtungen, Unterhalt, Wertmodell, Werbung, Einnahme, Kosten der Gesellschaft, Beispiel 5.18 | erledigt |
| 3.6a | Fortschritt Teil 1 (6.1–6.8): Ruf aus Satisfaction, gestrichene Flüge, Werbe-Beitrag, Ruf-Ziel, Ruf-Änderung mit Ursachen, Farbstufen, Rang mit 3-Monats-Mittel, Flugzeugklassen | erledigt |
| 3.6b | Fortschritt Teil 2 (6.9–6.14): Forschung mit Feldern, Meilensteine, Jahresziel, Karriere-Punkte | erledigt |
| 3.7a | Konkurrenz Teil 1 (7.1–7.7): neutrale Eingaben, fehlende Teile, KI-Stärke, Persönlichkeiten, Kabine und Service, Preise mit Preiskampf, Gründung | erledigt |
| 3.7b | Konkurrenz Teil 2 (7.8–7.17): Monat der KI, Planung, Slots/Schalter/Drehkreuze (E63), Flotte, Krise, Wachstum, Dividende, Zuschuss, Notlage, Übernahme, Ticker | erledigt |
| 3.8a | Monatsabschluss Teil 1 (8.3–8.14): Zufall und Spielstand, Ereignisse, Krisen-Antworten, Störungen, Personal, Pech-Deckel, gestrichene/gecharterte Flüge, Verschleiß, Händler-Spanne und Gebrauchtmarkt, Vorbestellung, Überholung, Kreditlinie | erledigt |
| 3.8b | Monatsabschluss Teil 2 (8.0–8.2, 8.16): `closeMonth` für Spieler und KI in einer Rechnung, Kasse am Monatsende mit Kassen-Gleichung, Bericht, Lieferungen, Kreditlinie, Prüfung, Übergang, offene R2-Regeln | erledigt |
| 3.8c | Monatsabschluss Teil 3 (7.8–7.16 im Abschluss, 3.13, 6.9–6.11, 8.15): KI-Entscheidungen `rivalDecisions`, Umsteiger im Abschluss, Forschung, Meilensteine, Rang, Jahresziel, Szenario-Ziele | erledigt |
| 3.8d | Monatsabschluss Teil 4 (7.7, 7.9–7.11, 7.13, 7.14 im Abschluss): KI-Eröffnungen, Wachstum (Kauf, Modernisierung, neues Drehkreuz), Slots, Schalter, Lounge, Zuschuss, Nachrücken, Kabinen-Umbau und Fahrpläne der KI | erledigt |
| 3.9a | Balance-Skript Teil 1: Gerüst, Abschnitte 1–5 ohne Langlauf (Zeit und Geld, Zufriedenheit, Nachfrage über alle Paare, Preis und Kosten typischer Strecken, Preiskampf) | erledigt |
| 3.9b | Balance-Skript Teil 2: Langläufe mit `closeMonth` ohne Spieler (Abschnitt 7, Umsteiger 3.13) | offen |
| 3.9c | Balance-Skript Teil 3: Abschnitte 6 und 8 ohne Langlauf (Ruf, Rang, Forschung, Jahresziel, Szenario, Krisen-Antworten, Charter, Flottenmarkt, Kreditlinie) | offen |

## Phase 4 – Oberfläche anbinden

| Nr. | Paket | Status |
|---|---|---|
| 4.1 | Glossar und Erklärtexte aus den Konstanten erzeugen | offen |
| 4.2+ | Ansichten nacheinander auf `src/model/` umstellen (Vorschlag 4.2–4.7 in `bestand/8-oberflaeche.md`) | offen |

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
| 17.11.2026 | 1.8 | Oberflächen-Bestand aufgenommen: 13 Regeln nur in der Oberfläche, 12 Kopien von Modell-Formeln, 9 Texte mit festen Zahlen, 5 doppelte Quellen; 9 Auffälligkeiten (u. a. Planer zeigt Schalter- und Standmieten in Preisen von 1960, Slot-Grenze nur in Ansichten, Preise von Hub-Einrichtungen im Klick-Handler); Vorschlag für die Pakete 4.2–4.7, 7 offene Fragen |
| 17.11.2026 | 1.9 | Zusammenfassung: 56 Einzelfragen und O1–O6 zu 49 Fragen (O1–O49) mit Empfehlung in 4 Blöcken zusammengelegt, 16 Bauregeln (R1–R16) für Funde ohne Entscheidung; alle 103 Funde zugeordnet; Paket 2.1 in 2.1a–2.1d geteilt |
| 18.11.2026 | 2.1a | Block A entschieden: alle 9 Empfehlungen übernommen (E4–E12): Schwierigkeit nur auf Spieler-Nachfrage, Normal = 1, KI-Wirtschaft neutral; Monat = 4,35 Wochen; ein Kostenindex für alle Beträge inkl. Grundpreise; Treibstoff nur aus Tabelle; neue Namen statt „SAT“; Gewichtung nach Fluggästen; Startwerte als Konstanten; Bauregeln R1–R16 bestätigt |
| 18.11.2026 | 2.1b | Block B entschieden (E13–E26): 12 Empfehlungen übernommen; Abweichungen: Geschwindigkeit wirkt spürbar stärker in der Anziehung (E20), Klassen-Aufteilung mit Richtung Tourismus → Economy, Geschäft → Business/First (E21) |
| 18.11.2026 | 2.1c | Block C entschieden (E27–E35): 8 Empfehlungen übernommen (u. a. Wertmodell mit Abschreibung als Kosten, Händler-Spanne, Charter ohne eigene Flugkosten, Kreditlinie mit Zwangsverkauf und Spielende, Ereignisse für alle); Abweichung: Abstellplätze ab Stufe 2 bleiben ohne Unterhalt (E28) |
| 18.11.2026 | 2.1d | Block D entschieden (E36–E52): 15 Empfehlungen übernommen (u. a. Ruf neutral 50, keine Einmal-Sprünge, Rang über 3 Monate, gleiche Wirtschaft für die KI, Übernahme zum Unternehmenswert, Slot = Abflug je Woche); Abweichungen: Werbung behält einen kleinen, abklingenden Ruf-Beitrag (E37), Flugzeugklassen bleiben an den Rang gebunden, mit niedrigeren Schwellen (E41) |
| 18.11.2026 | 2.2 | Grundbegriffe in `SPEZIFIKATION.md` Abschnitt 1: Zeit (Spielmonat, stetige Zeit, 4,348 Wochen je Monat), Mengen, Spiel-Dollar mit einem Kostenindex über `atCost`, Skalen mit Neutralpunkten, Namen (E9), Slot = Abflug je Woche, Rundung nur in der Anzeige, Schwierigkeit getrennt von KI-Stärke; 2 neue Fragen (O50 Schwierigkeit im gemeinsamen Markt, O51 Listenpreise mit Kostenindex) |
| 18.11.2026 | 2.3 | Zufriedenheit in `SPEZIFIKATION.md` Abschnitt 2: 16 Größen von Flugzeit-Index bis `satisfactionFactor`; Satisfaction wirkt nur noch über die Anziehung (als Zahlungsbereitschaft) und den Ruf; Menü mit abnehmendem Nutzen, stufenlose Mahlzeiten, Bodenteile als Mittel beider Enden, Forschung +1 je Stufe, kein Ausfall-Abzug; alle 15 Funde aus 1.1 zugeordnet. O50 → E53 (Schwierigkeit über die Anziehung), O51 → E54 (Listenpreise mit Kostenindex); 1.2 auf vier Klassen berichtigt; neue Frage O52 (Schalter) |
| 18.11.2026 | 2.4 | Nachfrage und Marktanteil in `SPEZIFIKATION.md` Abschnitt 3: Marktgröße ohne Flugzeug und Schwierigkeit (Bezugs-Flugzeit 800 km/h, Weltanteil der Städte + eine Wachstumsregel × 2,5, Entfernungs-Kurve ohne Untergrenze), neue Klassen-Anteile nach Geschäftsanteil und Flugzeit, eine Aufteilung je Markt mit „Nicht fliegen“ (Anziehung aus Abflügen, Preis/Satisfaction, Flugzeit, Ruf u. a.), Bezugsangebot ohne Rivalen erlösbest am Marktpreis (E24), Anlauf nach der Wahl, Umsteiger als Angebote im selben Markt; alle 14 Funde aus 1.2 zugeordnet; keine neue offene Frage |
| 18.11.2026 | 2.5 | Preis und Erlös in `SPEZIFIKATION.md` Abschnitt 4: Marktpreis nur aus Entfernung, Bezugs-Flugzeit und Kostenindex (gleich für alle Angebote, ohne Schwierigkeit und SAT), eine Funktion für die Klassen-Verhältnisse, Knappheits-Zuschlag entfällt (Knappheit hebt den besten Preis), Preis als Preisniveau × Marktpreis, Erlös = Fluggäste × Preis × 4,348 Wochen, Umsteiger-Erlös nach Marktpreisen der Teilstrecken, gewinnbester Preis und Gewinnschwelle aus dem Modell, Planer-Hauptzahl = erwarteter Gewinn; alle 11 Funde aus 1.3 zugeordnet; neue Frage O53 (Preis speichern) |
| 18.11.2026 | 2.6 | Kosten in `SPEZIFIKATION.md` Abschnitt 5: drei Ebenen (Kosten je Fluggast, feste Kosten je Strecke, Kosten der Gesellschaft); Treibstoff nur aus der Tabelle (nach 2030 letzter Wert); Flugbegleiter nach Kabine; Landung je Abschnitt am Ziel; Check-in je Reise, Abfertigung je Abflug (Bodenpersonal darin); ein Gebühren-Nachlass; alle festen Beträge über `atCost` (auch Verpflegung, Slots, Stufen, Werbung); Wertmodell mit Abschreibung als Ergebnis-Posten (Kauf zum Wert ergebnisneutral); KI zahlt alles; alle 15 Funde aus 1.4 zugeordnet; neue Frage O54 (Flugzeug- und Slot-Anteil in den Strecken-Kosten) |
| 18.11.2026 | 2.7 | Ruf, Rang, Fortschritt in `SPEZIFIKATION.md` Abschnitt 6: Ruf-Ziel aus Airline satisfaction (100 → 50, 160 → 100), Abzug für gestrichene Sitze und kleinem Werbe-Beitrag im Ziel (höchstens 3, klingt mit dem Ruf ab); eine Funktion `reputationChange` mit Ursachen-Liste; keine Einmal-Sprünge; Rang im 3-Monats-Mittel mit neuen Ruf-Schwellen 30 … 65, Forschungsplätze 3 / 4 / 5 ab Rang 4 / 6 / 8; Klassen-Forschung gesenkt (Narrowbody 2, Widebody 4, Jumbo und Überschall 5, Überschall braucht Widebody, Preise gesenkt) mit Prüfung: Concorde ab 1972 erforschbar; Forschungs-Wirkungen als 15 Felder; Meilensteine und Jahresziel nur Geld und Freischaltungen, alle Beträge über `atCost`; Karriere-Punkte mit zwei Ruhmeshallen, Forschung 5 statt 15; alle 14 Funde aus 1.5 zugeordnet; neue Frage O55 (Jahresziel verfehlt) |
| 18.11.2026 | 2.8 | Konkurrenz in `SPEZIFIKATION.md` Abschnitt 7: KI rechnet mit denselben Funktionen (Tabelle 7.1), Liste der bewusst fehlenden Teile mit neutralen Werten (Forschung, Personal, Werbung, Frequent flyer, Schwierigkeit, Rang, Krisen-Antworten, Charter); KI-Stärke nur Verhalten; Persönlichkeiten nur als Entscheidungen mit echten Kostenvorteilen über die Kabine (LCC 202 statt 134 Sitze im A320ceo) und Prüfregel „ähnlicher Erfolg“; KI-Preise = Preis-Lage × `satisfactionFactor`, Anpassung nach Auslastung, Preiskampf einmal −12 % mit Boden über den Kosten; KI kauft Slots (Anteil je Flughafen), Schalter, Flugzeuge zum Wert; Größe in Sitzen, weitere Drehkreuze ab Größe 5, Dividende über 12 Monatskosten; Zuschuss mit `atCost` bis zur Prüfung; Notlage „in Folge“, Flotte aufgelöster KI in den Gebrauchtmarkt; Übernahme zum Unternehmenswert mit Kasse und Slots je Flughafen; Ticker nach Fluggästen; Rückschlag entfällt; alle 11 Funde aus 1.6 zugeordnet; neue Fragen O56 (Preiskampf gegen wen) und O57 (Stufe 3 und KI) |
| 18.11.2026 | 2.9 | Monatsabschluss, Ereignisse, Flottenmarkt in `SPEZIFIKATION.md` Abschnitt 8: `closeMonth` als reine Funktion mit Zufallsgeber im Spielstand, eine Rechnung für Spieler und KI, Kasse am Monatsende nach allen Buchungen mit Kassen-Gleichung; Ereignisse nur über die Marktgröße (8 Zufalls-Vorlagen), Krisen-Antworten als Anteil von Treibstoff-Rechnung bzw. Erlös; Defekte je Flugzeug, Flughafen-Streik und Wetter für alle, Vogelschlag als Anteil des Neupreises; Charter = 1,5 × eigene Flugkosten je Flug (lohnt jetzt), nur `cancelledShare` als Strafe; Verschleiß aus geflogenen Stunden; Händler-Spanne −15 % / +5 %, Vorbestell-Rabatt bis 12 %, Überholung mindestens so teuer wie ihr Wertgewinn; Kreditlinie 50 % des Flottenwerts, 8 % Zins, Zwangsverkauf nach 6 Monaten, Spielende ohne Flugzeuge; alle 14 Funde aus 1.7 zugeordnet; Fund: Treibstoff-Tabelle ohne Krisen → neue Fragen O58 und O59 (Überholung ohne Hangar). Phase 2 abgeschlossen |
| 18.11.2026 | 3.1 | Gerüst `src/model/`: `constants.ts` (Zeit, Liter je Gallone, Kostenindex, 10 Skalen mit Neutralpunkten, Schwierigkeit), `basics.ts` (`yearOf`, `timeOf`, `costIndex`, `atCost`, `clamp`, `clampScale`, `difficultyFactor`), `rng.ts` (zustandsloser Zufallsgeber nach 8.3), `README.md` (Aufbau, R1–R4, Testmuster); 32 Regeltests zu 1.1–1.8 und 8.3; Bau-Festlegungen F1–F4; Pakete 3.2–3.8 aufgeteilt (3.2a/3.2b), 3.2b wartet auf O52 |
| 18.11.2026 | 3.2a | Zufriedenheit Teil 1: `src/model/satisfaction.ts` (`flightTimeIndex`, `typeAppeal`, `menuPoints`, `mealCount`, `mealWeight`, `serviceCapability`, `servicePoints`) und `src/model/cabin.ts` (`interiorScore`, `cabinRating`, `averageCabinRating`); Kabinen-Tabellen mit Lieferbarkeit und alle Konstanten 2.1–2.5 in `constants.ts`; 42 Regeltests (578 grün); Bau-Festlegungen F5–F8; Paket 3.3 in 3.3a/3.3b geteilt |
| 18.11.2026 | 3.3a | Nachfrage Teil 1: `src/model/demand.ts` (`distanceKm`, `blockMinutes`, `referenceBlockMinutes`, `citySize` stetig, `worldScale`, `relativeSize`, `businessLinkage`, `tourismLinkage`, `seasonFactor`, `southernShare`, `businessShare`, `demandGrowth`, `distanceFactor`, `eventDemandFactor`, `marketSize` + `marketSizeParts`, `classShare`/`classShares`); alle Konstanten 3.1–3.7 in `constants.ts`; 37 Regeltests (615 grün); Bau-Festlegungen F9–F13 (F13: Schreibfehler in Spezifikation 3.7 berichtigt) |
| 18.11.2026 | 3.3b | Nachfrage Teil 2: `src/model/marketSplit.ts` (`directOffer`, `offerAppeal` mit 11 Faktoren, `noFlyAppeal`, `classPotential`, `rampFactor`, `marketSplit` mit Anlauf, Sitz-Grenze und Überlauf, `distributeToRoutes`, `passengerShare`, `departureShare`) und `src/model/transfers.ts` (Anschlüsse, Umweg, Drehkreuz-Güte, `transferOffer`, `allocateTransferSeats`); alle Konstanten 3.9–3.13 in `constants.ts`; Beispiel 3.15 genau nachgerechnet; 61 Regeltests (676 grün); Bau-Festlegungen F14–F20 (u. a. F17 Anlauf auch im Überlauf, F19 Anschlüsse je Ankunft) |
| 18.11.2026 | 3.2b | O52 → E55 (Schalter Pflicht an beiden Enden, −10 für Premium-Klassen ohne bedienten Schalter), O53 → E56 (Preisniveau `fareRatio` speichern). Zufriedenheit Teil 2 in `src/model/satisfaction.ts`: `cabinPart`, `servicePart`, `groundPart` (Lounge, Stellplätze, Schalter-Art, Schalter-Last als Mittel beider Enden × Bodengewicht; `deskLoad` auch für 5.10), `staffPart`, `researchPart`, `satisfactionBreakdown`/`satisfaction` (einmal gekappt, ungerundet), `directOfferSatisfaction`, `connectionOfferSatisfaction`, `routeSatisfaction`, `airlineSatisfaction`, `satisfactionFactor` (an `offerAppeal` angeschlossen); alle Konstanten 2.6–2.10 in `constants.ts`; 32 Regeltests (708 grün); Bau-Festlegungen F21–F23 |
| 18.11.2026 | 3.4 | Preis und Erlös in `src/model/fare.ts`: `baseFareEconomy` (Kurzstrecken-Zuschlag stufenlos, Index aus der Bezugs-Flugzeit), `classFareRatio`, `marketFare` (nur Entfernung und Monat), Preisniveau `fareRatio` mit einer Lese-Stelle für fehlende Preise (R8), `routeFare(s)`, „Adjust All“, `routeRevenue` je Klasse mit Umsteigern, `transferRevenueShare` nach Marktpreisen, `monthlyRevenue` mit 4,348 Wochen, `bestFare` (Gitter 0,01 / 0,001, gewinnbest, eigener Anlauf 1), `breakEvenFareLevel`, `fullAircraftRevenue`; Konstanten 4.1–4.10 in `constants.ts`; Beispiel 4.13 nachgerechnet; 46 Regeltests (754 grün); Bau-Festlegungen F24–F26 |
| 18.11.2026 | – | O54–O59 entschieden: O54 → E57 (Slot- und Flugzeug-Anteil in den festen Kosten der Strecke), O55 → E58 (verfehltes Jahresziel kostet die halbe Prämie; Abweichung von der Empfehlung), O56 → E59 (Preiskampf gegen jede Gesellschaft), O57 → E60 (KI höchstens Stufe 2, Spieler-Stufe 3 ohne Sperre gegen die KI; Abweichung), O58 → E61 (Ölkrisen in der Treibstoff-Tabelle), O59 → E62 (Überholung überall, ohne Hangar 25 % teurer); `SPEZIFIKATION.md` 5.2, 5.9, 6.11, 6.15, 7.1, 7.2, 7.6, 7.7, 7.9, 7.10, 7.12, 7.13, 8.1, 8.2, 8.4, 8.13, 8.17–8.19 angepasst |
| 18.11.2026 | 3.5a | Kosten Teil 1 in `src/model/costs.ts`: `researchCostFactor`, `payFactor`, `hubFeeFactor`, `airportFeeFactor` (ein Gebühren-Nachlass); `crisisFuelShape`, `fuelTable` (Krisen-Form über den Rohdaten, letzter Wert nach 2030), `fuelPrice` mit Absicherung; `aircraftEfficiency`, `fuelCost`; `cabinCrew` nach Kabine, `crewHourlyRate`, `crewCost`; `landingFee` je Landung am Ziel, `landingCost`; `checkInFee` je Reise, `handlingFee` je Abflug; `cateringCost` mit denselben Mahlzeiten-Gewichten wie 2.5 (`servedItems` gemeinsam); `costPerPassenger`, `transferCostPerPassenger`; Konstanten 5.1–5.8 in `constants.ts`; Beispiel 5.18 (Kosten je Fluggast, Anteile) nachgerechnet; 50 Regeltests (804 grün); Bau-Festlegungen F27–F31 (F28: Paket 3.5 geteilt) |
| 18.11.2026 | 3.5b | Kosten Teil 2: `src/model/airportCosts.ts` (`slotLimit`, `slotPrice`, `slotResalePrice`, `slotRent`, `standRent` mit freien Ständen ab Stufe 2, `deskRent` nach `deskLoad`, `airportUpkeep` mit Einrichtungen, `managementTierPrice`, `facilityPrice`/`facilityUpkeep`, `ownerFeeIncome`), `src/model/fleet.ts` (`aircraftUpkeep` mit Flotten-Mischung, Wertmodell `valueBase`/`aircraftValue`, `ageDepreciation`, `fleetValueResult` in „Depreciation“ und „Aircraft trades“), `src/model/costTotals.ts` (`slotShare`, `aircraftShare`, `fixedWeeklyCost` mit „before aircraft costs“, `routeResult`, `campaignCost`, `ffpBaseCost`, `monthlyCosts`, `unattributedWeeklyCost`), `cabinListPrice` in `cabin.ts`, Kosten je Fluggast nach Posten in `costs.ts`; Konstanten 5.10–5.15 in `constants.ts`; Beispiel 5.18 ganz nachgerechnet (Erlös, Kosten, Ergebnis, Anteile, Gewinnschwelle); 69 Regeltests (873 grün); Bau-Festlegungen F32–F35 |
| 19.11.2026 | – | O54–O59 erneut abgefragt: O57 → E63 (Spieler-Stufe 3 sperrt neue KI-Strecken und -Drehkreuze; ersetzt E60), O54, O55, O56, O58, O59 bestätigt (E57, E58, E59, E61, E62); `SPEZIFIKATION.md` 7.0, 7.2, 7.7, 7.9, 7.10, 7.13 angepasst |
| 19.11.2026 | 3.6a | Ruf, Rang, Flugzeugklassen in `src/model/progress.ts`: Ruf-Ziel aus Airline satisfaction (100 → 50), Abzug für gestrichene Sitze, Werbe-Beitrag im Ziel (höchstens 3), eine Ruf-Änderung mit Ursachen-Liste, Farbstufen; Rang-Tabelle `RANKS` mit neuen Ruf-Schwellen und Forschungsplätzen, Prüfung im 3-Monats-Mittel ohne Abstieg, Freischaltungen, Flughafen-Zugang, Fortschritt; 6 Flugzeugklassen (`SizeClass`) mit `CLASS_RESEARCH` und Erreichbarkeits-Test gegen die Flugzeugdaten; Paket 3.6 geteilt (F36); 43 neue Tests, 916 grün |
| 19.11.2026 | 3.6b | Forschung, Meilensteine, Jahresziel, Karriere in `src/model/progress.ts`: Forschungs-Tabelle `RESEARCH_PROJECTS` (45 Projekte mit 15 Feldern, ersetzt `RESEARCH_SATISFACTION_POINTS`, `RESEARCH_COST_SAVINGS`, `EFFICIENCY_RESEARCH_IDS`), `researchEffects` als einzige Zusammenfassung, Preis über `atCost` ungerundet, Start-Sperre, Fortschritt, Texte aus den Feldern; 31 Meilensteine als Daten ohne Ruf-Punkte, `milestoneSlotFactor`, Drehkreuz-Zuschläge, Gewinnserie; Jahresziel mit Bezugsgröße aus Vorjahr und Erlös, Mindest-Prämie, Strafe = halbe Prämie (E58), `yearSnapshot`; Karriere-Punkte mit `companyValue` und zwei Ruhmeshallen; Bau-Festlegung F37; 51 neue Tests, 967 grün |
| 19.11.2026 | 3.7a | Konkurrenz Teil 1 in `src/model/rivals.ts`: `RIVAL_INPUTS` (neutrale Eingaben statt „ist das eine KI?“, Test über alle Modell-Dateien) und `RIVAL_OMITTED` als Text; `RIVAL_STRENGTH` (Easy/Normal/Hard nur Verhalten); `PERSONALITIES` mit Preis-Lage, Boden, Zielgewichten, Geduld, Kaufneigung, Reserve, Drehkreuzen, Schalter-Art, Kabine und Service; `rivalCabin` nach Platz-Regel (Beispiel 7.18 genau: LCC 202 Sitze, Boutique 59/25/20/8) und `rivalService` mit Menü je Mahlzeit; `rivalFareRatio` mit Zielniveau × `satisfactionFactor`, Lage ± 15 %, Preiskampf einmal −12 % über dem Boden; Gründung (Startkasse mit `atCost`, Startausstattung wie der Spieler, Drehkreuz-Wahl ohne Spieler-Stufe 3, Startflugzeuge, Nachrücken); Platz-Regel des Kaufdialogs in `cabin.ts`; Bau-Festlegung F38 (Paket 3.7 geteilt); 43 neue Tests, 1010 grün |
| 19.11.2026 | 3.7b | Konkurrenz Teil 2 in `src/model/rivalMonth.ts`: geglätteter Gewinn, Verlierer (ausdünnen oder streichen, Kernnetz 2), Feinabstimmung mit +2 %-Regel; Planung mit Vorauswahl (Suchbreite + 2 zufällige), 100/60/30 % der Umläufe, Planer-Hauptzahl mit Schätzfehler; Slots mit Anteil 0,25/0,10 der Grenze und Verkauf nach 6 freien Monaten, Schalter mit `deskLoad ≤ 0,8`, Stufe 2 an Drehkreuzen, Lounge (Feld `buildsLounge`), Sperre durch Spieler-Stufe 3 (E63); Kauf-Bedingungen, Typ nach Planer-Hauptzahl je Preis, Modernisierung, Überholung, Not- und Leerlauf-Verkauf; Krisenstärke aus Weltereignissen und Treibstoff-Tabelle (Juni 1974 Krise), Krisen-Fahrplan; Größe in Sitzen, neues Drehkreuz, Dividende; Zuschuss mit `atCost` (Beispiel 7.18); Notlage in Folge, Auflösung, Übernahme zum Unternehmenswert (Beispiel 7.18: 198,7 Mio. $); Ticker nach Fluggästen, Meldungs-Regel; `departuresAt`/`departuresOnPair` in `airportCosts.ts`; Paket 3.8 in 3.8a/3.8b geteilt; Bau-Festlegung F39; 58 neue Tests, 1068 grün |
| 19.11.2026 | 3.8a | Monatsabschluss Teil 1: `src/model/monthEvents.ts` (17 geschichtliche Ereignisse und 8 Zufalls-Vorlagen als Daten, nur über `eventDemandFactor`; Krisen-Antworten als Anteil von Treibstoff-Rechnung bzw. Erlös, `hedgedFuelTable`, `crisisResponseFactor`; Defekt je Flugzeug, Flughafen-Streik und Winterwetter für alle, Vogelschlag 0,5 % des Neupreises; Moral, Streik, Lohn-Untergrenze; Pech-Deckel mit fester Wurf-Reihenfolge und neutralem Merkmal `badLuckCap`; `disruptionShares`, `companyCancelledShare`, Charter je Flug; Verschleiß aus geflogenen Stunden) und `src/model/fleetMarket.ts` (Händler-Spanne −15 % / +5 %, Gebrauchtmarkt bis Bauende mit Weiterverkauf, Vorbestellung mit Rabatt bis 12 %, Überholung `max(4 % Neupreis, Wertgewinn)` mit Werft-Zuschlag, Umbau mit `atCost`, Kreditlinie, Zwangsverkauf, Pleite); `saleCandidate` gemeinsam mit dem Notverkauf der KI; Beispiel 8.17 (Flottenmarkt, Charter, Rückgewinnung, Kreditlinie, Defekt, Verschleiß) nachgerechnet; Spezifikation 8.9 „Folge“ berichtigt; Bau-Festlegung F40; 74 neue Tests, 1142 grün |
| 19.11.2026 | 3.8b | Monatsabschluss Teil 2 in `src/model/monthClose.ts`: Modell-Spielstand (`ModelState`, `CompanyState` mit neutralen `CompanyInputs`, Kassenbuch `MonthLedger`, Vorbestellungen), `monthOperations` (eine Marktaufteilung je Paar und Klasse für alle, Satisfaction, Erlös, Kosten mit Abschnitt-8-Posten, Verschleiß, Wert, Vogelschlag, Einnahmen der Stufe 3) als Abschluss und Vorhersage, `closeMonth(state, decisions)` in der Reihenfolge 8.0 (Buchung, Ruf, Entscheidungen von außen, Lieferungen, Kreditlinie, Zwangsverkauf, Spielende, Gewinnserie, Bericht, Prüfung 8.16, Übergang mit Preisen, Moral, Würfen, Gebrauchtmarkt), `buyAircraft`/`sellAircraft`/`spend` für Einmalausgaben; `RIVAL_INPUTS` um `staffModel`, `forcedSale`, Krisen-Antworten ergänzt; 22 Regeltests (Kassen-Gleichung, Reihenfolge der Gesellschaften, Lieferung und Vogelschlag im Bericht, keine globalen Daten, halber Flugplan, Charter, Kreditlinie, Vorhersage = Abschluss, Preise ab X+1), 1164 grün; Paket 3.8 weiter geteilt (F41) |
| 19.11.2026 | 3.8d | Monatsabschluss Teil 4 in `src/model/rivalMonth.ts`: Eröffnungen freier Flugzeuge mit Planer-Hauptzahl einer neuen Strecke und Slot-Kauf an beiden Enden (fairer Anteil je KI, F43), Kauf mit Strecke (Bezugs-Typ, dann bester Typ je Kaufpreis), Modernisierung, Kabinen-Erneuerung mit derselben Kabine, neues Drehkreuz, VIP-Lounge, Verkauf 6 Monate freier Slots, Schalter, Fahrpläne `rivalSchedule`; Zuschuss als Zeile „Subsidy“ (`costTotals.ts`); Gründung `foundRivalCompany` und Nachrücken `rivalRefill` als letzter Schritt von `closeMonth`; `rivalAircraft` in `rivals.ts`; 21 neue Tests (1206 grün) |
| 19.11.2026 | 3.9a | Balance-Skript Teil 1: `npm run balance` (`src/balance/`, `scripts/balance.ts`), Beispiel-Welten mit `monthOperations`, bester Preis je Klasse, Preiskampf zweier gleicher Gesellschaften, Empfindlichkeit der Marktgröße über ein Ereignis im Beispiel-Spielstand; 19 Prüfregeln zu Abschnitten 1–5 (5 ok, 2 Abweichung, 12 Info), Bericht `balance/3.9a-bericht.md`, Bewertung `BALANCE.md`; Funde: ein Flugzeug fast überall bei jedem Preis voll (Margen 59–77 %), Marktgröße aller Paare wächst × 2,78 statt × 2,5, Preiskampf ohne festen Punkt → O60–O62; Paket 3.9 in 3.9a–c geteilt (F44); 9 neue Tests (1215 grün) |
| 19.11.2026 | – | O61 → E64 (Wachstum 1960 → 2019 als Summe aller Paare, `DEMAND_GROWTH_1960_2019` 2,5 → 2,25; Summe jetzt × 2,51), O62 → E65 (Preiskampf ohne festen Punkt; B4.3 nur Info, Schrittgrenze erst bei Sprüngen in 3.9b); `SPEZIFIKATION.md` 3.3, 7.6 angepasst; Prüfregeln B3.1, B4.3 umgestellt; Bericht `balance/O61-O62-bericht.md` (6 ok, 0 Abweichung, 13 Info); `BALANCE.md` mit neuen Zahlen |
