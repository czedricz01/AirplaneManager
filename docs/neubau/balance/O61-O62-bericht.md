# Balance-Bericht

Erzeugt mit `npm run balance` aus `src/balance/` (Paket 3.9a). Alle Zahlen kommen aus den Funktionen in `src/model/`
mit den Startwerten aus `src/model/constants.ts`; das Skript ändert keine Konstante. Bewertung und Empfehlungen:
`docs/neubau/BALANCE.md`.

Urteile: **ok** = Regel der Spezifikation gilt; **Abweichung** = Regel gilt nicht (Entscheidung nötig);
**Info** = keine feste Grenze in der Spezifikation, Wert zur Bewertung.

Prüfregeln: 6 ok · 0 Abweichung · 13 Info.

## Übersicht der Prüfregeln

| Nr. | Spez. | Regel | Wert | Urteil |
|---|---|---|---|---|
| B1.1 | 1.3, 5.2 | Treibstoff (Tabelle) gegenüber Kostenindex: wie stark verschiebt sich das Verhältnis 1960 → 2020 (Grundlage der Langstrecken-Marge, 5.18) | Treibstoff ÷ Kostenindex 2020 = 1,24 (1960 = 1) | Info |
| B2.1 | 2.10 | `satisfactionFactor(50)` liegt bei 0,75 (± 0,05) | 0,750 | ok |
| B2.2 | 2.6.2, 7.4 | Stärke der Service-Abzüge: Satisfaction der LCC (kein Service, dichte Kabine) auf Kurzstrecke; Ausgleich über Preis-Lage 0,90 (7.4) | LCC Economy FRA–CDG: 89 → Faktor 0,95 | Info |
| B3.1 | 3.3 | Die Summe der Marktgrößen aller Paare wächst 1960 → 2019 um × 2,5 (± 10 %, E64) | Summe 2,51, Mittel der Verhältnisse 3,02, Median 2,51 (115 440 Paare) | ok |
| B3.2 | 3.7 | Premium-Anteil schwankt über alle Paare: 5 %- bis 95 %-Wert mindestens 3 Prozentpunkte auseinander (1990) | 6,8 % … 11,1 % (4,3 Pp.) | ok |
| B3.3 | 3.4 | Entfernungs-Faktor kurz : lang (45 min : 20 h); Startwert 5,2 | 5,16 | Info |
| B3.4 | 3.9.3 | Stärke von `FLIGHT_TIME_EXP`: Anziehung Turboprop ÷ Jet bei sonst gleichem Angebot | FRA–CDG 0,72, FRA–MAD 0,65 | Info |
| B3.5 | 1.8 | Stärke der Schwierigkeit: Fluggäste des Spielers auf Hard gegenüber Normal (gegen einen gleichen Rivalen) | −5,7 % | Info |
| B4.1 | 3.6, 4.10 | Marktgröße gegenüber einem Flugzeug: Strecken, die selbst beim höchsten Preisniveau voll bleiben (Hinweis aus 3.8b) | 2 von 11: Caravelle III FRA–CDG 1962; ATR 72-200 HAM–NUE 1990 | Info |
| B4.2 | 4.10, 7.6 | Wechselseitige beste Antworten zweier gleicher Gesellschaften bleiben über den Kosten (Ergebnis > 0, Preis über der Gewinnschwelle voller Maschine), nicht gegen 0 | 14 Abflüge: tiefster Preis Y 3,19, Schwelle 0,75; 56 Abflüge: tiefster Preis Y 1,36, Schwelle 0,62 | ok |
| B4.3 | 7.6 | Enden die besten Antworten in einem festen Punkt? Nicht verlangt (7.6, E65); verlangt ist B4.2 | 14 Abflüge: fest; 56 Abflüge: Zyklus | Info |
| B4.4 | 4.10 | Bester Preis gegen einen gleichen Rivalen beim Marktpreis (Hinweis 4.10: 70 % des Marktpreises) | 14 Abflüge: 3,19; 56 Abflüge: 1,74 | Info |
| B4.5 | 3.6, 4.10 | Empfindlichkeit: bester Preis Y eines A320ceo allein auf FRA–MAD 1990 bei kleinerer Marktgröße | × 1,00: 3,37; × 0,50: 2,33; × 0,25: 1,48; × 0,10: 1,31 | Info |
| B5.1 | 5.5 | Landegebühr auf Kurzstrecke 26–40 % der Kosten (Hinweis 5.5 / 5.18) | Caravelle III FRA–CDG 1962: 31 %; ATR 72-200 HAM–NUE 1990: 28 % | ok |
| B5.2 | 5.18 | Marge beim besten Preis: Langstrecke gegenüber Kurz- und Mittelstrecke (Hinweis 5.18: Langstrecke sehr einträglich) | Lang Ø 66 %, kurz/mittel Ø 70 % | Info |
| B5.3 | 5.6 | Check-in und Abfertigung ohne Bodenpersonal-Aufschlag: Anteil an den Kosten (heute mit Bodenpersonal 2–4 % mehr) | 3 % … 17 % | Info |
| B5.4 | 5.13, E54 | Listenpreise und Abschreibung: Jahre, bis eine Strecke den Kaufpreis eines neuen Flugzeugs einspielt | 0,4 … 2,1 Jahre | Info |
| B5.5 | E7 | Eine gut geführte Strecke jeder Länge bringt in jedem Jahrzehnt Gewinn (alle Fälle beim besten Preis) | 11 von 11 mit Gewinn | ok |
| B5.6 | 7.4, E45 | Vorschau „ähnlicher Erfolg“: Ergebnis LCC ÷ Flag mit demselben Flugzeug allein auf derselben Strecke | A320ceo FRA–MAD 1990: 0,65 (Marge 67 % gegen 73 %) | Info |

## Abschnitt 1: Zeit und Geld

### Kostenindex, Nachfrage-Wachstum, Treibstoff, Marktpreis (Januar)

| Jahr | costIndex | demandGrowth | Treibstoff je Gallone | Treibstoff ÷ Index (1960 = 1) | Marktpreis Y FRA–MAD |
|---|---|---|---|---|---|
| 1960 | 1,00 | 1,00 | 1,05 $ | 1,00 | 114 $ |
| 1970 | 1,13 | 1,15 | 1,55 $ | 1,31 | 128 $ |
| 1980 | 1,27 | 1,32 | 2,92 $ | 2,19 | 144 $ |
| 1990 | 1,43 | 1,51 | 1,20 $ | 0,80 | 163 $ |
| 2000 | 1,61 | 1,73 | 1,72 $ | 1,02 | 183 $ |
| 2010 | 1,82 | 1,99 | 2,64 $ | 1,39 | 207 $ |
| 2020 | 2,05 | 2,28 | 2,66 $ | 1,24 | 233 $ |
| 2030 | 2,30 | 2,62 | 2,39 $ | 0,99 | 262 $ |

Treibstoff aus `fuelTable` (mit Krisen, E61). Der Marktpreis wächst nur mit dem Kostenindex (4.3).

## Abschnitt 2: Zufriedenheit

### Satisfaction factor

| Satisfaction | 0 | 50 | 80 | 100 | 120 | 140 | 160 |
|---|---|---|---|---|---|---|---|
| Faktor | 0,500 | 0,750 | 0,900 | 1,000 | 1,146 | 1,264 | 1,354 |

Zahlungsbereitschaft gegenüber Satisfaction 100 (2.10).

### Größter Service-Abzug (gar kein Service) in Satisfaction-Punkten

| Klasse | 45 min | 2 h | 5 h | 10 h | 15 h |
|---|---|---|---|---|---|
| Y | 8,3 | 19,5 | 42,0 | 58,5 | 69,0 |
| W | 9,1 | 21,5 | 46,2 | 64,4 | 75,9 |
| J | 10,3 | 24,4 | 52,5 | 73,1 | 86,3 |
| F | 11,5 | 27,3 | 58,8 | 81,9 | 96,6 |

`maxServiceShortfall` (2.6.2). Mit `satisfactionFactor` ergibt z. B. −40 Punkte eine Zahlungsbereitschaft von 0,80.

### Satisfaction je Klasse nach Ausstattung (Persönlichkeit) – Wert (Satisfaction factor)

| Strecke | Ausstattung | Sitze Y / W / J / F | Y | W | J | F |
|---|---|---|---|---|---|---|
| FRA–CDG, A320ceo, 1990 | lcc | 202 / 0 / 0 / 0 | 89 (0,95) | – | – | – |
| FRA–CDG, A320ceo, 1990 | expansionist | 159 / 14 / 8 / 0 | 96 (0,98) | 102 (1,02) | 112 (1,09) | – |
| FRA–CDG, A320ceo, 1990 | flag | 92 / 18 / 16 / 8 | 135 (1,24) | 142 (1,27) | 135 (1,24) | 133 (1,23) |
| FRA–CDG, A320ceo, 1990 | boutique | 59 / 25 / 20 / 8 | 127 (1,19) | 138 (1,25) | 138 (1,25) | 132 (1,22) |
| FRA–JFK, A330-300, 1995 | lcc | 479 / 0 / 0 / 0 | 48 (0,74) | – | – | – |
| FRA–JFK, A330-300, 1995 | expansionist | 375 / 34 / 19 / 0 | 64 (0,82) | 70 (0,85) | 73 (0,87) | – |
| FRA–JFK, A330-300, 1995 | flag | 219 / 42 / 38 / 19 | 101 (1,01) | 119 (1,14) | 110 (1,07) | 119 (1,14) |
| FRA–JFK, A330-300, 1995 | boutique | 136 / 58 / 48 / 19 | 93 (0,96) | 102 (1,01) | 126 (1,18) | 98 (0,99) |

Neues Flugzeug, Kabine und Service nach `rivalCabin` / `rivalService` (7.5), Ruf 50, Lohn 100 %, zwei normale Schalter je Ende.

## Abschnitt 3: Nachfrage

### Marktgröße typischer Paare (Fluggäste je Woche, beide Richtungen, Mai, ohne Ereignisse)

| Paar | km | 1960 | 1975 | 1990 | 2005 | 2020 | Klassen Y / W / J / F (1990) |
|---|---|---|---|---|---|---|---|
| HAM–NUE (klein, kurz) | 465 | 6 015 | 8 625 | 10 514 | 13 164 | 12 495 | 85,8 % / 7,3 % / 5,6 % / 1,3 % |
| FRA–CDG (groß, kurz) | 449 | 8 176 | 11 652 | 13 400 | 15 827 | 15 144 | 86,1 % / 7,2 % / 5,4 % / 1,3 % |
| FRA–MAD (Mittelstrecke) | 1 420 | 3 511 | 5 475 | 7 930 | 8 998 | 8 948 | 85,5 % / 7,5 % / 5,6 % / 1,4 % |
| ATL–ORD (US-Inland) | 976 | 6 647 | 8 386 | 9 410 | 11 296 | 10 714 | 83,8 % / 7,9 % / 6,6 % / 1,6 % |
| FRA–JFK (Langstrecke) | 6 189 | 2 855 | 3 882 | 4 178 | 4 851 | 4 641 | 80,3 % / 9,6 % / 7,6 % / 2,6 % |
| FRA–SIN (sehr lang) | 10 278 | 780 | 928 | 1 162 | 2 074 | 3 200 | 77,4 % / 10,8 % / 8,6 % / 3,2 % |

`marketSize` (3.6) mit `eventFactor` 1; Klassen-Anteile `classShares` (3.7).

### Klassen-Anteile über alle Paare (1990)

| Klasse | 5 %-Wert | 95 %-Wert |
|---|---|---|
| Premium | 6,8 % | 11,1 % |
| Business | 3,2 % | 9,3 % |
| First | 1,0 % | 3,5 % |

### Schwierigkeit: Fluggäste Economy des Spielers gegenüber Normal (FRA–MAD 1990, A320ceo, 300 Abflüge je Gesellschaft, Sitze nicht voll)

| Schwierigkeit | Faktor | allein | gegen gleichen Rivalen | Auslastung Y (mit Rivale) |
|---|---|---|---|---|
| Easy | 1,10 | 1,4 % | 5,2 % | 22 % |
| Normal | 1,00 | 0,0 % | 0,0 % | 21 % |
| Hard | 0,90 | −1,6 % | −5,7 % | 20 % |

Viele Abflüge, damit die Sitze nicht begrenzen. Allein wirkt der Faktor nur gegen „Nicht fliegen“ (1.8).

## Abschnitt 4: Preis und Erlös

### Preis und Auslastung typischer Strecken (eine Gesellschaft, Mai)

| Strecke | Marktgröße | Sitze je Woche | Auslastung bei Marktpreis | Auslastung bei Preisniveau 4 | Bester Preis (Niveau je Klasse) | Auslastung beim besten Preis | Gewinnschwelle voll | Gewinnschwelle bei dieser Auslastung |
|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 8 743 | 994 | 100 % | 100 % | 4,00 | 100 % | 1,17 | 1,17 |
| 707-320B FRA–JFK 1965 | 3 349 | 1 918 | 99 % | 19 % | 1,68 / 1,48 / 1,19 / 1,29 | 98 % | 0,54 | 0,55 |
| 727-200 FRA–MAD 1975 | 5 475 | 1 918 | 99 % | 41 % | 2,75 / 1,93 / 1,60 / 2,15 | 96 % | 0,93 | 0,95 |
| ATR 72-200 HAM–NUE 1990 | 10 514 | 966 | 100 % | 100 % | 4,00 | 100 % | 0,93 | 0,93 |
| A320ceo FRA–MAD 1990 | 7 930 | 1 876 | 100 % | 60 % | 3,37 / 2,43 / 2,11 / 2,11 | 97 % | 0,75 | 0,76 |
| A320ceo FRA–MAD 1990 (LCC) | 7 930 | 2 828 | 100 % | 19 % | 1,71 | 100 % | 0,56 | 0,56 |
| A320ceo ATL–ORD 1990 | 9 410 | 1 876 | 100 % | 76 % | 3,77 / 2,83 / 2,72 / 2,50 | 97 % | 0,92 | 0,93 |
| A330-300 FRA–JFK 1995 | 4 463 | 4 452 | 92 % | 12 % | 1,21 / 1,25 / 1,20 / 1,39 | 87 % | 0,30 | 0,33 |
| A320ceo FRA–MAD 2019 | 8 965 | 1 876 | 100 % | 72 % | 3,71 / 2,62 / 2,30 / 2,11 | 98 % | 0,80 | 0,82 |
| A330-300 FRA–JFK 2019 | 4 664 | 4 452 | 93 % | 13 % | 1,28 / 1,25 / 1,20 / 1,39 | 88 % | 0,38 | 0,42 |
| 787-9 FRA–SIN 2019 | 3 123 | 2 432 | 97 % | 12 % | 1,26 / 1,09 / 1,01 / 1,14 | 97 % | 0,32 | 0,33 |

Bester Preis nach 4.10 (gewinnbest, Kosten je Fluggast abgezogen). Gewinnschwelle als Preisniveau für alle Klassen (4.11).

### Empfindlichkeit: Marktgröße × Faktor (wie ein kleineres `DEMAND_SCALE`), ein Flugzeug allein

| Strecke | × 1,00: Preis Y / Auslastung / Marge | × 0,50: Preis Y / Auslastung / Marge | × 0,25: Preis Y / Auslastung / Marge | × 0,10: Preis Y / Auslastung / Marge |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 4,00 / 100 % / 77 % | 2,84 / 100 % / 67 % | 1,95 / 100 % / 52 % | 1,29 / 74 % / 9 % |
| A320ceo FRA–MAD 1990 | 3,37 / 97 % / 73 % | 2,33 / 92 % / 60 % | 1,48 / 80 % / 37 % | 1,31 / 37 % / −38 % |
| A330-300 FRA–JFK 1995 | 1,21 / 87 % / 70 % | 1,10 / 47 % / 45 % | 1,10 / 24 % / −4 % | 1,10 / 9 % / −151 % |

Der Faktor wirkt als weltweites Ereignis im Beispiel-Spielstand (3.5), also genau wie eine andere Marktgröße; keine Konstante wird geändert.

### Preiskampf: zwei gleiche Gesellschaften (A320ceo, Flag-Ausstattung) auf FRA–MAD 1990, abwechselnd bester Preis

| Abflüge je Gesellschaft | Erste Antwort Y | Verlauf Y (Gesellschaft a) | fest | Endpreis (Niveau je Klasse) | Gewinnschwelle voll | Auslastung | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|
| 14 | 3,19 | 3,19 → 3,19 → 3,19 → 3,19 | ja | 3,19 / 2,07 / 1,75 / 1,95 | 0,75 | 97 % | 713 467 $ |
| 56 | 1,74 | 1,74 → 1,36 → 1,74 → 1,36 | nein, Zyklus | 1,36 / 1,36 / 1,45 / 2,34 | 0,62 | 73 % | 623 758 $ |

Jede Runde: a antwortet auf b, dann b auf a (`bestFareRatios`). 14 Abflüge = ein Flugzeug, 56 = vier Flugzeuge je Gesellschaft (eine Strecke, viele Sitze).

## Abschnitt 5: Kosten

### Erlös, Kosten und Ergebnis je Woche beim besten Preis

| Strecke | Erlös | Kosten | Ergebnis | Marge | Treibstoff | Landung | Gebühren je Fluggast | Verpflegung | Besatzung | Flugzeug-Anteil | Slots | Jahre bis Kaufpreis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 246 650 $ | 72 100 $ | 174 551 $ | 71 % | 16 % | 31 % | 16 % | 11 % | 4 % | 18 % | 5 % | 1,1 |
| 707-320B FRA–JFK 1965 | 1 594 836 $ | 615 435 $ | 979 402 $ | 61 % | 68 % | 9 % | 4 % | 8 % | 6 % | 5 % | 1 % | 0,4 |
| 727-200 FRA–MAD 1975 | 760 100 $ | 317 224 $ | 442 875 $ | 58 % | 46 % | 19 % | 8 % | 14 % | 3 % | 8 % | 1 % | 0,8 |
| ATR 72-200 HAM–NUE 1990 | 339 913 $ | 79 336 $ | 260 577 $ | 77 % | 8 % | 28 % | 14 % | 14 % | 7 % | 26 % | 3 % | 1,2 |
| A320ceo FRA–MAD 1990 | 1 120 278 $ | 303 317 $ | 816 961 $ | 73 % | 16 % | 24 % | 9 % | 20 % | 5 % | 25 % | 2 % | 1,4 |
| A320ceo FRA–MAD 1990 (LCC) | 788 338 $ | 259 611 $ | 528 727 $ | 67 % | 19 % | 28 % | 17 % | 0 % | 5 % | 29 % | 2 % | 2,1 |
| A320ceo ATL–ORD 1990 | 1 013 599 $ | 286 891 $ | 726 708 $ | 72 % | 12 % | 25 % | 10 % | 21 % | 3 % | 26 % | 2 % | 1,5 |
| A330-300 FRA–JFK 1995 | 3 504 054 $ | 1 057 779 $ | 2 446 275 $ | 70 % | 46 % | 9 % | 6 % | 12 % | 9 % | 17 % | 1 % | 1,1 |
| A320ceo FRA–MAD 2019 | 1 737 194 $ | 465 284 $ | 1 271 910 $ | 73 % | 22 % | 22 % | 9 % | 19 % | 4 % | 23 % | 2 % | 1,2 |
| A330-300 FRA–JFK 2019 | 4 893 631 $ | 1 823 329 $ | 3 070 302 $ | 63 % | 58 % | 7 % | 5 % | 10 % | 7 % | 13 % | 0 % | 1,2 |
| 787-9 FRA–SIN 2019 | 5 048 261 $ | 1 529 352 $ | 3 518 908 $ | 70 % | 52 % | 5 % | 3 % | 10 % | 7 % | 23 % | 0 % | 1,4 |

Anteile an den Kosten der Strecke (5.9). „Jahre bis Kaufpreis“ = Neupreis mit Kabine ÷ Jahresergebnis (`WEEKS_PER_MONTH` × 12 Wochen).

### Kaufpreise

| Strecke | Neupreis mit Kabine |
|---|---|
| Caravelle III FRA–CDG 1962 | 9,8 Mio. $ |
| 707-320B FRA–JFK 1965 | 21,3 Mio. $ |
| 727-200 FRA–MAD 1975 | 19,2 Mio. $ |
| ATR 72-200 HAM–NUE 1990 | 15,8 Mio. $ |
| A320ceo FRA–MAD 1990 | 57,6 Mio. $ |
| A320ceo FRA–MAD 1990 (LCC) | 57,3 Mio. $ |
| A320ceo ATL–ORD 1990 | 57,6 Mio. $ |
| A330-300 FRA–JFK 1995 | 140,9 Mio. $ |
| A320ceo FRA–MAD 2019 | 82,2 Mio. $ |
| A330-300 FRA–JFK 2019 | 188,4 Mio. $ |
| 787-9 FRA–SIN 2019 | 265,5 Mio. $ |

