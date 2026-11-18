# Status

**Nächstes Paket: 3.5b** – Kosten Teil 2 (`SPEZIFIKATION.md` 5.9–5.18): feste Kosten je Strecke mit Slot- und
Flugzeug-Anteil (E57), Slots, Abstellplätze, Schalter, Verwaltungsstufen, Einrichtungen, Flugzeug-Unterhalt,
Wertmodell mit Abschreibung, Werbung und Frequent flyer, Einnahme eigener Flughäfen, Kosten der Gesellschaft je
Monat; Beispiel 5.18 ganz nachrechnen. Datei `src/model/costs.ts` (wird sie zu groß, nach Unterabschnitten teilen, Hinweis im
README). Danach sind 3.6, 3.7 und 3.8 frei (alle Fragen entschieden); 3.9 braucht 3.5b.

Stand: 18.11.2026 · O54–O59 entschieden (E57–E62). Paket 3.5a erledigt: `src/model/costs.ts` mit 5.1–5.8
(Kosten-Faktoren, Treibstoffpreis mit Krisen-Form nach E61, Treibstoff, Besatzung, Landung, Check-in und
Abfertigung, Verpflegung, Kosten je Fluggast); Beispiel 5.18 teilweise nachgerechnet (Kosten je Fluggast genau,
Anteile von Treibstoff, Landung und Besatzung). 804 Tests grün, `tsc --noEmit` grün.

Offene Fragen: keine (siehe `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“).

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
„Full aircraft“ mit Kosten (4.12) sowie `bestFare` / `breakEvenFareLevel` mit echten Kosten kommen mit 3.5
(`costPerPassenger`, `fixedWeeklyCost`) bzw. Phase 4. Die Regeln „Planer-Erlös = Erlös im Monatsabschluss“
(4.7, R2), „Preisänderung ändert die Fluggäste des laufenden Monats nicht“ (4.5) und „Hauptzahl = Gewinn im
Monatsabschluss“ (4.12) prüft 3.8 / Phase 4. Ob gegenseitiges Unterbieten mit `bestFare` in Grenzen bleibt
(4.10, Hinweis), prüft das Balance-Skript (3.9) mit Abschnitt 7.
Offen aus 3.5a (kein Blocker): `fixedWeeklyCost`, `routeResult` und die Gesamtkosten des Beispiels 5.18 kommen mit
3.5b; dann bekommen `bestFare` und `breakEvenFareLevel` echte Kosten (4.10, 4.11). „Planer-Kosten = Kosten im
Abschluss“ (5.16, R2) prüft 3.8 / Phase 4. Höhe von Landegebühr (26–40 % der Kurzstrecken-Kosten) und Abfertigung
ohne Bodenpersonal-Aufschlag prüft das Balance-Skript (3.9). Die Tabellen `RESEARCH_COST_SAVINGS` und
`EFFICIENCY_RESEARCH_IDS` gehen in 3.6 in die Forschungs-Tabelle (6.9) über (F29). Lohn-Grenzen 80 … 130 setzt 8.7.

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
| 3.5b | Kosten Teil 2 (5.9–5.18): feste Kosten je Strecke (E57), Flughäfen, Verwaltungsstufen, Einrichtungen, Unterhalt, Wertmodell, Werbung, Einnahme, Kosten der Gesellschaft, Beispiel 5.18 | offen |
| 3.6 | Ruf, Rang, Fortschritt (Abschnitt 6) | offen |
| 3.7 | Konkurrenz (Abschnitt 7) | offen |
| 3.8 | Monatsabschluss, Ereignisse, Flottenmarkt (Abschnitt 8) | offen |
| 3.9 | Balance-Skript: Beispielwerte für typische Strecken und Jahre | wartet (3.5b) |

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
