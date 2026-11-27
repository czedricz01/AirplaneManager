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
  `DEMAND_SCALE` 14,5 → 4,5, `DEMAND_GROWTH_1960_2019` 2,25 → 1,97, neu `CLASS_BUSINESS_REF` = 0,3.
- Spieltest-Matrix: Abschnitt 6.

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
| `DEMAND_SCALE` (3.6) | 14,5 | **4,5** | Die 30 größten Märkte der Spieltest-Drehkreuze (FRA 1995, FRA 2025, DUS 1970) im geometrischen Mittel gleich groß wie vorher (neu / alt mit 14,5: 3,29 / 2,75 / 3,70 → Mittel 3,22) |
| `DEMAND_GROWTH_1960_2019` (3.3) | 2,25 | **1,97** | Regel E64: Summe der Marktgrößen aller Paare 1960 → 2019 × 2,5. Mit realen Werten und 2,25 wären es × 2,86 (B3.1, Januar, 481 Flughäfen) |
| `CLASS_BUSINESS_REF` (3.7) | fest 0,5 | **0,3** | Der Geschäftsanteil der Paare liegt im Mittel 0,2 tiefer (alle Paare 0,46 → 0,26; Top-30 ab FRA 0,57 → 0,36). Mit 0,3 bleiben die Klassen-Anteile typischer Paare wie vorher |

Marktgröße einzelner Paare (Fluggäste je Woche, Mai; vorher → jetzt, beide mit ihren Konstanten):

| Paar | 1961 | 1970 | 1990 | 2019 | 2025 |
|---|---|---|---|---|---|
| FRA–CDG | 2 669 → 4 188 | 3 362 → 5 169 | 4 224 → 7 073 | 4 798 → 6 376 | 4 620 → 6 110 |
| FRA–LHR | 2 470 → 4 036 | 3 113 → 5 093 | 3 871 → 6 729 | 4 415 → 5 795 | 4 257 → 5 582 |
| FRA–MAD | 1 398 → 2 052 | 1 852 → 2 791 | 3 035 → 3 342 | 3 431 → 3 735 | 3 357 → 3 780 |
| FRA–JFK | 1 506 → 2 547 | 1 849 → 2 874 | 2 118 → 3 074 | 2 364 → 2 653 | 2 276 → 2 600 |
| FRA–MUC | 2 525 → 1 955 | 3 184 → 2 871 | 3 993 → 3 471 | 4 606 → 4 183 | 4 440 → 3 897 |
| FRA–HAM | 2 353 → 2 576 | 2 963 → 3 283 | 3 741 → 3 380 | 4 338 → 3 109 | 4 188 → 2 862 |
| FRA–PMI | 971 → 1 442 | 1 282 → 2 168 | 2 119 → 2 589 | 2 375 → 2 329 | 2 314 → 2 351 |
| FRA–SCN | 1 638 → 174 | 1 918 → 222 | 2 395 → 285 | 3 235 → 275 | 3 318 → 234 |
| DUS–PMI | 878 → 1 190 | 1 149 → 1 938 | 1 986 → 2 091 | 2 330 → 1 763 | 2 279 → 1 692 |
| LHR–JFK | 1 435 → 5 450 | 1 746 → 5 125 | 2 295 → 4 951 | 2 680 → 3 954 | 2 593 → 4 136 |

Lesart: Metropolen-Paare (FRA–CDG, LHR–JFK) größer, besonders früh; Paare mit kleinen Städten (FRA–SCN) etwa ein
Zehntel. Früh im Spiel sind die großen westlichen Märkte größer als vorher, spät etwas kleiner, weil der Weltanteil
Europas und Nordamerikas real sinkt (Asien wächst).

Angepasste Tests: 3.3 (`demandGrowth` 2019 = 1,97), 3.7 (Beispielwerte mit `CLASS_BUSINESS_REF`), Rang-Beispiel 1
des Balance-Skripts HAM–NUE → HAM–FRA (`src/balance/career.ts:201`; HAM–NUE ist 1960 real zu klein für eine F27 mit
14 Flügen, 368 statt 644 Fluggäste, Ergebnis −0,3 Tsd. $), Flugzeugwahl-Test nimmt das größte Langstrecken-Paar, das
auch ein Schmalrumpf erreicht (das größte ist jetzt London–Tokio, 9 600 km).

## 6. Spieltest-Matrix

(folgt)

## 7. Funde

(folgt)
