# Status

**Nächstes Paket: 3.1** (Gerüst `src/model/`, zentrale Konstanten, Regeltest-Muster)

Stand: 18.11.2026 · Phase 2 abgeschlossen: `SPEZIFIKATION.md` Abschnitte 1–8 vollständig. Ausgangslage: 504 Tests grün,
`tsc --noEmit` grün (Paket 2.9 hat keinen Code geändert).

Offene Fragen (siehe `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“; keine blockiert 3.1, die Spezifikation
folgt vorläufig der Empfehlung):
- **O52** Schalter-Pflicht an beiden Enden, Premium-Abzug ohne bedienten Schalter (`SPEZIFIKATION.md` 2.6.3,
  5.10). Nötig spätestens beim Bau der Zufriedenheit (Phase 3).
- **O53** Preis als Preisniveau (Anteil des Marktpreises) oder als Dollar-Betrag speichern
  (`SPEZIFIKATION.md` 4.5). Nötig spätestens beim Bau des Preises (Phase 3).
- **O54** Flugzeug- und Slot-Anteil in den festen Kosten einer Strecke und in der Planer-Hauptzahl
  (`SPEZIFIKATION.md` 5.9). Nötig spätestens beim Bau der Kosten (Phase 3).
- **O55** Jahresziel verfehlt: keine Strafe, Geld-Strafe oder nur sicheres Ziel im Folgejahr
  (`SPEZIFIKATION.md` 6.11). Nötig spätestens beim Bau des Fortschritts (Phase 3).
- **O56** Preiskampf der KI gegen jede Gesellschaft oder nur gegen den Spieler (`SPEZIFIKATION.md` 7.6).
  Nötig spätestens beim Bau der Konkurrenz (Phase 3).
- **O57** Verwaltungsstufe 3: KI nur bis Stufe 2, Spieler-Stufe 3 sperrt neue KI-Strecken (`SPEZIFIKATION.md` 7.10).
  Nötig spätestens beim Bau der Konkurrenz (Phase 3).
- **O58** Krisen im Treibstoffpreis: Die Tabelle ist eine glatte Kurve ohne Ölkrisen; Ausschläge in die Tabelle
  einrechnen, Ereignis-Faktor behalten oder keine Treibstoff-Krisen (`SPEZIFIKATION.md` 8.4, 8.5, 7.12).
  Nötig spätestens beim Bau von Kosten und Ereignissen (Phase 3).
- **O59** Grundüberholung ohne Hangar: überall mit Zuschlag, nur Spieler mit Hangar, oder KI überholt nie
  (`SPEZIFIKATION.md` 8.13). Nötig spätestens beim Bau des Flottenmarkts (Phase 3).

Paket 3.1: Gerüst für das neue Modell anlegen, noch ohne Spielregeln.
- Ordner `src/model/` mit `README.md` (Aufbau, eine Datei je Spezifikations-Abschnitt, Regeln R1–R4 in Kurzform).
- Grundbegriffe aus `SPEZIFIKATION.md` Abschnitt 1 als Code: `WEEKS_PER_MONTH`, `yearOf`, `timeOf`, `costIndex`,
  `atCost`, `COST_GROWTH`, `LITRES_PER_GALLON`, Skalen-Grenzen (1.4) mit einer `clamp`-Hilfe, Schwierigkeits-Faktor (1.8),
  Zufallsgeber `rng(seed, month, purpose, key)` (8.3). Konstanten zentral (z. B. `src/model/constants.ts`), Werte von
  1960 mit Endung `_1960`.
- Regeltest-Muster: Je Regel aus der Spezifikation ein Test mit Verweis auf den Abschnitt (z. B.
  `it('1.3: costIndex(0) = 1')`); die Regeln aus Abschnitt 1 und 8.3 als erste Tests.
- Noch kein Umbau von `src/lib/`; der alte Code bleibt unverändert und grün.
Zu lesen: `SPEZIFIKATION.md` Abschnitt 1 und 8.3, `ENTSCHEIDUNGEN.md` (R1–R4, E5, E6), `package.json`,
Test-Einrichtung (z. B. `vitest.config.*`), ein bestehender Test in `src/lib/` als Vorbild. Prüfen: `npm test`,
`npm run lint`.

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
| 18.11.2026 | 2.5 | Preis und Erlös in `SPEZIFIKATION.md` Abschnitt 4: Marktpreis nur aus Entfernung, Bezugs-Flugzeit und Kostenindex (gleich für alle Angebote, ohne Schwierigkeit und SAT), eine Funktion für die Klassen-Verhältnisse, Knappheits-Zuschlag entfällt (Knappheit hebt den besten Preis), Preis als Preisniveau × Marktpreis, Erlös = Fluggäste × Preis × 4,348 Wochen, Umsteiger-Erlös nach Marktpreisen der Teilstrecken, gewinnbester Preis und Gewinnschwelle aus dem Modell, Planer-Hauptzahl = erwarteter Gewinn; alle 11 Funde aus 1.3 zugeordnet; neue Frage O53 (Preis speichern) |
| 18.11.2026 | 2.6 | Kosten in `SPEZIFIKATION.md` Abschnitt 5: drei Ebenen (Kosten je Fluggast, feste Kosten je Strecke, Kosten der Gesellschaft); Treibstoff nur aus der Tabelle (nach 2030 letzter Wert); Flugbegleiter nach Kabine; Landung je Abschnitt am Ziel; Check-in je Reise, Abfertigung je Abflug (Bodenpersonal darin); ein Gebühren-Nachlass; alle festen Beträge über `atCost` (auch Verpflegung, Slots, Stufen, Werbung); Wertmodell mit Abschreibung als Ergebnis-Posten (Kauf zum Wert ergebnisneutral); KI zahlt alles; alle 15 Funde aus 1.4 zugeordnet; neue Frage O54 (Flugzeug- und Slot-Anteil in den Strecken-Kosten) |
| 18.11.2026 | 2.7 | Ruf, Rang, Fortschritt in `SPEZIFIKATION.md` Abschnitt 6: Ruf-Ziel aus Airline satisfaction (100 → 50, 160 → 100), Abzug für gestrichene Sitze und kleinem Werbe-Beitrag im Ziel (höchstens 3, klingt mit dem Ruf ab); eine Funktion `reputationChange` mit Ursachen-Liste; keine Einmal-Sprünge; Rang im 3-Monats-Mittel mit neuen Ruf-Schwellen 30 … 65, Forschungsplätze 3 / 4 / 5 ab Rang 4 / 6 / 8; Klassen-Forschung gesenkt (Narrowbody 2, Widebody 4, Jumbo und Überschall 5, Überschall braucht Widebody, Preise gesenkt) mit Prüfung: Concorde ab 1972 erforschbar; Forschungs-Wirkungen als 15 Felder; Meilensteine und Jahresziel nur Geld und Freischaltungen, alle Beträge über `atCost`; Karriere-Punkte mit zwei Ruhmeshallen, Forschung 5 statt 15; alle 14 Funde aus 1.5 zugeordnet; neue Frage O55 (Jahresziel verfehlt) |
| 18.11.2026 | 2.8 | Konkurrenz in `SPEZIFIKATION.md` Abschnitt 7: KI rechnet mit denselben Funktionen (Tabelle 7.1), Liste der bewusst fehlenden Teile mit neutralen Werten (Forschung, Personal, Werbung, Frequent flyer, Schwierigkeit, Rang, Krisen-Antworten, Charter); KI-Stärke nur Verhalten; Persönlichkeiten nur als Entscheidungen mit echten Kostenvorteilen über die Kabine (LCC 202 statt 134 Sitze im A320ceo) und Prüfregel „ähnlicher Erfolg“; KI-Preise = Preis-Lage × `satisfactionFactor`, Anpassung nach Auslastung, Preiskampf einmal −12 % mit Boden über den Kosten; KI kauft Slots (Anteil je Flughafen), Schalter, Flugzeuge zum Wert; Größe in Sitzen, weitere Drehkreuze ab Größe 5, Dividende über 12 Monatskosten; Zuschuss mit `atCost` bis zur Prüfung; Notlage „in Folge“, Flotte aufgelöster KI in den Gebrauchtmarkt; Übernahme zum Unternehmenswert mit Kasse und Slots je Flughafen; Ticker nach Fluggästen; Rückschlag entfällt; alle 11 Funde aus 1.6 zugeordnet; neue Fragen O56 (Preiskampf gegen wen) und O57 (Stufe 3 und KI) |
| 18.11.2026 | 2.9 | Monatsabschluss, Ereignisse, Flottenmarkt in `SPEZIFIKATION.md` Abschnitt 8: `closeMonth` als reine Funktion mit Zufallsgeber im Spielstand, eine Rechnung für Spieler und KI, Kasse am Monatsende nach allen Buchungen mit Kassen-Gleichung; Ereignisse nur über die Marktgröße (8 Zufalls-Vorlagen), Krisen-Antworten als Anteil von Treibstoff-Rechnung bzw. Erlös; Defekte je Flugzeug, Flughafen-Streik und Wetter für alle, Vogelschlag als Anteil des Neupreises; Charter = 1,5 × eigene Flugkosten je Flug (lohnt jetzt), nur `cancelledShare` als Strafe; Verschleiß aus geflogenen Stunden; Händler-Spanne −15 % / +5 %, Vorbestell-Rabatt bis 12 %, Überholung mindestens so teuer wie ihr Wertgewinn; Kreditlinie 50 % des Flottenwerts, 8 % Zins, Zwangsverkauf nach 6 Monaten, Spielende ohne Flugzeuge; alle 14 Funde aus 1.7 zugeordnet; Fund: Treibstoff-Tabelle ohne Krisen → neue Fragen O58 und O59 (Überholung ohne Hangar). Phase 2 abgeschlossen |
