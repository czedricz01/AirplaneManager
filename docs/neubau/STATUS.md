# Status

**Nächstes Paket: 2.5** (Soll-Zustand Preis und Erlös in `SPEZIFIKATION.md`, Abschnitt 4)

Stand: 18.11.2026 · Ausgangslage: 504 Tests grün, `tsc --noEmit` grün.

Offene Frage: **O52** (Schalter-Pflicht an beiden Enden, Premium-Abzug ohne bedienten Schalter), siehe
`ENTSCHEIDUNGEN.md`, Abschnitt „Offen“. Blockiert 2.5 nicht; nötig spätestens beim Bau der Zufriedenheit
(Phase 3). `SPEZIFIKATION.md` 2.6.3 folgt vorläufig der Empfehlung.

Paket 2.5: Soll-Zustand von Preis und Erlös in `SPEZIFIKATION.md`, Abschnitt 4 schreiben (Grundpreis je
Klasse aus Entfernung und Flugzeit mit Kostenindex; Klassen-Verhältnisse aus einer Funktion; Marktpreis je
Paar und Klasse; Knappheits-Zuschlag neu fassen oder streichen; Preis-Eingabe und Startpreis; Erlös je
Strecke; Umsteiger-Tarif und Erlös-Aufteilung auf Teilstrecken; Planer-Hauptzahl und erlösbester Preis).
Muss die Vorgaben aus 3.16 einhalten (Marktpreis unabhängig von den Fluggästen aus 3.11; kein zweiter
Preis-Faktor auf die Fluggäste; Preis wirkt nur über `priceFactor` 3.9.2).
Zu lesen: `SPEZIFIKATION.md` (Abschnitt 1, 2.10, Abschnitt 3 nur 3.0, 3.8, 3.9.2, 3.10, 3.11, 3.13, 3.16),
`ENTSCHEIDUNGEN.md` (E4–E7, E13, E23–E26, E32, E44, E52, E54, R2, R7, R8), `bestand/3-preis.md`.
Code nur bei Bedarf.

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
| 2.5–2.9 | Je Bereich 1.3–1.7 den Soll-Zustand in `SPEZIFIKATION.md` schreiben (2.5 Preis, 2.6 Kosten, 2.7 Ruf und Fortschritt, 2.8 Konkurrenz, 2.9 Monat und Ereignisse) | offen |

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
