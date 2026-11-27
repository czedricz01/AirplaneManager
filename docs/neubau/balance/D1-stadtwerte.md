# Paket D1: Realistische Stadtwerte (27.11.2026)

Auftrag: „Alle Werte aller Städte für alle Jahre überprüfen und realistischer machen; anhand realer Passagierzahlen
Business- und Tourism-Wert abschätzen, auf Grund echter Faktenlage.“

## Kurz

- **Alte Werte waren erfunden.** Jede Stadt lag 2019 zwischen etwa 300 und 1 000 je Wert, fast ohne Bezug zur
  Größe: Saarbrücken (0,4 Mio. Fluggäste) hatte 549 / 374, Frankfurt (70,6 Mio.) 590 / 792, Orlando mehr Tourismus als
  London. Business war fast überall größer als Tourism (im Mittel 46 % Geschäftsanteil je Paar).
- **Neu: reale Zahlen.** Je Flughafen Fluggäste 2019, 2024, 2025 und historische Stützwerte aus Flughafen- und
  Landesstatistiken; davon der Ziel- und Quellverkehr (ohne Umsteiger) in tausend Fluggästen je Jahr, aufgeteilt nach
  Reisezweck. Alle 628 Flughäfen (481 Haupt-, 147 weitere), alle Jahre 1960–2025.
- **Folgen im Spiel:** Große Städte sind jetzt viel größer als kleine (London 2019: 105 Mio. Ziel- und Quellverkehr,
  Saarbrücken 0,4 Mio.). Strecken zwischen Metropolen werden größer, Strecken zu kleinen Orten viel kleiner.
- **Drei Konstanten neu eingestellt (E107)**, damit die Balance aus den Paketen 3.9–5.4h möglichst bleibt:
  `DEMAND_SCALE` 14,5 → 6,0, `DEMAND_GROWTH_1960_2019` 2,25 → 1,97, neu `CLASS_BUSINESS_REF` = 0,3.
- **Spieltest:** 1995 und 2025 etwa wie vorher; 1970 ab DUS deutlich schwerer (auf Hard nur knapp Gewinn) → Frage O101
  (Abschnitt 8).

## 1. Was die Werte bedeuten

| Feld | Bedeutung jetzt | vorher |
|---|---|---|
| Tourism `T` | Ziel- und Quellverkehr der Stadt, Reisezweck Urlaub, Verwandtenbesuch, Pilgerreise; tausend Fluggäste je Jahr | Zahl ohne Einheit, 10–1 000 |
| Business `G` | dasselbe, Reisezweck Geschäft | Zahl ohne Einheit, 10–1 000 |

Jede Reise zählt an beiden Enden (wie die Flughafen-Statistik). Das Spiel nutzt die Werte nur im Verhältnis zur Welt
(`relativeSize`, Spezifikation 3.2); die Einheit macht sie nachprüfbar und in der Oberfläche lesbar
(„Business (k pax/yr)“).

## 2. Rechenweg

Je Flughafen (`scripts/airport-traffic/series.ts`):

1. **Fluggäste je Jahr 1960–2025.** Stützwerte: 2019 und 2024 (alle Flughäfen), 2025 (wo bekannt, sonst
   2024 × Wachstum der Region), historische Werte (bei etwa 150 großen und besonderen Flughäfen). Dazwischen gleiche
   Wachstumsrate je Jahr. Vor dem ersten Stützwert folgt der Flughafen dem Profil seiner Region (25 Profile,
   `profiles.ts`, z. B. USA 1960 = 6,3 % von 2019, China 1980 = 0,5 %).
2. **Stadt statt Gebäude.** Flughäfen derselben Stadt, die nicht im Spiel sind, zählen zum Spiel-Flughafen
   (London-Heathrow + Gatwick, Paris CDG + Orly + Beauvais, Moskau SVO + DME + VKO, Rom FCO + Ciampino, Osaka KIX +
   Itami, Seoul ICN + Gimpo, Bangkok BKK + Don Mueang, São Paulo GRU + Congonhas …). Ersetzte Flughäfen zählen zur
   Stadt (Denver vor 1995 Stapleton, München vor 1992 Riem, Berlin bis 2020 Tegel/Schönefeld/Tempelhof). Wo beide im
   Spiel sind, eröffnet der neue Flughafen erst im echten Jahr (DFW 1974, IAH 1969, NRT 1978, PVG 1999, PKX 2019, SAW
   2001, DSS 2017 …) und der alte verliert Verkehr (Dallas Love Field 1974, Chicago Midway 1962, Mailand-Linate 1998).
3. **Ohne Umsteiger.** Ziel- und Quellverkehr = Fluggäste × (1 − Umsteiger-Anteil). Das Spiel rechnet Umsteiger selbst
   (3.13); in den alten Zahlen steckten sie doppelt. Anteile aus Jahresberichten und OAG: Doha 70 %, Atlanta 60 %,
   Dubai 50 %, Frankfurt 50 %, Amsterdam 36 %, Heathrow/Gatwick zusammen 18 %, Mallorca 3 %.
4. **Reisezweck.** Geschäft = Ziel- und Quellverkehr × Geschäftsanteil, Tourism = Rest. Geschäftsanteil je Flughafen
   aus Befragungen, wo es sie gibt (Heathrow 30 %, Gatwick 13 %, London City 46 %, Stansted 14 %, Luton 16 %,
   Manchester 15 %; Frankfurt 35 %), sonst nach Art der Stadt:

   | Art | Anteil | Beispiele |
   |---|---|---|
   | Badeort, Urlaubsinsel | 6 % | Mallorca, Cancún, Phuket, Malé, Antalya |
   | Urlaubs-geprägt | 13 % | Las Vegas 12 %, Orlando 10 %, Nizza, Venedig, Kunming |
   | gemischt (Regelfall) | 24 % | Atlanta, Dubai, Barcelona-Stadt, Manila |
   | Wirtschafts-/Hauptstadt | 33 % | Paris, New York, Tokio, Singapur, Düsseldorf |
   | Regierungsstadt | 40 % | Washington, Brasília, Canberra, Peking, Abuja |
   | Rohstoff/Finanzplatz | 45 % | Zürich, Genf, Aberdeen, Stavanger, Calgary, Perth |

   Der Anteil bleibt über die Jahre gleich; das Wachstum der Urlaubsorte steckt in ihren Fluggastzahlen.
5. **Krisen geglättet, Kriege nicht.** Ölkrisen, 2001, 2008/09, Asienkrise, SARS und Pandemie 2020–2022 liegen
   zwischen Stützwerten; den Einbruch rechnet das Ereignis im Spiel (`HISTORICAL_EVENTS`), sonst zählte er doppelt.
   Örtliche Brüche sind in den Daten: Beirut 1975–1990, Kuwait 1990/91, Bagdad 1991–2003, Sanaa ab 2015,
   Kiew/Odessa ab 2022 (0), Rostow ab 2022 (0), Khartum ab 2023 (0), Russland ab 2022, Havanna nach 1959.

Einheit tausend Fluggäste, ab 100 ganzzahlig, darunter eine Nachkommastelle. Nach 2025 schreibt das Spiel wie bisher
mit dem Wachstum der letzten 10 Jahre fort (`statsGrowth`, höchstens 4 % je Jahr).

**Erzeugen:** `npx tsx scripts/airport-traffic/build.ts` schreibt `src/data/airportsRows.ts` und
`src/data/moreAirportsRows.ts` (Name, Lage, Stufe, ICAO-Code bleiben). Ein Test prüft, dass beide Dateien genau den
Quelldaten entsprechen (`src/data/airportRegistry.test.ts`). Entfernt: `scripts/fix_airport_stats.ts` (zwang jede
Reihe zu stetigem Wachstum) und `src/data/raw_airports.csv` (Quelle der alten Werte); die Zeitalter-Faktoren in
`src/data/airportRegistry.ts` (Ostblock × 0,45–0,65, westliche Drehkreuze × 1,15 vor 1975) entfallen, weil die realen
Zahlen diese Unterschiede schon enthalten.

## 3. Quellen

Je Region in den Kopfzeilen von `scripts/airport-traffic/data-*.ts`, Wachstums-Profile in `profiles.ts`. Die
wichtigsten:

- ACI World / ACI Europe / ACI Asia-Pacific / ACI-LAC / ACI Africa, Airport Traffic Reports 2019 und 2024
  ([ACI: World’s busiest airports, Juli 2025](https://aci.aero/2025/07/08/worlds-busiest-airports-revealed-in-final-global-rankings/)).
- ICAO Civil Aviation Statistics über die Weltbank (Welt 1970 310 Mio., 1980 642 Mio., 1990 1 025 Mio. beförderte
  Fluggäste; [Weltbank IS.AIR.PSGR](https://data.worldbank.org/indicator/IS.AIR.PSGR)).
- Nationale Statistiken: FAA/BTS (USA), Statistics Canada, ADV (Deutschland), CAA Airport Data (Großbritannien), UAF
  (Frankreich), AENA (Spanien), Assaeroporti (Italien), Rosaviatsia, DHMI (Türkei), CAAC (China), MLIT (Japan), AAI
  (Indien), ANAC (Brasilien), BITRE (Australien); Jahresberichte der Flughäfen.
- Reisezweck: [CAA Passenger Survey 2019](https://www.caa.co.uk/data-and-analysis/uk-aviation-market/consumer-research/departing-passenger-survey/survey-reports/)
  (alle befragten Flughäfen 19 % Geschäft), [Fraport über Statista](https://de.statista.com/statistik/daten/studie/312107/umfrage/frankfurt-flughafen-anteil-geschaeftsreisende)
  (Frankfurt 2019 ≈ 35 %), [ADV Airport Travel Survey 2018](https://www.adv.aero/wp-content/uploads/2016/02/Airport-Travel-Survey-2018_Broschüre.pdf).
- Umsteiger: [OAG Megahubs](https://www.oag.com/megahubs-2026), Jahresberichte (Dubai Airports, Hamad International,
  Fraport, Schiphol).

**Genauigkeit:** Die Zahlen sind gerundete Werte aus diesen Quellen, nicht Zeile für Zeile neu nachgeschlagen. Große
Flughäfen 2019/2024: etwa ± 5 %. Kleine Flughäfen und Jahre vor 1990 ohne eigenen Stützwert: Profil der Region,
etwa ± 30 %. Geschäftsanteile außerhalb der genannten Befragungen: Schätzung nach Art der Stadt, etwa ± 10 Prozentpunkte.
Wer einen Wert besser kennt, ändert ihn in `data-*.ts` und ruft `build.ts` auf.

## 4. Beispiele

Tourism / Business in tausend Fluggästen je Jahr (Ziel- und Quellverkehr); „alt“ = Werte ohne Einheit vorher.

| Code | Fluggäste 2019 (Mio.) | Umsteiger | Geschäft | T / G 1970 | T / G 1990 | T / G 2019 | T / G 2025 | alt T / G 2019 |
|---|---|---|---|---|---|---|---|---|
| ATL | 110,5 | 60 % | 24 % | 5.046 / 1.594 | 14.592 / 4.608 | 33.592 / 10.608 | 32.315 / 10.205 | 502 / 877 |
| LHR (+ LGW) | 127,5 | 18 % | 24 % | 12.028 / 3.798 | 39.636 / 12.516 | 79.458 / 25.092 | 81.585 / 25.764 | 804 / 905 |
| CDG (+ ORY, BVA) | 112,0 | 20 % | 33 % | 6.700 / 3.300 | 25.192 / 12.408 | 60.032 / 29.568 | 60.453 / 29.775 | 887 / 850 |
| FRA | 70,6 | 50 % | 35 % | 3.055 / 1.645 | 9.555 / 5.145 | 22.945 / 12.355 | 20.540 / 11.060 | 590 / 792 |
| DUS | 25,5 | 6 % | 33 % | 2.834 / 1.396 | 7.495 / 3.691 | 16.060 / 7.910 | 12.909 / 6.358 | 530 / 795 |
| SCN | 0,4 | 1 % | 24 % | 36,1 / 11,4 | 111 / 35,2 | 301 / 95 | 232 / 73,4 | 549 / 374 |
| PMI | 29,7 | 3 % | 6 % | 4.924 / 314 | 11.580 / 739 | 27.080 / 1.729 | 31.577 / 2.016 | 870 / 177 |
| JFK | 62,6 | 15 % | 33 % | 10.820 / 5.330 | 16.971 / 8.359 | 35.651 / 17.559 | 36.410 / 17.933 | 868 / 877 |
| HND | 85,5 | 10 % | 33 % | 9.045 / 4.455 | 24.120 / 11.880 | 51.556 / 25.394 | 53.870 / 26.533 | 754 / 861 |
| DXB | 86,4 | 50 % | 24 % | 190 / 60 | 1.634 / 516 | 32.832 / 10.368 | 36.176 / 11.424 | 496 / 450 |
| PEK | 100,0 | 12 % | 40 % | 211 / 141 | 2.640 / 1.760 | 52.800 / 35.200 | 37.367 / 24.911 | 602 / 795 |
| SIN | 68,3 | 30 % | 33 % | 797 / 393 | 7.316 / 3.604 | 32.033 / 15.777 | 32.783 / 16.147 | 593 / 639 |
| DEL | 68,5 | 12 % | 33 % | 708 / 348 | 3.538 / 1.742 | 40.388 / 19.892 | 48.598 / 23.936 | 447 / 524 |
| GRU (+ CGH) | 65,8 | 15 % | 33 % | 1.424 / 701 | 5.695 / 2.805 | 37.473 / 18.457 | 38.913 / 19.166 | 513 / 719 |
| SYD | 44,4 | 10 % | 33 % | 2.111 / 1.040 | 7.236 / 3.564 | 26.773 / 13.187 | 25.713 / 12.665 | 793 / 767 |
| KBP | 15,3 | 15 % | 24 % | 2.471 / 780 | 5.436 / 1.717 | 9.884 / 3.121 | 0 / 0 | 526 / 579 |

Summe der 481 Hauptflughäfen (Ziel- und Quellverkehr): 1960 149 Mio., 1970 506 Mio., 1990 1 555 Mio., 2019
5 986 Mio., 2025 6 332 Mio. Zum Vergleich ICAO: 1970 310 Mio. Reisen = 620 Mio. an beiden Enden; die 481 Flughäfen
decken davon etwa 80 %. Geschäftsanteil über alle: 26–28 %.

Größte Städte 2019 (Mio. Ziel- und Quellverkehr): London 105, Bangkok 90, Paris 90, Peking 88, Seoul 85, Moskau 82,
Tokio-Haneda 77, Los Angeles 75, Shanghai-Pudong 69, Guangzhou 65.

## 5. Kalibrierung (E107)

Das Modell nutzt den Weltanteil einer Stadt (3.2); die absolute Höhe der Werte im Jahr 1960 und die Verteilung auf
die Städte bestimmen die Marktgrößen. Mit realen Werten sind große Städte viel größer als kleine, deshalb drei
Konstanten:

| Konstante | vorher | jetzt | Grund |
|---|---|---|---|
| `DEMAND_SCALE` (3.6) | 14,5 | **6,0** | Die 100 größten Märkte in Reichweite der Spieltest-Drehkreuze (FRA 1995, FRA 2025, DUS 1970) in Summe etwa wie vorher. Erster Versuch 4,5 (30 größte Märkte gleich): gute Strategien verdienten nur 30–60 % von vorher, weil sie 50–100 Strecken fliegen und die Märkte ab Platz 30 jetzt 25–30 % kleiner sind (Abschnitt 6) |
| `DEMAND_GROWTH_1960_2019` (3.3) | 2,25 | **1,97** | Regel E64: Summe der Marktgrößen aller Paare 1960 → 2019 × 2,5. Mit realen Werten und 2,25 wären es × 2,86 (B3.1, Januar, 481 Flughäfen) |
| `CLASS_BUSINESS_REF` (3.7) | fest 0,5 | **0,3** | Der Geschäftsanteil der Paare liegt im Mittel 0,2 tiefer (alle Paare 0,46 → 0,26; 30 größte ab FRA 0,57 → 0,36). Mit 0,3 bleiben die Klassen-Anteile typischer Paare wie vorher |

Marktgröße einzelner Paare (Fluggäste je Woche, Mai; vorher → jetzt, beide mit ihren Konstanten):

| Paar | 1961 | 1970 | 1990 | 2019 | 2025 |
|---|---|---|---|---|---|
| FRA–CDG | 2.669 → 5.584 | 3.362 → 6.893 | 4.224 → 9.430 | 4.798 → 8.511 | 4.620 → 8.148 |
| FRA–LHR | 2.470 → 5.381 | 3.113 → 6.791 | 3.871 → 8.972 | 4.415 → 7.735 | 4.257 → 7.443 |
| FRA–MAD | 1.398 → 2.736 | 1.852 → 3.721 | 3.035 → 4.455 | 3.431 → 4.986 | 3.357 → 5.041 |
| FRA–JFK | 1.506 → 3.396 | 1.849 → 3.832 | 2.118 → 4.099 | 2.364 → 3.542 | 2.276 → 3.467 |
| FRA–MUC | 2.525 → 2.607 | 3.184 → 3.828 | 3.993 → 4.627 | 4.606 → 5.583 | 4.440 → 5.197 |
| FRA–HAM | 2.353 → 3.435 | 2.963 → 4.378 | 3.741 → 4.506 | 4.338 → 4.150 | 4.188 → 3.816 |
| FRA–PMI | 971 → 1.923 | 1.282 → 2.890 | 2.119 → 3.452 | 2.375 → 3.109 | 2.314 → 3.135 |
| FRA–SCN | 1.638 → 232 | 1.918 → 296 | 2.395 → 381 | 3.235 → 368 | 3.318 → 312 |
| DUS–PMI | 878 → 1.587 | 1.149 → 2.584 | 1.986 → 2.788 | 2.330 → 2.354 | 2.279 → 2.256 |
| LHR–JFK | 1.435 → 7.266 | 1.746 → 6.834 | 2.295 → 6.601 | 2.680 → 5.278 | 2.593 → 5.516 |

Lesart: Metropolen-Paare (FRA–CDG, LHR–JFK) deutlich größer, besonders früh; Paare mit kleinen Städten (FRA–SCN)
etwa ein Zehntel. Der Weltanteil Europas und Nordamerikas sinkt real (Asien wächst), deshalb wachsen westliche Märkte
von 1970 bis 2025 weniger als vorher.

Angepasste Tests: 3.3 (`demandGrowth` 2019 = 1,97), 3.7 (Beispielwerte mit `CLASS_BUSINESS_REF`), Rang-Beispiel 1
des Balance-Skripts HAM–NUE → HAM–FRA (`src/balance/career.ts:201`; HAM–NUE ist 1960 real zu klein für eine F27 mit
14 Flügen), Flugzeugwahl-Test nimmt das größte Langstrecken-Paar, das auch ein Schmalrumpf erreicht (das größte ist
jetzt London–Tokio, 9 600 km), Anlauf-Test der Strecke mit hohem Preis (FRA–MAD ist sonst auch im Anlauf voll,
`src/lib/modelRoute.test.ts:277`).

## 6. Spieltest-Matrix

Zwei Läufe mit `scripts/playtest-matrix.ts --jobs 4`:

1. **Volle Matrix mit `DEMAND_SCALE` 4,5** (177 Spiele, 2 Std. 20 Min., kein Fehler).
2. **Verkleinerte Matrix mit `DEMAND_SCALE` 6,0** (endgültig): optimierer, vorsichtig, luxus, standard je Startwert 1,
   alle Zeitalter und Stufen (33 Spiele, kein Fehler).

Ergebnis der letzten 12 Monate in Mio. $ · Strecken (tiefste Kasse); Vergleich `5.4h-spieltest.md` (alte Stadtwerte,
Mittel zweier Startwerte).

**Free Mode, FRA, 1995–2004**

| Strategie | 5.4h (alt) Easy / Normal / Hard | 4,5 | **6,0** |
|---|---|---|---|
| standard | −1,3 / −3,7 / −5,7 | −0,3 / −3,8 / −4,8 | −0,6 / −3,7 / −4,7 |
| vorsichtig | +106 / +63 / +39 | +93 / +55 / +30 | **+131 / +89 / +59** |
| luxus | +271 / +170 / +115 | +131 / +84 / +53 | **+202 / +135 / +89** |
| optimierer | +527 / +385 / +241 | +199 / +114 / +50 | **+343 / +184 / +121** |

Mit 4,5 außerdem: vorsichtig-pack +115 / +76 / +41 (alt +363 / +226 / +115), lcc-best-pack +127 / +96 / +70
(alt +444 / +238 / +139), ryanair-pack +93 / +29 / +2 (alt +291 / +47 / +20), schlecht-wucher +6 / −3 / −2 (alt
+87 / +49 / +18), schlecht-dumping pleite wie vorher.

**Normal Mode, DUS, 1970–1979**

| Strategie | 5.4h (alt) | 4,5 | **6,0** |
|---|---|---|---|
| standard | +1,1 / −3,0 / −5,5 | −0,9 / −3,1 / −5,0 | +0,4 / −3,1 / −4,8 |
| vorsichtig | +14 / +4,2 / −2,0 | +3,1 / −7,5 / −7,4 | +17 / −8,1 / −8,1 |
| luxus | +65 / +38 / +21 | +18 / +6,6 / −0,2 | **+31 / +19 / +5,1** |
| optimierer | +80 / +59 / +34 | +26 / +3,9 / +0,0 | **+47 / +23 / +1,0** |

Mit 4,5 außerdem: schlecht-wucher jetzt auf allen Stufen pleite (alt Verlust ohne Pleite), ryanair/ryanair-gross
Easy in einem Lauf pleite.

**Free Mode, FRA, 2025–2029**

| Strategie | 5.4h (alt) | 4,5 | **6,0** |
|---|---|---|---|
| standard | +17 / +10 / +6,1 | +3,5 / +0,2 / −1,3 | +3,5 / +0,2 / −1,3 |
| luxus | +140 / +104 / +83 | +111 / +84 / +71 | **+150 / +114 / +91** |
| optimierer | +303 / +199 / +115 | +211 / +137 / +90 | **+313 / +222 / +164** |

Hard / Easy mit 6,0: 1995 optimierer 35 %, luxus 44 %, vorsichtig 45 %; 2025 optimierer 52 %, luxus 61 %.

## 7. Funde

- **Fund 78 – 1995 und 2025 fast wie vorher, 1970 deutlich schwächer → Frage O101.** Mit 6,0 liegen gute Strategien
  1995 bei 65–125 % und 2025 bei 100–140 % der alten Ergebnisse. 1970 ab DUS: optimierer und luxus auf Hard nur noch
  +1 / +5 Mio. $ (alt +34 / +21), vorsichtig auf Normal/Hard im Verlust. Grund: 1970 gab es real nur wenige große
  Märkte (Europa und Nordamerika), die Märkte ab Platz 30 sind ab DUS 1970 nur noch 30–60 % so groß wie vorher; das
  Ziel aus E94/E106 („Hard mit jeder guten Strategie klar gewinnbar“) ist 1970 nicht mehr erfüllt.
- **Fund 79 – „standard“ 2025 schwächer** (+3,5 statt +17 auf Easy): Die Strategie nimmt die beliebtesten Ziele
  nach Stadtgröße; das sind jetzt Metropolen in großer Entfernung, für die ihr Flugzeug nicht passt. Info, kein
  Modellfehler.
- **Fund 80 – Doppelte Flughäfen in den Daten.** Basel-Mulhouse steht dreimal im Spiel (EAP, BSL, MLH), Verona
  zweimal (VRN, VVR – kein echter Code). Hier ist der Verkehr auf die Einträge verteilt (EAP 50 %, BSL 30 %, MLH 20 %;
  VVR klein gehalten). Besser wäre, die Doppel zu streichen (eigene Aufgabe, ändert Spielstände).
- **Fund 81 – New York und andere Städte mit mehreren Spiel-Flughäfen** (JFK/EWR/LGA, Washington IAD/DCA/BWI,
  Mailand MXP/LIN/BGY, Tokio HND/NRT, Shanghai PVG/SHA, Peking PEK/PKX, Dubai DXB/DWC, Istanbul IST/SAW, London
  LHR/STN/LTN/LCY/SEN): Jeder Flughafen hat nur seinen eigenen Verkehr; die Stadt ist auf mehrere Märkte verteilt.
  Real so, aber das größte Langstrecken-Paar ist dadurch London–Tokio statt London–New York. Info.

## 8. Frage O101

1970 ist mit realen Stadtwerten schwerer als vorher (Fund 78). Wege:

- **A: so lassen.** Realistisch: 1970 lohnten sich nur wenige große Strecken. Ziel E94/E106 gilt dann nur ab 1990.
- **B (Empfehlung): Wachstum flacher.** `DEMAND_GROWTH_1960_2019` kleiner (etwa 1,75) und `DEMAND_SCALE` so, dass
  2025 gleich bleibt: frühe Märkte größer, späte gleich. Regel E64 (Summe × 2,5) wird dann z. B. × 2,2. Messung mit
  verkleinerter Matrix im nächsten Paket.
- **C: nur 1970 stützen** über andere Hebel (Startkapital im Normal Mode, Kosten früher Flugzeuge). Greift in
  bereits abgestimmte Werte ein.
