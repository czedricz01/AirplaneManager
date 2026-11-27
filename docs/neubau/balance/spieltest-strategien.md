# Spieltest mit Strategien und Schwierigkeiten (27.11.2026)

Auftrag des Menschen: (1) Fehler „Financial forecast fehlt nach mehreren Strecken“ beheben, (2) Spielstart bis 2025,
(3) realistische Playthroughs mit verschiedenen Strategien und Schwierigkeiten; Ziele: **Easy** = fast jede Strecke zu
einem beliebten Ziel verdient Geld, **Normal** = mit schlechten Entscheidungen kann man pleitegehen, **Hard** = eine
Herausforderung, aber nicht unmöglich; **mehrere Strategien** sollen tragen (Luxus, „Ryanair“ usw.).

Dieses Dokument hält die Erkenntnisse fest. Geändert an der Balance wurde **nichts**; die Fragen am Ende sind für eine
neue Sitzung gedacht.

## 1. Fehler: Forecast fehlt nach weiteren Strecken (behoben)

**Was passierte:** Im Planer stand bei „4. Pricing“ nur „No forecast“, ebenso fehlten die Zahlen in Streckenliste und
Karte, sobald man am Heimat-Flughafen weitere Slots gekauft hatte. Das geschieht typischerweise bei der zweiten oder
dritten Strecke eines Monats (die erste braucht schon Slots, ab dann reichen sie nicht mehr). Danach blieb der Fehler
für immer, auch in späteren Monaten, weil der Spielstand ihn behielt.

**Ursache:** Ein Flughafen mit Verwaltungsstufe 2 (der Start-Hub hat sie immer) kauft zu jedem Slot automatisch einen
Abstellplatz („Stand“) mit (`applyInfrastructureChange`, `src/lib/financeUtils.ts:381`). Flughäfen der Größe 1–2 haben
aber keine Abstellplätze (`STANDS_MIN_AIRPORT_SIZE = 3`, `src/model/constants.ts:944`). Das Modell lehnt solche
Abstellplätze mit einem Fehler ab (`airportUpkeepParts`, `src/model/airportCosts.ts:249`: „Abstellplätze an einem
Flughafen der Größe 2“). `App.tsx` fängt den Fehler ab und zeigt dann gar keine Prognose (`src/App.tsx:1678`).
Im Browser nachgestellt: Free Mode, Hub Aalborg (Größe 2), drei Strecken im Januar 1960.

**Behebung:**
- `applyInfrastructureChange` hat einen neuen Schalter `standsAvailable`; ohne Abstellplätze am Flughafen wird weder
  direkt noch mit einem Slot einer gekauft (`src/lib/financeUtils.ts`). Planer und Flughafen-Ansicht geben ihn aus
  `infraAvailability(...).stands` mit (`src/components/RoutePlannerView.tsx`, `src/components/AirportDetailView.tsx`).
- `modelOperations` (`src/lib/modelBridge.ts`) zählt Abstellplätze an Flughäfen ohne Abstellplätze nicht. Damit rechnen
  auch **bereits betroffene Spielstände** sofort wieder; beim nächsten Abschluss verschwinden die falschen Einträge.
- Tests: `src/lib/modelAirport.test.ts` (zwei neue; beide scheitern ohne die Behebung). Im Browser geprüft: drei
  Strecken im selben Monat, jedes Mal „Expected weekly profit“, keine Warnung.

## 2. Spielstart bis 2025

Der Regler „Start Date“ geht jetzt bis 12/2025 (`LAST_START_OFFSET`, `src/components/app/NewGameScreen.tsx`); vorher
12/2020. Flughafen-Werte reichen bis 2025, Treibstoffpreise bis 2030; danach gelten die letzten Werte weiter. Im Browser
geprüft: Start 12/2025, Kasse 439 Mio. $ (Stufe 200 Mio. $ von 1960). Ein Spieljahr ab 2025 läuft im Skript ohne Fehler
(Abschnitt 5).

## 3. Wie getestet

**Werkzeug (neu, bleibt im Projekt):**
- `src/balance/playtest.ts`: spielt ein freies Spiel Monat für Monat mit einer festen Strategie. Es ruft dieselben
  Funktionen wie die Oberfläche: Start wie „New game“ (`foundStartRivals`, `startCapital`, Start-Hub), Kauf wie der
  Kaufdialog (`newAircraftPrice`, `modelCabin`), Slots und Stufe 1 wie der Planer (`slotBuyPrice`, `tierPrice`,
  `applyInfrastructureChange`), Prognose und bester Preis wie der Planer (`routeForecast`, `routeBestFares`), Abschluss
  wie „Next month“ (`runModelMonth`). Forschung im Normal Mode: die nächste Flugzeugklasse, sobald sie erlaubt ist und
  höchstens 30 % der Kasse kostet.
- `scripts/playtest-matrix.ts` (alle Läufe, 4 parallel, Ergebnisse in `.playtest-runs/`), `scripts/playtest-report.ts`
  (Tabellen), `scripts/playtest-probe.ts` (Planer-Prognose vieler Ziele ohne Spielen).

**Nicht nachgebaut** (ein Mensch würde es tun; die Ergebnisse sind daher eher vorsichtig): Antworten auf Krisen, Streiks
und Störungen; Jahresziel annehmen; Werbung, Vielflieger-Programm, Lohn; Gebrauchtmarkt und Vorbestellungen; zweite
Hubs und Umsteige-Netze (alle Strecken gehen vom Heimat-Hub aus); Kabinen-Umbau und Überholung; Verkauf von Flugzeugen.

**Spiele:** jede Strategie × Easy / Normal / Hard (Spieler und KI gleich stark) × zwei Startwerte des Zufalls, 6 KI,
Startkapital 50 Mio. $ von 1960, 10 Jahre, in zwei Zeitaltern:
- **free1995**: Free Mode, Hub Frankfurt (FRA, Größe 7), Start 01/1995.
- **normal1970**: Normal Mode (Rang „Startup“, nur Commuter-Flugzeuge, Flughäfen bis Größe 4), Hub Düsseldorf (DUS,
  Größe 4), Start 01/1970.
- dazu **free2025** (Start 01/2025, 5 Jahre, Standard und Optimierer) und eine **Streckenprobe** (15 beliebteste Ziele
  auf einmal, 3 Jahre).

**Strategien** (Kabine und Service wie die gleichnamigen KI-Persönlichkeiten, `PERSONALITIES`,
`src/model/constants.ts`):

| Name | Kabine / Service | Preis | Ziele | Flugzeug | Flüge je Woche | Verlierer schließen |
|---|---|---|---|---|---|---|
| standard | Vorgabe des Kaufdialogs (alles Economy), Service „none“ | Marktpreis | beliebteste | größter bis 150 Sitze | 7 | nie |
| vorsichtig | wie standard | bester Preis des Planers, jeden Monat | beliebteste mit positiver Prognose | größter bis 150 Sitze | 7 | nach 6 Verlust-Monaten |
| ryanair | LCC (dicht, Minimal-Service) | 0,85 × Markt | beste Prognose | größter bis 150 Sitze | 7–28 nach Prognose | nach 4 |
| ryanair-gross | wie ryanair | 0,85 | beste Prognose | größter Schmalrumpf (757, A321) | 7–28 | nach 4 |
| luxus | Boutique (viel Business/First, Luxus-Service) | bester Preis | beste Prognose | effizientester | 7 | nach 4 |
| luxus-fix | Boutique | 1,35 × Markt fest | beliebteste | größter bis 150 Sitze | 7 | nach 6 |
| optimierer | Optimizer | bester Preis | beste Prognose | effizientester | 7–28 nach Prognose | nach 3 |
| flag-gross | Flag | Marktpreis | beliebteste | größter bezahlbarer (auch Großraum) | 7 | nach 6 |
| schlecht-dumping | Flag (teurer Service) | 0,7 × Markt | irgendein Ziel in Reichweite | größter bezahlbarer | so viele wie möglich | nie; keine Reserve, 3 Käufe je Monat |
| schlecht-wucher | Vorgabe | 1,6 × Markt | zufällig unter 40 beliebtesten | billigster | 7 | nie; keine Reserve |

## 4. Planer-Prognose beliebter Strecken (ohne Spielen)

`scripts/playtest-probe.ts`: die 20 beliebtesten erreichbaren Ziele (Tourismus + Geschäft) ab dem Hub, Vorgabe-Kabine,
Service „none“, 7 Umläufe je Woche, im Startmonat. „positiv“ = „Expected weekly profit“ nach dem Anlauf > 0. Diese Zahl
ist dieselbe Rechnung wie der Abschluss (R2).

**Marktpreis:**

| Zeitalter | Flugzeug (Sitze) | Easy | Normal | Hard | Median $/Woche (Normal) | Auslastung |
|---|---|---|---|---|---|---|
| 1970 DUS | Skyvan (19) | 0/20 | 0/20 | 0/20 | −4 437 | 100 % |
| 1970 DUS | HS 748 (58) | 20/20 | 20/20 | 20/20 | 14 525 | 100 % |
| 1970 DUS | F27-500 (60) | 20/20 | 20/20 | 20/20 | 13 127 | 100 % |
| 1995 FRA | Beech 1900D (19) | 0/20 | 0/20 | 0/20 | −5 271 | 100 % |
| 1995 FRA | ATR 72-210 (78) | 18/20 | 18/20 | 18/20 | 14 372 | 100 % |
| 1995 FRA | 737-300 (149) | 16/20 | 16/20 | 16/20 | 36 760 | 99 % |
| 1995 FRA | A320ceo (186) | 12/20 | 12/20 | 12/20 | 26 745 | 88–92 % |
| 1995 FRA | 757-200 (239) | 11/19 | 11/19 | 8/19 | 2 286 | 73–79 % |
| 1995 FRA | A330-300 (440) | 0/17 | 0/17 | 0/17 | −124 957 | 36–40 % |
| 2025 FRA | ATR 72-600 (78) | 17/20 | 17/20 | 17/20 | 22 478 | 100 % |
| 2025 FRA | E190-E2 (114) | 16/20 | 16/20 | 16/20 | 89 723 | 99–100 % |
| 2025 FRA | A220-300 (160) | 16/20 | 15/20 | 14/20 | 99 853 | 86–90 % |
| 2025 FRA | A320neo (194) | 14/20 | 13/20 | 11/20 | 41 474 | 75–81 % |
| 2025 FRA | A321neo (244) | 9/20 | 7/20 | 2/20 | −27 634 | 62–69 % |
| 2025 FRA | 787-9 (420) | 0/15 | 0/15 | 0/15 | −370 878 | 38–42 % |

Die Verlierer mit Jets 1995 sind fast nur **kurze Strecken unter 450 km** (AMS, ZRH, MUC, BRU, CDG, BER, DUS: feste
Kosten je Flug schlagen den niedrigen Marktpreis) und **Transatlantik mit A320** (BOS, YUL: Auslastung 45 %).

**Bester Preis des Planers** (grüner Haken): 1995 FRA, Normal: ATR 72 20/20 (Median 82 494 $/Woche, Preisniveau
Economy 1,64), 737-300 20/20 (88 296, 1,22), A320 18/20 (52 769, 1,08). 1970 DUS: F27-500 20/20 (Easy 33 333 / Normal
29 308 / Hard 24 921 $/Woche, Niveau 1,32 / 1,26 / 1,20); sogar die Skyvan wird 20/20 positiv (Niveau 1,8–2,0).
2025 FRA, Normal: ATR 72-600 20/20 (124 108, Niveau 1,61), A220-300 18/20 (137 309).

**Preis und Nachfrage** (737-300, 14 Umläufe, FRA 1995, Normal, 20 Ziele):

| Preisniveau | 0,6 | 0,85 | 1,0 | 1,3 | 1,6 | 2,0 | 2,5 |
|---|---|---|---|---|---|---|---|
| Strecken mit Gewinn | 0/20 | 14/20 | 19/20 | 18/20 | 18/20 | 8/20 | 0/20 |
| Median $/Woche | −56 038 | 32 471 | 44 991 | 44 771 | 26 174 | −3 943 | −42 053 |
| Auslastung | 96 % | 87 % | 77 % | 57 % | 43 % | 30 % | 20 % |

**Kabine und Preis** (FRA 1995, Normal, 7 Umläufe, Median $/Woche):

| Flugzeug | Vorgabe, Markt | Vorgabe, bester | LCC, 0,85 | LCC, bester | Boutique, 1,35 | Boutique, bester |
|---|---|---|---|---|---|---|
| ATR 72-210 | 14 372 (18/20) | 82 494 (20/20) | – | 83 954 (20/20) | 27 930 (20/20) | 103 580 (20/20) |
| 737-300 | 36 760 (16/20) | 88 296 (20/20) | 18 273 (12/20) | 85 995 (20/20) | −48 (9/20) | 124 839 (20/20) |
| A320ceo | 26 745 (12/20) | 52 769 (18/20) | 2 658 (10/20) | 47 807 (18/20) | −24 946 (8/20) | 108 474 (20/20) |
| 757-200 | 2 286 (11/19) | 10 062 (11/19) | – | 4 660 (10/19) | −46 100 (7/19) | 91 043 (19/19) |
| A330-300 | −124 957 (0/17) | – | – | – | −55 276 (7/17) | 25 955 (10/17) |

LCC mit mehr Umläufen (0,85, 737-300): 7 → 18 273 (12/20), 14 → 25 635 (15/20), 21 → −50 721 (1/20); A320 ab 14
Umläufen 0/20. Mehr Flüge füllen sich nicht; ein niedriger Preis bringt zu wenig zusätzliche Fluggäste.

<!-- ERGEBNISSE -->
