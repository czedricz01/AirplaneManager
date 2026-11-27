# Spieltest mit Strategien und Schwierigkeiten (27.11.2026)

Auftrag des Menschen: (1) Fehler „Financial forecast fehlt nach mehreren Strecken“ beheben, (2) Spielstart bis 2025,
(3) realistische Playthroughs mit verschiedenen Strategien und Schwierigkeiten; Ziele: **Easy** = fast jede Strecke zu
einem beliebten Ziel verdient Geld, **Normal** = mit schlechten Entscheidungen kann man pleitegehen, **Hard** = eine
Herausforderung, aber nicht unmöglich; **mehrere Strategien** sollen tragen (Luxus, „Ryanair“ usw.).

Dieses Dokument hält die Erkenntnisse fest. Geändert an der Balance wurde **nichts**; die Fragen am Ende sind für eine
neue Sitzung gedacht.

**Nachtrag:** Die Fragen in Abschnitt 10 sind entschieden (O81–O91 → E87–E97); Umsetzung und neue Messung in
`5.4-spieltest.md`.

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
  höchstens 30 % der Kasse kostet. „Verlierer schließen nach N“ zählt Verlust-Monate in Folge erst nach dem Anlauf
  (ab Monat 10, `RAMP_MONTHS` = 9). Flugzeuge, die 2 Monate ohne Strecke stehen, werden verkauft (wie „Sell“ in der
  Flotte, `planeFigures(...).saleProceeds`). Ein freies Flugzeug wird vor einem Kauf neu eingesetzt.
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

## 5. Playthroughs: Ergebnisse

Zahlen: Ergebnis der letzten 12 Monate in Mio. $ (Mittel der zwei Startwerte, Geld des jeweiligen Jahres) · Strecken
am Ende. Alle Einzelwerte (Kasse, tiefste Kasse, Firmenwert, Ruf, Rang) stehen im Anhang.

**Free Mode, FRA, 1995–2004:**

| Strategie | Easy | Normal | Hard |
|---|---|---|---|
| standard | −4,3 · 6 | −4,3 · 6 | −4,7 · 6 |
| vorsichtig | +245 · 79 | +208 · 76 | +154 · 64 |
| ryanair | +4,5 · 16 | +4,1 · 14 | +1,9 · 12 |
| ryanair-gross | +1,9 · 6 | +1,6 · 4 | +1,9 · 5 |
| luxus | +589 · 113 | +503 · 108 | +421 · 106 |
| luxus-fix | −4,6 · 8 | −4,6 · 7 | −4,6 · 8 |
| optimierer | +861 · 158 | +758 · 158 | +608 · 157 |
| flag-gross | −5,3 · 3 | −5,9 · 2 | −6,4 · 1 |
| schlecht-dumping | **Pleite** 2/2 (1999–2003) | **Pleite** 2/2 | **Pleite** 2/2 |
| schlecht-wucher | +6,8 · 72 | +6,9 · 72 | +7,0 · 72 |

**Normal Mode, DUS, 1970–1979** (Start als „Startup“, nur Commuter-Flugzeuge bis zur Forschung „Regional“):

| Strategie | Easy | Normal | Hard |
|---|---|---|---|
| standard | −5,2 · 12 | −5,3 · 12 | −5,4 · 12 |
| vorsichtig | +48 · 88 | +34 · 76 | +21 · 40 |
| ryanair (= ryanair-gross, nur Commuter) | −9,1 · 0 | −8,3 · 0 | −8,3 · 0 |
| luxus | +110 · 98 | +94 · 98 | +78 · 98 |
| luxus-fix | −8,0 · 6 | −3,0 · 6 | −3,6 · 10 |
| optimierer | +106 · 82 | +98 · 90 | +84 · 87 |
| flag-gross | −3,4 · 2 | −3,4 · 2 | −3,4 · 2 |
| schlecht-dumping | **Pleite** 2/2 (12/1972–03/1973) | **Pleite** 2/2 | **Pleite** 2/2 |
| schlecht-wucher | +12 · 93 | +8,5 · 84 | +4,3 · 73 |

**Free Mode, FRA, 2025–2029** (neue Startgrenze): standard +5,2 / +6,4 / +4,8 (14 Strecken), luxus +269 / +232 / +207
(54), optimierer +539 / +478 / +341 (70–82). Kein Fehler, keine Pleite.

**Was in den Läufen passierte (Auszüge):**
- **standard** gibt jede Kasse für das nächste Flugzeug aus. Ist der Wunsch-Typ zu teuer, nimmt es den billigsten, der
  noch geht; das sind Commuter mit 14–19 Sitzen (Metro, Do 228, Skyvan), und die verlieren **immer** (Abschnitt 4).
  1995: 6 Strecken, davon 1 mit Gewinn; 1970: 12 Strecken, davon 4 mit Gewinn, Kasse am Ende −9 bis −13 Mio. $
  (Kreditlinie, keine Pleite in 10 Jahren). Die Strecken mit passendem Flugzeug (F27, 737) verdienen, aber wenig.
- **vorsichtig** unterscheidet sich von standard nur durch den besten Preis und die Prüfung „Prognose > 0“ – und hat
  nach 10 Jahren 64–88 statt 6–12 Strecken und 150–250 statt −4 Mio. $ Jahresergebnis.
- **ryanair**: 1995 klein, aber gesund (12–16 Strecken). 1970: In der Ölkrise 1973/74 machen alle Strecken mit 15 %
  Nachlass mehr als 4 Monate Verlust; die Strategie schließt alle und verkauft die Flugzeuge, eröffnet 1975 neu und
  schließt 1979 (zweite Ölkrise) wieder alles. Im Mittel hatten 11 von 12 Strecken Gewinn gemacht.
- **luxus** (bester Preis) ist mit **optimierer** die stärkste Strategie: 1995 über 100 Strecken, 0 Verlust-Strecken.
  **luxus-fix** (1,35 × Markt fest) schließt 30–60 Strecken und kommt nicht vom Fleck: Die Boutique-Kabine hat weniger
  Sitze und teuren Service, 1,35 reicht dafür nicht; der beste Preis liegt höher.
- **flag-gross** kauft das größte bezahlbare Flugzeug (1995: Il-86, Il-62M, 747-400 für FRA–JFK); Auslastung um 40 %,
  13–38 Strecken geschlossen. Mit Verkauf der leeren Flugzeuge keine Pleite, aber Kasse um 0.
- **schlecht-dumping** geht in **jeder** Schwierigkeit pleite, 1970 schon nach knapp 3 Jahren, 1995 nach 4–8 Jahren.
- **schlecht-wucher** (1,6 × Markt, billigste Flugzeuge) macht **Gewinn**: Die Nachfrage ist so viel größer als das
  Angebot kleiner Flugzeuge, dass auch der Wucherpreis sie füllt (Auslastung 92–100 %). Nur der Ruf fällt (27–29).
- **Prognose stimmt:** Ergebnis im ersten Jahr nach dem Anlauf gegen „Expected weekly profit“ beim Eröffnen: Median
  gleich oder etwas besser; in 90–100 % der Strecken mindestens die Hälfte der Prognose; höchstens 6 % Verlust trotz positiver
  Prognose (meist unter 2 %; Tabelle im Anhang). Über die Jahre sinken die Ergebnisse (Alterung, mehr KI-Strecken).

## 6. Bewertung gegen die Ziele

| Ziel | Heute | Urteil |
|---|---|---|
| **Easy**: fast jede Strecke zu einem beliebten Ziel verdient Geld | Mit passendem Flugzeug zum Marktpreis: 1970 20/20 (F27, HS 748), 1995 16–18/20 (ATR 72, 737), 2025 16–17/20 (ATR, E190-E2). Verlierer: Commuter bis 19 Sitze (immer), Jets unter ~450 km, zu große Flugzeuge (A321 ab 2025 9/20, Großraum 0/20). **Easy rechnet hier genau wie Normal und Hard** (Streckenprobe: gleiche Zahlen auf den Dollar). | **teilweise**; Easy hilft gerade dort nicht, wo Anfänger scheitern |
| **Normal**: mit schlechten Entscheidungen pleite möglich | Pleite nur mit „dumping“ (Preis 0,7, irgendein Ziel, größte Flugzeuge, keine Reserve) – und das genauso auf Easy. Andere schlechte Strategien enden bei Kasse ±0 bis −13 Mio. $, aber nicht pleite: Die Kreditlinie (50 % des Flottenwerts) trägt, und Pleite heißt erst „überzogen und kein Flugzeug mehr“ (8.14). Zu hohe Preise (1,6) werden nicht bestraft. | **ja, aber** gleich wie Easy; nur grobe Fehler führen zur Pleite |
| **Hard**: Herausforderung, nicht unmöglich | Jede vernünftige Strategie wächst; Hard bringt meist etwa 70 % des Easy-Ergebnisses (optimierer 1995: 861 → 608, luxus 589 → 421; 1970 luxus 110 → 78, optimierer 106 → 84), „vorsichtig“ 44–63 % (1995 245 → 154, 1970 48 → 21). Tiefste Kasse der guten Strategien nie unter 1,5 Mio. $ – es gab keine echte Krise. | **zu leicht** für einen Spieler, der den besten Preis nutzt |
| **Mehrere Strategien** | Tragen: optimierer, luxus (bester Preis), vorsichtig (Standard-Kabine, bester Preis). Schwach: ryanair (klein, in Ölkrisen am Ende), luxus mit festem Aufschlag, große Flugzeuge. | **teilweise**: Luxus ja, „Ryanair“ nein |

## 7. Weitere Erkenntnisse

1. **Der beste Preis ist der wichtigste Knopf.** Zum Marktpreis sind kleine und mittlere Flugzeuge auf beliebten Zielen
   voll (Nachfrage ≫ Angebot), der Gewinn ist klein. Der beste Preis liegt bei 1,2–2,0 × Markt (Commuter bis 2,0) und
   bringt das 2- bis 6-Fache. Ein Spieler, der den grünen Haken nicht nutzt, wächst kaum.
2. **Die Nachfrage reagiert wenig auf den Preis** (Abschnitt 4): −40 % Preis bringt etwa +25 % Fluggäste, +60 % Preis
   kostet etwa −44 %. Darum trägt „billig und oft“ (LCC) nicht, und „teuer“ wird kaum bestraft.
3. **Die Schwierigkeit wirkt nur über die Anziehung (±10 %, `DIFFICULTY_FACTOR`, `src/model/constants.ts:112`)** und
   damit nur, wenn Sitze leer bleiben oder beim besten Preis (Easy 1970 F27: Niveau 1,32, Hard 1,20). Kosten, Kasse,
   Nachfrage, Kreditlinie und Krisen sind in allen Stufen gleich; die KI-Stärke ist ein eigener Regler.
4. **Kleine Commuter sind eine Falle:** Skyvan, Beech 1900D, Metro, Do 228 (14–19 Sitze) verlieren zum Marktpreis auf
   jeder Strecke, auch voll. Sie sind die billigsten im Katalog und im Normal Mode 1970 die einzigen, die ein Startup
   sofort kaufen kann (neben F27 und HS 748).
5. **Zu große Flugzeuge verlieren:** Ein Spieler allein füllt auf den beliebtesten Zielen bei 7 Flügen je Woche etwa
   2 000–2 500 Sitze; A321 und Großraum bleiben bei 35–70 % Auslastung. Das passt zu E85.
6. **Kurze Strecken unter ~450 km** verlieren mit Jets zum Marktpreis (feste Kosten je Flug), mit ATR 72 knapp.
7. **Ölkrisen** treffen Strategien mit kleinem Polster hart (ryanair 1973/74 und 1979). Das wirkt realistisch.
8. **Ruf** sinkt mit dem besten Preis auf 30–35, ohne dass es dem Geschäft sichtbar schadet; Luxus mit festem Preis
   (Ruf 65–68) und flag-gross (76–80) haben guten Ruf, verdienen aber nichts.
9. **Wachstum:** optimierer hat nach 10 Jahren 158 Strecken (die Grenze ist eigentlich nur Geld und Slots) und einen
   Firmenwert von 3–4,6 Mrd. $; der Rang (Normal Mode) begrenzt 1970–1979 auf Rang 3.

## 8. Stellschrauben (für die nächste Sitzung)

| Hebel | Stelle | Wirkt auf |
|---|---|---|
| Schwierigkeit als Anziehung | `DIFFICULTY_FACTOR` (`src/model/constants.ts:112`), `offerAppeal` (`src/model/marketSplit.ts:306`) | nur leere Sitze und den besten Preis |
| Neu denkbar: Schwierigkeit auf Kosten, Nachfrage oder Kreditlinie | z. B. Faktor in den Betriebskosten (Abschnitt 5 der Spezifikation), `DEMAND_SCALE` (`constants.ts:569`), `CREDIT_LIMIT_SHARE` (`constants.ts:2664`) | Gewinn jeder Strecke, Puffer vor der Pleite |
| Preis-Empfindlichkeit | Preis-Teil der Anziehung (`offerAppealParts`, `src/model/marketSplit.ts:285`), `noFlyAppeal` (`:318`) | LCC, Wucher, Abstand Markt ↔ bester Preis |
| Marktpreis | `marketFares` (`src/model/fare.ts`) | Gewinn bei den Vorgabe-Preisen |
| Bester Preis | `bestFareRatio` (`src/model/fare.ts:279`), `FARE_RATIO_MAX = 4` (`constants.ts:758`) | Stärke von optimierer/luxus |
| Pleite-Regel | `CREDIT_LIMIT_SHARE`, `OVERDRAWN_TO_FORCED_SALE = 6` (`constants.ts:2664`–`2670`), Spielende 8.14 | wie schnell schlechte Spieler scheitern |
| KI-Stärke | `RIVAL_STRENGTH` (`constants.ts:1689`) | Druck auf Hard |
| Startkapital | `START_CAPITAL_TIERS_1960` (`constants.ts:1135`) | Anfang |

## 9. Grenzen dieses Tests

- Der Mensch spielt besser als „standard“ und schlechter als „optimierer“ (der rechnet jeden Monat alle Preise neu).
- Keine Antworten auf Krisen, keine Werbung, keine Umsteige-Netze, nur ein Hub, keine Gebrauchtflugzeuge.
- Zwei Startwerte je Fall; die Unterschiede zwischen den Startwerten sind klein (Tabellen im Anhang).
- Normal Mode nur ab 1970 mit DUS; andere Hubs und Jahre können anders aussehen.
- Wiederholen: `npx tsx scripts/playtest-matrix.ts --jobs 4` (etwa 17 Minuten), dann
  `npx tsx scripts/playtest-report.ts`.

## 10. Fragen zur Schwierigkeit (für eine neue Sitzung)

1. **Was soll Easy leichter machen?** Heute nur ±10 % Anziehung, bei vollen Flugzeugen wirkungslos. Möglich: (a)
   Kosten-Faktor je Stufe (z. B. Easy −15 %, Hard +10 %), (b) Nachfrage-Faktor je Stufe, (c) mehr Kreditlinie / Startkapital,
   (d) Kombination.
2. **„Jede beliebte Strecke“ auf Easy – mit jedem Flugzeug?** Sollen auch Commuter bis 19 Sitze, Jets auf Strecken unter
   450 km und zu große Flugzeuge auf Easy Gewinn machen, oder nur ein passendes Flugzeug?
3. **Kleine Commuter:** Sollen sie zum Marktpreis grundsätzlich verlieren (heute), oder brauchen sie günstigere Kosten?
   Im Normal Mode sind sie der Start eines Startups.
4. **Marktpreis gegen besten Preis:** Heute bringt der beste Preis das 2- bis 6-Fache. Soll (a) der Marktpreis steigen,
   damit die Vorgaben schon gut verdienen, (b) die Nachfrage stärker auf den Preis reagieren, damit der beste Preis näher
   am Markt liegt, oder (c) so bleiben, und der Planer/Tutorial weist deutlicher auf den besten Preis hin?
5. **Preis-Empfindlichkeit:** Sollen Billigpreise mehr Fluggäste bringen (damit „Ryanair“ trägt) und Wucherpreise mehr
   kosten (heute macht 1,6 × Markt noch Gewinn)?
6. **Low-Cost-Vorteile:** Braucht die LCC-Kabine einen Kostenvorteil über die 9 % mehr Sitze hinaus (z. B. kürzere
   Bodenzeiten, geringere Crew-Kosten)?
7. **Pleite auf Normal:** Soll sie schneller kommen (z. B. kleinere Kreditlinie, Spielende nach N überzogenen Monaten statt
   erst ohne Flugzeuge), und soll Easy davor besser schützen als Normal?
8. **Hard:** Woraus soll die Herausforderung kommen – stärkere KI (`RIVAL_STRENGTH`), höhere Kosten, weniger Nachfrage,
   stärkere Krisen, oder ein spürbarer Ruf-Malus für hohe Preise?
9. **Ruf:** Soll ein niedriger Ruf (30–35 bei bestem Preis) spürbar Fluggäste kosten?
10. **Wachstum:** Sind 158 Strecken und 3–4 Mrd. $ Firmenwert nach 10 Jahren (optimierer, Free Mode) in Ordnung?

## Anhang: alle Läufe

### free1995 Easy (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flag-gross | s1 | nein | 1.6 | -2.6 | 24 | -5.3 | 3 | 0/16 | 16 | 100 % | 76 | 9 |
| flag-gross | s2 | nein | 0.9 | -2.6 | 24 | -5.3 | 3 | 0/16 | 16 | 100 % | 76 | 9 |
| luxus-fix | s1 | nein | 2.4 | -0.4 | 56 | -5.0 | 7 | 2/42 | 39 | 99 % | 66 | 9 |
| luxus-fix | s2 | nein | -0.1 | -0.1 | 57 | -4.2 | 9 | 2/44 | 38 | 100 % | 66 | 9 |
| luxus | s1 | nein | 836 | 6.4 | 2624 | 585 | 112 | 103/103 | 0 | 91 % | 54 | 9 |
| luxus | s2 | nein | 839 | 6.4 | 2645 | 593 | 114 | 105/105 | 0 | 98 % | 53 | 9 |
| optimierer | s1 | nein | 2416 | 4.5 | 4647 | 856 | 158 | 158/158 | 0 | 99 % | 46 | 9 |
| optimierer | s2 | nein | 2163 | 4.5 | 4532 | 867 | 158 | 158/158 | 0 | 100 % | 47 | 9 |
| ryanair-gross | s1 | nein | 3.8 | 2.1 | 87 | 2.0 | 5 | 8/8 | 5 | 100 % | 37 | 9 |
| ryanair-gross | s2 | nein | 6.4 | 2.2 | 82 | 1.8 | 6 | 9/9 | 4 | 100 % | 37 | 9 |
| ryanair | s1 | nein | 8.1 | 2.3 | 156 | 3.8 | 15 | 21/21 | 7 | 100 % | 30 | 9 |
| ryanair | s2 | nein | 1.8 | 1.8 | 159 | 5.1 | 16 | 21/22 | 10 | 100 % | 31 | 9 |
| schlecht-dumping | s1 | **Pleite 09/1999** | -0.3 | -41 | 1.8 | -2.7 | 0 | 0/3 | 0 | 100 % | 50 | 9 |
| schlecht-dumping | s2 | **Pleite 03/2003** | -0.0 | -34 | 1.4 | -0.6 | 0 | 0/2 | 0 | 0 % | 50 | 9 |
| schlecht-wucher | s1 | nein | 28 | 1.0 | 174 | 6.7 | 73 | 68/70 | 0 | 100 % | 27 | 9 |
| schlecht-wucher | s2 | nein | 29 | 0.9 | 173 | 6.9 | 72 | 67/69 | 0 | 100 % | 27 | 9 |
| standard | s1 | nein | 2.4 | 1.8 | 59 | -4.3 | 6 | 1/6 | 0 | 100 % | 42 | 9 |
| standard | s2 | nein | 1.4 | 1.4 | 57 | -4.4 | 6 | 1/6 | 0 | 100 % | 43 | 9 |
| vorsichtig | s1 | nein | 66 | 2.7 | 1167 | 240 | 81 | 74/76 | 4 | 90 % | 34 | 9 |
| vorsichtig | s2 | nein | 59 | 2.7 | 1147 | 249 | 77 | 71/72 | 4 | 97 % | 35 | 9 |

### free1995 Normal (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flag-gross | s1 | nein | 4.2 | -3.5 | 47 | -5.8 | 2 | 0/14 | 13 | 99 % | 80 | 9 |
| flag-gross | s2 | nein | 4.1 | -3.5 | 47 | -5.9 | 2 | 0/14 | 13 | 99 % | 80 | 9 |
| luxus-fix | s1 | nein | 1.1 | -0.4 | 59 | -4.7 | 7 | 3/34 | 30 | 99 % | 66 | 9 |
| luxus-fix | s2 | nein | 0.7 | -0.3 | 58 | -4.5 | 7 | 2/35 | 32 | 99 % | 68 | 9 |
| luxus | s1 | nein | 577 | 6.3 | 2268 | 506 | 108 | 99/99 | 0 | 91 % | 53 | 9 |
| luxus | s2 | nein | 571 | 6.4 | 2229 | 501 | 107 | 98/98 | 0 | 98 % | 53 | 9 |
| optimierer | s1 | nein | 1788 | 4.3 | 3980 | 770 | 158 | 158/158 | 0 | 100 % | 47 | 9 |
| optimierer | s2 | nein | 1862 | 4.3 | 3929 | 746 | 158 | 158/158 | 0 | 100 % | 46 | 9 |
| ryanair-gross | s1 | nein | 3.8 | 1.7 | 82 | 2.0 | 6 | 10/10 | 5 | 100 % | 35 | 9 |
| ryanair-gross | s2 | nein | 11 | 1.3 | 76 | 1.3 | 3 | 8/8 | 5 | 100 % | 39 | 9 |
| ryanair | s1 | nein | 11 | 2.6 | 157 | 4.1 | 15 | 20/22 | 10 | 100 % | 31 | 9 |
| ryanair | s2 | nein | 3.6 | 2.5 | 148 | 4.2 | 14 | 20/20 | 8 | 100 % | 31 | 9 |
| schlecht-dumping | s1 | **Pleite 01/2001** | -0.1 | -42 | 1.9 | -0.8 | 0 | 0/2 | 0 | 0 % | 50 | 9 |
| schlecht-dumping | s2 | **Pleite 03/2003** | -0.0 | -32 | 1.4 | -0.6 | 0 | 0/2 | 0 | 0 % | 50 | 9 |
| schlecht-wucher | s1 | nein | 28 | 1.0 | 174 | 6.9 | 73 | 68/70 | 0 | 100 % | 27 | 9 |
| schlecht-wucher | s2 | nein | 29 | 0.9 | 173 | 6.9 | 72 | 68/69 | 0 | 100 % | 27 | 9 |
| standard | s1 | nein | 2.4 | 1.8 | 59 | -4.3 | 6 | 1/6 | 0 | 100 % | 42 | 9 |
| standard | s2 | nein | 1.4 | 1.4 | 57 | -4.4 | 6 | 1/6 | 0 | 100 % | 43 | 9 |
| vorsichtig | s1 | nein | 29 | 2.4 | 995 | 219 | 80 | 74/76 | 4 | 90 % | 34 | 9 |
| vorsichtig | s2 | nein | 29 | 2.4 | 953 | 198 | 72 | 68/71 | 6 | 97 % | 34 | 9 |

### free1995 Hard (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flag-gross | s1 | nein | -3.5 | -3.5 | 44 | -6.4 | 1 | 0/14 | 13 | 98 % | 80 | 9 |
| flag-gross | s2 | nein | -3.6 | -3.6 | 44 | -6.4 | 1 | 0/14 | 13 | 98 % | 79 | 9 |
| luxus-fix | s1 | nein | -0.1 | -0.9 | 55 | -4.9 | 8 | 2/40 | 38 | 99 % | 65 | 9 |
| luxus-fix | s2 | nein | -0.5 | -0.5 | 58 | -4.3 | 8 | 3/36 | 31 | 99 % | 67 | 9 |
| luxus | s1 | nein | 401 | 5.2 | 1940 | 422 | 107 | 98/98 | 0 | 91 % | 52 | 9 |
| luxus | s2 | nein | 370 | 5.3 | 1886 | 420 | 104 | 95/95 | 0 | 98 % | 52 | 9 |
| optimierer | s1 | nein | 1152 | 4.1 | 3142 | 604 | 158 | 158/158 | 0 | 100 % | 46 | 9 |
| optimierer | s2 | nein | 1349 | 4.1 | 3184 | 612 | 156 | 156/156 | 0 | 100 % | 46 | 9 |
| ryanair-gross | s1 | nein | 12 | 1.7 | 81 | 2.8 | 5 | 7/7 | 2 | 100 % | 36 | 9 |
| ryanair-gross | s2 | nein | 5.4 | 1.3 | 72 | 1.0 | 5 | 7/7 | 3 | 100 % | 38 | 9 |
| ryanair | s1 | nein | 8.2 | 1.2 | 125 | 3.0 | 12 | 18/18 | 7 | 100 % | 31 | 9 |
| ryanair | s2 | nein | 6.4 | 2.3 | 125 | 0.8 | 12 | 18/18 | 8 | 98 % | 31 | 9 |
| schlecht-dumping | s1 | **Pleite 01/2001** | -0.2 | -41 | 1.8 | -0.8 | 0 | 0/2 | 0 | 0 % | 50 | 9 |
| schlecht-dumping | s2 | **Pleite 09/2003** | -0.0 | -33 | 1.4 | -0.6 | 0 | 0/2 | 0 | 0 % | 50 | 9 |
| schlecht-wucher | s1 | nein | 28 | 0.9 | 172 | 7.0 | 72 | 67/69 | 0 | 100 % | 27 | 9 |
| schlecht-wucher | s2 | nein | 29 | 1.1 | 173 | 7.0 | 72 | 69/69 | 0 | 100 % | 27 | 9 |
| standard | s1 | nein | 1.9 | 1.8 | 58 | -4.3 | 6 | 1/6 | 0 | 100 % | 42 | 9 |
| standard | s2 | nein | -2.5 | -2.5 | 54 | -5.0 | 7 | 1/7 | 0 | 100 % | 42 | 9 |
| vorsichtig | s1 | nein | 28 | 2.1 | 783 | 163 | 67 | 61/65 | 5 | 90 % | 35 | 9 |
| vorsichtig | s2 | nein | 25 | 2.2 | 715 | 145 | 62 | 59/63 | 7 | 97 % | 35 | 9 |

### normal1970 Easy (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flag-gross | s1 | nein | 1.5 | -2.1 | 6.2 | -3.3 | 2 | 1/38 | 38 | 100 % | 56 | 1 |
| flag-gross | s2 | nein | 1.5 | -2.1 | 6.2 | -3.4 | 2 | 1/38 | 38 | 100 % | 57 | 1 |
| luxus-fix | s1 | nein | 2.2 | -2.8 | 27 | -7.5 | 8 | 8/59 | 54 | 100 % | 48 | 2 |
| luxus-fix | s2 | nein | 1.2 | -2.7 | 18 | -8.6 | 3 | 7/62 | 60 | 100 % | 52 | 2 |
| luxus | s1 | nein | 486 | 2.9 | 715 | 112 | 98 | 99/99 | 1 | 100 % | 45 | 3 |
| luxus | s2 | nein | 460 | 2.9 | 697 | 108 | 98 | 99/101 | 3 | 100 % | 45 | 3 |
| optimierer | s1 | nein | 627 | 2.6 | 811 | 107 | 81 | 84/87 | 6 | 100 % | 41 | 3 |
| optimierer | s2 | nein | 641 | 2.6 | 834 | 104 | 83 | 91/93 | 10 | 100 % | 41 | 3 |
| ryanair-gross | s1 | nein | 25 | -0.8 | 35 | -9.7 | 1 | 11/13 | 12 | 100 % | 36 | 1 |
| ryanair-gross | s2 | nein | 31 | 1.6 | 36 | -8.5 | 0 | 10/13 | 13 | 0 % | 44 | 1 |
| ryanair | s1 | nein | 25 | -0.8 | 35 | -9.7 | 1 | 11/13 | 12 | 100 % | 36 | 1 |
| ryanair | s2 | nein | 31 | 1.6 | 36 | -8.5 | 0 | 10/13 | 13 | 0 % | 44 | 1 |
| schlecht-dumping | s1 | **Pleite 03/1973** | -0.1 | -27 | 3.8 | -8.2 | 0 | 0/6 | 0 | 100 % | 53 | 2 |
| schlecht-dumping | s2 | **Pleite 01/1973** | -1.6 | -29 | 3.1 | -11 | 0 | 0/7 | 0 | 100 % | 52 | 2 |
| schlecht-wucher | s1 | nein | 3.4 | -0.1 | 152 | 12 | 93 | 84/88 | 0 | 96 % | 29 | 2 |
| schlecht-wucher | s2 | nein | 1.4 | 1.0 | 151 | 12 | 93 | 85/88 | 0 | 96 % | 29 | 2 |
| standard | s1 | nein | -9.1 | -9.1 | 28 | -4.9 | 12 | 4/12 | 0 | 100 % | 35 | 2 |
| standard | s2 | nein | -13 | -13 | 25 | -5.6 | 12 | 4/12 | 0 | 100 % | 35 | 2 |
| vorsichtig | s1 | nein | 79 | 1.8 | 450 | 47 | 87 | 88/91 | 8 | 99 % | 32 | 2 |
| vorsichtig | s2 | nein | 71 | 1.8 | 469 | 49 | 90 | 90/93 | 7 | 99 % | 32 | 2 |

### normal1970 Normal (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flag-gross | s1 | nein | 1.5 | -2.1 | 6.2 | -3.3 | 2 | 1/38 | 38 | 100 % | 56 | 1 |
| flag-gross | s2 | nein | 1.5 | -2.1 | 6.2 | -3.4 | 2 | 1/38 | 38 | 100 % | 57 | 1 |
| luxus-fix | s1 | nein | 1.3 | -2.8 | 20 | -3.5 | 5 | 8/54 | 51 | 100 % | 52 | 2 |
| luxus-fix | s2 | nein | -0.8 | -1.9 | 24 | -2.4 | 6 | 8/63 | 60 | 100 % | 53 | 2 |
| luxus | s1 | nein | 403 | 2.3 | 623 | 97 | 99 | 101/101 | 2 | 100 % | 44 | 3 |
| luxus | s2 | nein | 386 | 2.3 | 602 | 91 | 97 | 99/100 | 3 | 100 % | 45 | 3 |
| optimierer | s1 | nein | 539 | 2.3 | 735 | 101 | 92 | 96/99 | 7 | 100 % | 41 | 3 |
| optimierer | s2 | nein | 539 | 2.3 | 727 | 94 | 88 | 96/100 | 12 | 100 % | 41 | 3 |
| ryanair-gross | s1 | nein | 29 | 0.1 | 34 | -8.4 | 0 | 11/12 | 12 | 0 % | 45 | 1 |
| ryanair-gross | s2 | nein | 29 | 0.0 | 34 | -8.2 | 0 | 11/12 | 12 | 0 % | 45 | 1 |
| ryanair | s1 | nein | 29 | 0.1 | 34 | -8.4 | 0 | 11/12 | 12 | 0 % | 45 | 1 |
| ryanair | s2 | nein | 29 | 0.0 | 34 | -8.2 | 0 | 11/12 | 12 | 0 % | 45 | 1 |
| schlecht-dumping | s1 | **Pleite 02/1973** | -0.1 | -27 | 3.8 | -10 | 0 | 0/6 | 0 | 100 % | 52 | 2 |
| schlecht-dumping | s2 | **Pleite 01/1973** | -0.1 | -28 | 4.2 | -15 | 0 | 0/6 | 0 | 0 % | 54 | 2 |
| schlecht-wucher | s1 | nein | 1.0 | -1.8 | 130 | 8.0 | 82 | 72/78 | 0 | 94 % | 29 | 2 |
| schlecht-wucher | s2 | nein | 2.0 | -1.0 | 140 | 9.0 | 87 | 74/83 | 0 | 94 % | 29 | 2 |
| standard | s1 | nein | -12 | -12 | 26 | -5.3 | 12 | 4/12 | 0 | 100 % | 35 | 2 |
| standard | s2 | nein | -11 | -11 | 27 | -5.2 | 12 | 4/12 | 0 | 100 % | 35 | 2 |
| vorsichtig | s1 | nein | 31 | 1.6 | 332 | 34 | 73 | 77/80 | 12 | 98 % | 32 | 2 |
| vorsichtig | s2 | nein | 25 | 2.3 | 342 | 34 | 80 | 81/85 | 13 | 98 % | 31 | 2 |

### normal1970 Hard (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flag-gross | s1 | nein | 1.5 | -2.1 | 6.2 | -3.3 | 2 | 1/38 | 38 | 100 % | 56 | 1 |
| flag-gross | s2 | nein | 1.5 | -2.1 | 6.2 | -3.4 | 2 | 1/38 | 38 | 100 % | 57 | 1 |
| luxus-fix | s1 | nein | 0.3 | -1.4 | 30 | -3.3 | 10 | 8/67 | 62 | 100 % | 51 | 2 |
| luxus-fix | s2 | nein | -0.8 | -1.5 | 29 | -4.0 | 9 | 8/68 | 62 | 94 % | 50 | 2 |
| luxus | s1 | nein | 276 | 2.5 | 484 | 76 | 97 | 100/100 | 3 | 99 % | 45 | 3 |
| luxus | s2 | nein | 322 | 2.6 | 533 | 80 | 98 | 100/100 | 2 | 100 % | 45 | 3 |
| optimierer | s1 | nein | 429 | 2.1 | 614 | 84 | 83 | 89/90 | 7 | 99 % | 42 | 3 |
| optimierer | s2 | nein | 447 | 2.1 | 646 | 84 | 91 | 95/98 | 7 | 100 % | 42 | 3 |
| ryanair-gross | s1 | nein | 27 | -0.7 | 31 | -8.4 | 0 | 10/12 | 12 | 0 % | 45 | 2 |
| ryanair-gross | s2 | nein | 27 | -0.5 | 32 | -8.2 | 0 | 11/12 | 12 | 0 % | 46 | 2 |
| ryanair | s1 | nein | 27 | -0.7 | 31 | -8.4 | 0 | 10/12 | 12 | 0 % | 45 | 2 |
| ryanair | s2 | nein | 27 | -0.5 | 32 | -8.2 | 0 | 11/12 | 12 | 0 % | 46 | 2 |
| schlecht-dumping | s1 | **Pleite 02/1973** | -0.1 | -27 | 3.8 | -9.6 | 0 | 0/6 | 0 | 0 % | 52 | 2 |
| schlecht-dumping | s2 | **Pleite 12/1972** | -0.2 | -28 | 4.1 | -17 | 0 | 0/6 | 0 | 0 % | 54 | 2 |
| schlecht-wucher | s1 | nein | 2.3 | -4.0 | 114 | 5.1 | 72 | 63/70 | 0 | 93 % | 29 | 2 |
| schlecht-wucher | s2 | nein | 2.4 | -4.1 | 117 | 3.6 | 74 | 64/72 | 0 | 92 % | 29 | 2 |
| standard | s1 | nein | -12 | -12 | 26 | -5.3 | 12 | 4/12 | 0 | 100 % | 35 | 2 |
| standard | s2 | nein | -12 | -12 | 26 | -5.4 | 12 | 4/12 | 0 | 100 % | 35 | 2 |
| vorsichtig | s1 | nein | 118 | 1.6 | 217 | 21 | 41 | 53/55 | 14 | 99 % | 31 | 2 |
| vorsichtig | s2 | nein | 111 | 1.5 | 220 | 20 | 39 | 50/53 | 15 | 99 % | 30 | 2 |

### free2025 Easy (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| luxus | s1 | nein | 48 | 5.2 | 778 | 269 | 55 | 46/46 | 0 | 89 % | 50 | 9 |
| optimierer | s1 | nein | 79 | 4.0 | 1272 | 539 | 80 | 66/66 | 0 | 99 % | 45 | 9 |
| standard | s1 | nein | 6.2 | 3.0 | 136 | 5.2 | 14 | 2/12 | 0 | 100 % | 38 | 9 |

### free2025 Normal (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| luxus | s1 | nein | 63 | 4.4 | 703 | 232 | 53 | 45/45 | 0 | 89 % | 50 | 9 |
| optimierer | s1 | nein | 73 | 3.8 | 1118 | 478 | 82 | 67/67 | 0 | 99 % | 45 | 9 |
| standard | s1 | nein | 5.9 | 2.8 | 139 | 6.4 | 14 | 2/12 | 0 | 100 % | 39 | 9 |

### free2025 Hard (Beträge in Mio. $ des jeweiligen Monats)

| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| luxus | s1 | nein | 47 | 5.4 | 632 | 207 | 54 | 46/46 | 0 | 89 % | 50 | 9 |
| optimierer | s1 | nein | 59 | 4.0 | 857 | 341 | 70 | 59/59 | 0 | 98 % | 44 | 9 |
| standard | s1 | nein | 7.8 | 3.1 | 133 | 4.8 | 13 | 2/12 | 0 | 100 % | 38 | 9 |

### Streckenprobe: 10 beliebteste Ziele auf einmal, fester Typ, Standard-Kabine, Marktpreis, 1×/Tag, 3 Jahre (Beträge in Tsd. $)

| Zeitalter | Schwierigkeit | Flugzeug | Strecken mit Gewinn (Mittel ab Monat 10) | Median Ergebnis je Monat | schlechteste Strecke | Auslastung (Median) | Typ |
|---|---|---|---|---|---|---|---|
| free1995 | Easy | 737-300 | 5/8 | 33 | FRA-ZRH -72 | 100 % | 737-300 |
| free1995 | Easy | atr-72-210 | 8/10 | 93 | FRA-MUC -3 | 100 % | atr-72-210 |
| free1995 | Hard | 737-300 | 5/8 | 33 | FRA-ZRH -72 | 100 % | 737-300 |
| free1995 | Hard | atr-72-210 | 8/10 | 93 | FRA-MUC -3 | 100 % | atr-72-210 |
| free1995 | Normal | 737-300 | 5/8 | 33 | FRA-ZRH -72 | 100 % | 737-300 |
| free1995 | Normal | atr-72-210 | 8/10 | 93 | FRA-MUC -3 | 100 % | atr-72-210 |
| normal1970 | Easy | f27-500 | 10/10 | 54 | DUS-BER 15 | 100 % | f27-500 |
| normal1970 | Easy | hs-748-series-2 | 10/10 | 58 | DUS-BER 21 | 100 % | hs-748-series-2 |
| normal1970 | Hard | f27-500 | 10/10 | 54 | DUS-BER 15 | 100 % | f27-500 |
| normal1970 | Hard | hs-748-series-2 | 10/10 | 58 | DUS-BER 21 | 100 % | hs-748-series-2 |
| normal1970 | Normal | f27-500 | 10/10 | 54 | DUS-BER 15 | 100 % | f27-500 |
| normal1970 | Normal | hs-748-series-2 | 10/10 | 58 | DUS-BER 21 | 100 % | hs-748-series-2 |

### Prognose beim Eröffnen gegen Ergebnis im ersten Jahr nach dem Anlauf (Monate 10–21)

| Gruppe | Strecken | Prognose je Monat (Median, Tsd. $) | Ergebnis je Monat (Median, Tsd. $) | Ergebnis ≥ 50 % der Prognose | Ergebnis < 0 bei Prognose > 0 |
|---|---|---|---|---|---|
| Streckenprobe | 111 | 59 | 57 | 93/102 | 6/102 |
| free1995 Easy | 834 | 309 | 334 | 800/821 | 1/821 |
| free1995 Hard | 777 | 218 | 241 | 740/761 | 2/761 |
| free1995 Normal | 817 | 261 | 282 | 784/803 | 1/803 |
| free2025 Easy | 93 | 337 | 369 | 85/85 | 0/85 |
| free2025 Hard | 92 | 275 | 302 | 85/85 | 0/85 |
| free2025 Normal | 98 | 302 | 336 | 90/90 | 0/90 |
| normal1970 Easy | 771 | 74 | 79 | 679/737 | 10/737 |
| normal1970 Hard | 692 | 58 | 68 | 601/652 | 6/652 |
| normal1970 Normal | 760 | 63 | 72 | 667/723 | 3/723 |
