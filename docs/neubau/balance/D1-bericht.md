# Balance-Bericht

Erzeugt mit `npm run balance` aus `src/balance/` (Pakete 3.9a–3.9c; Langläufe mit `--long`). Alle Zahlen kommen aus den Funktionen in `src/model/`
mit den Startwerten aus `src/model/constants.ts`; das Skript ändert keine Konstante. Bewertung und Empfehlungen:
`docs/neubau/BALANCE.md`.

Urteile: **ok** = Regel der Spezifikation gilt; **Abweichung** = Regel gilt nicht (Entscheidung nötig);
**Info** = keine feste Grenze in der Spezifikation, Wert zur Bewertung.

Prüfregeln: 16 ok · 0 Abweichung · 25 Info.

## Übersicht der Prüfregeln

| Nr. | Spez. | Regel | Wert | Urteil |
|---|---|---|---|---|
| B1.1 | 1.3, 5.2 | Treibstoff (Tabelle) gegenüber Kostenindex: wie stark verschiebt sich das Verhältnis 1960 → 2020 (Grundlage der Langstrecken-Marge, 5.18) | Treibstoff ÷ Kostenindex 2020 = 1,24 (1960 = 1) | Info |
| B2.1 | 2.10 | `satisfactionFactor(50)` liegt bei 0,75 (± 0,05) | 0,750 | ok |
| B2.2 | 2.6.2, 7.4 | Stärke der Service-Abzüge: Satisfaction der LCC (kein Service, dichte Kabine) auf Kurzstrecke; Ausgleich über Preis-Lage 0,95 (7.4) | LCC Economy FRA–CDG: 89 → Faktor 0,95 | Info |
| B3.1 | 3.3 | Die Summe der Marktgrößen aller Paare wächst 1960 → 2019 um × 2,5 (± 10 %, E64) | Summe 2,50, Mittel der Verhältnisse 3,28, Median 2,25 (115 440 Paare) | ok |
| B3.2 | 3.7 | Premium-Anteil schwankt über alle Paare: 5 %- bis 95 %-Wert mindestens 3 Prozentpunkte auseinander (1990) | 6,9 % … 11,1 % (4,1 Pp.) | ok |
| B3.3 | 3.4 | Entfernungs-Faktor kurz : lang (45 min : 20 h); Startwert 5,2 | 2,68 | Info |
| B3.4 | 3.9.3 | Stärke von `FLIGHT_TIME_EXP`: Anziehung Turboprop ÷ Jet bei sonst gleichem Angebot | FRA–CDG 0,72, FRA–MAD 0,65 | Info |
| B3.5 | 1.8 | Stärke der Schwierigkeit: Fluggäste des Spielers auf Hard gegenüber Normal (gegen einen gleichen Rivalen) | −5,7 % | Info |
| B4.1 | 3.6, 4.10 | Marktgröße gegenüber einem Flugzeug: Strecken, die selbst beim höchsten Preisniveau voll bleiben (Hinweis aus 3.8b) | keine | Info |
| B4.2 | 4.10, 7.6, E103 | Wechselseitige beste Antworten zweier gleicher Gesellschaften laufen nicht gegen 0: tiefster Preis ≥ 90 % der Gewinnschwelle voller Maschine; mit einem Flugzeug je Gesellschaft (erster Fall) auch Ergebnis > 0. Ein Verlust mit mehr Sitzen, als der Markt füllt, kommt aus der Überkapazität, nicht aus dem Unterbieten (Paket 3.9d, E103) | 14 Abflüge: tiefster Preis Y 1,75, Schwelle 0,87 (202 %), Ergebnis 182 474 $; 28 Abflüge: tiefster Preis Y 1,21, Schwelle 0,76 (159 %), Ergebnis 115 516 $ | ok |
| B4.3 | 7.6 | Enden die besten Antworten in einem festen Punkt? Nicht verlangt (7.6, E65); verlangt ist B4.2 | 14 Abflüge: Zyklus; 28 Abflüge: Zyklus | Info |
| B4.4 | 4.10 | Bester Preis gegen einen gleichen Rivalen beim Marktpreis (Hinweis 4.10: 70 % des Marktpreises) | 14 Abflüge: 1,75; 28 Abflüge: 1,21 | Info |
| B4.5 | 3.6, 4.10 | Empfindlichkeit: bester Preis Y eines A320ceo allein auf FRA–MAD 1990 bei kleinerer Marktgröße | × 1,00: 1,89; × 0,50: 1,43; × 0,25: 1,03; × 0,10: 1,03 | Info |
| B5.1 | 5.5 | Landegebühr auf Kurzstrecke 26–40 % der Kosten (Hinweis 5.5 / 5.18) | Caravelle III FRA–CDG 1962: 31 %; ATR 72-200 HAM–NUE 1990: 28 % | ok |
| B5.2 | 5.18 | Marge beim besten Preis: Langstrecke gegenüber Kurz- und Mittelstrecke (Hinweis 5.18: Langstrecke sehr einträglich) | Lang Ø 36 %, kurz/mittel Ø 39 % | Info |
| B5.3 | 5.6 | Check-in und Abfertigung ohne Bodenpersonal-Aufschlag: Anteil an den Kosten (heute mit Bodenpersonal 2–4 % mehr) | 3 % … 17 % | Info |
| B5.4 | 5.13, E54 | Listenpreise und Abschreibung: Jahre, bis eine Strecke den Kaufpreis eines neuen Flugzeugs einspielt | 1,8 … 18,4 Jahre | Info |
| B5.5 | E7 | Eine gut geführte Strecke jeder Länge bringt in jedem Jahrzehnt Gewinn (alle Fälle beim besten Preis) | 11 von 11 mit Gewinn | ok |
| B5.6 | 7.4, E45 | Vorschau „ähnlicher Erfolg“: Ergebnis LCC ÷ Flag mit demselben Flugzeug allein auf derselben Strecke | A320ceo FRA–MAD 1990: 0,62 (Marge 38 % gegen 47 %) | Info |
| B6.1 | 6.1, E36 | Ruf-Ziel bei üblicher Satisfaction um 50: Median der Ruf-Ziele aller Ausstattungen (5 Persönlichkeiten × 2 Strecken, ohne Forschung) in 40 … 60 | Median 46,7; Flag: A320ceo FRA–MAD 1990 Satisfaction 123 → 69,6, A330-300 FRA–JFK 1995 Satisfaction 105 → 54,2 | ok |
| B6.2 | 6.1 | Steigungen 0,5 (unter 100) und 0,83 (über 100): Spanne der Ruf-Ziele aller Ausstattungen, mit und ohne Forschung | 24,1 … 76,2 (Satisfaction 48 … 131) | Info |
| B6.3 | 6.2, 8.6 | `CANCELLED_REPUTATION_WEIGHT` = 100: erwarteter Abzug im Ruf-Ziel und Wirkung eines Defekts (ohne Charter) | erwartet Alter 0: 0,70, Alter 10: 1,16, Alter 20: 1,62 Punkte; ein Defekt bei 1 Flugzeug: Ruf −7,5 im Monat, 13 Monate bis < 1 Punkt; bei 10 Flugzeugen −0,75 | Info |
| B6.4 | 6.3, E37 | Werbung hebt den Ruf im Gleichgewicht um höchstens 3 Punkte und klingt nach dem Ende ab | größter Anstieg 3,00 (alle drei Kampagnen); Nachfrage-Wirkung über den Ruf 0,6 % | ok |
| B6.9 | 3.9.5, 5.14 | Werbung: Kosten je Monat ÷ Mehr-Ergebnis je Strecke (Strecken, ab denen eine Kampagne sich trägt) | 1990 local 31,1; 1990 national 42,2; 1990 global 60,1; 2019 local 27,3; 2019 national 37,0; 2019 global 52,5 | Info |
| B6.5 | 6.7, E36 | Ruf-Schwellen der Ränge: Rang 9 (Ruf 65) ist mit der besten Ausstattung und Forschung erreichbar; Rang 5 (Ruf 50) mit üblicher (Flag) Ausstattung | bestes Ziel 76,2 (ohne Forschung 69,6); Flag ohne Forschung ≥ 54,2 | ok |
| B6.6 | 6.10 | Ruf-Meilensteine 60 / 70 / 80: Satisfaction, die sie brauchen, und ob eine Ausstattung sie erreicht | 60 → Satisfaction 112, 70 → Satisfaction 124, 80 → Satisfaction 136; Gold mit keiner KI-Ausstattung erreichbar; beste Spieler-Ausstattung: Flag FRA–MAD 81,9 (mit Werbung 84,9), Boutique FRA–MAD 78,7 (mit Werbung 81,7), Flag FRA–JFK 66,1 (mit Werbung 69,1), Boutique FRA–JFK 61,6 (mit Werbung 64,6) | Info |
| B6.7 | 6.8 | Eine Gesellschaft, die die Bedingungen eines Rangs gerade erfüllt, bezahlt die Klassen-Forschung dieses Rangs aus höchstens 12 Monatsergebnissen | Rang 1: 6,3 (bei Marge 10 %: 25,0); Rang 2: 5,8 (bei Marge 10 %: 26,1); Rang 4: 1,8 (bei Marge 10 %: 7,5); Rang 5: 4,0 (bei Marge 10 %: 14,1) | ok |
| B6.8 | 6.11, E58 | Ziel-, Prämien- und Straf-Anteile: Prämie in Monatsergebnissen und nötige Chance, damit das hohe Ziel mehr bringt als das sichere | Prämie sicher / hoch = 0,24 / 0,60 Monatsergebnisse (ohne Mindestbetrag); hohes Ziel lohnt ab Chance 60 % … 60 %; Mindestprämie bindet bei 1 von 6 Beispielen (gestaffelt nach Art, E83: auch dann zahlt das hohe Ziel mehr) | Info |
| B7.13 | 7.11, E81, E84, E85 | Größte Langstrecken-Paare (über 3 500 km, beide Flughäfen ab Größe 3): bringt der beste Widebody der KI mehr als der beste Narrowbody? | 37 von 49 Paaren vor Kapitalkosten (Planer-Zahl), 37 von 49 nach Kapitalkosten (1990, 2000, 2010, je 20 Paare) | Info |
| B7.14 | 7.11, E81, E84, E85 | Paare über 7 500 km (fast nur Widebodies haben die Reichweite): Widebody vorn und nach Kapitalkosten mit Gewinn | Widebody vorn auf 29 von 30 Paaren, davon mit Gewinn nach Kapitalkosten 29 | Info |
| B8.1 | 8.5 | Preis-Absicherung (`HEDGE_PRICE_SHARE` = 0,35): Ersparnis ÷ Preis je Ölkrise | 1973 Oil Crisis: 2,64; 1979 Energy Crisis: 1,42; Gulf War Oil Shock: 1,05 | Info |
| B8.2 | 8.5 | Rückgewinnung (`RECOVERY_PRICE_SHARE` = 0,25): Mehr-Ergebnis ÷ Preis (A320ceo FRA–MAD allein, Preis vor der Krise fest) | Downturn × 1,00: 2,62; Downturn × 0,25: 1,32; Financial × 1,00: 2,53; Financial × 0,25: 1,28; Pandemic × 1,00: 2,10; Pandemic × 0,25: 0,72 | Info |
| B8.3 | 8.9, E32 | `CHARTER_MARKUP`: Charter lohnt gegenüber Streichen auf jeder Strecke mit Gewinn (Vorteil je Flug > 0) | 11 von 11 Strecken mit Gewinn; kleinster Vorteil 1 608 $ je Flug (Gebühr ÷ Erlös je Flug 30 % … 196 %) | ok |
| B8.10 | 8.9, E76, R2 | Beträge der Störungs-Frage (`charterQuestionFigures`, Flughafen-Streik 60 %) = Rechnung des Monats mit und ohne Charter (Erlösverlust, Gebühr, Vorteil) | 14 von 14 Fällen gleich; echter Erlösverlust ÷ Erlös im Mittel 86 % … 100 % (so weit lag die Schätzung bis 5.3a daneben) | ok |
| B8.4 | 8.11, E30 | Händler-Spanne −15 % / +5 %: Gebraucht kaufen und sofort verkaufen bringt höchstens 83,0 % zurück; Verlust in Monatsergebnissen einer Strecke | höchstens 83,0 %; Verlust Kauf→Verkauf Alter 0: 10,09, Alter 5: 7,26, Alter 10: 5,10, Alter 20: 1,99 Monatsergebnisse (A320ceo FRA–MAD) | ok |
| B8.5 | 8.12, E30 | Vorbestell-Rabatt höchstens 12 % < 12,9 % (Vorbestellen und sofort verkaufen bringt nie Gewinn); Rabatt als Ertrag der Anzahlung | Rabatt 5 … 12 %; sofort verkauft −0,9 % des Werts; Rabatt ÷ Anzahlung je Jahr 23 % … 42 % (Kreditzins 8 %) | ok |
| B8.6 | 8.13, E31 | Überholung (`OVERHAUL_PRICE_SHARE` = 0,04): Preis ≥ Wertgewinn; wo bindet der Mindestpreis? | Preis ≥ Wertgewinn in 5 von 5 Fällen; Mindestpreis bindet in 0; Defekt-Chance sinkt um 1,33 % / 0,40 % / 1,33 % / 1,33 % / 0,80 % je Monat | ok |
| B8.11 | 8.13 | Kabinen-Umbau (Kabine + `REFIT_PER_SEAT_1960` × Sitze, mit Kostenindex): Preis in Monatsergebnissen der Strecke | A320ceo FRA–MAD 1990: 0,3 (Lohn 0,17); A320ceo FRA–MAD 2019: 0,7 (Lohn 0,16); A330-300 FRA–JFK 2019: 0,9 (Lohn 0,26); ATR 72-200 HAM–NUE 1990: 2,0 (Lohn 1,38) | Info |
| B8.7 | 8.10 | Verschleiß mit `WEEKS_PER_MONTH`: Punkte je Jahr und Jahre bis Zustand 50 (Kabine / Zelle) bei typischem Flugplan | 45 … 452 Stunden je Monat; Kabine 1,8 … 7,7, Zelle 1,6 … 5,3 Punkte je Jahr | Info |
| B8.8 | 8.14, E34 | Kreditlinie (8 % Zins, Grenze `CREDIT_LIMIT_SHARE` × Flottenwert): Grenze in Monaten fester Strecken-Kosten; Zins bei voller Nutzung gegen das Monatsergebnis | Grenze = 5,2 … 33,7 Monate fester Kosten; Zins = 7 % … 74 % des Monatsergebnisses | Info |
| B8.9 | 8.15, 6.15 | Szenario „Oil Shock“: Ruf 55 bis zum Stichtag ist mit einer besseren Kabine erreichbar, aber nicht ohne Zutun | nach 39 Monaten: LCC-Kabine, Zustand 60 29,4; Flag-Kabine, Zustand 60 (ohne Umbau) 52,3; Flag-Kabine nach Umbau (Zustand 90) 58,2; Boutique-Kabine nach Umbau (Zustand 90) 57,5 | ok |

## Abschnitt 1: Zeit und Geld

### Kostenindex, Nachfrage-Wachstum, Treibstoff, Marktpreis (Januar)

| Jahr | costIndex | demandGrowth | Treibstoff je Gallone | Treibstoff ÷ Index (1960 = 1) | Marktpreis Y FRA–MAD |
|---|---|---|---|---|---|
| 1960 | 1,00 | 1,00 | 1,05 $ | 1,00 | 98 $ |
| 1970 | 1,13 | 1,12 | 1,55 $ | 1,31 | 111 $ |
| 1980 | 1,27 | 1,26 | 2,92 $ | 2,19 | 125 $ |
| 1990 | 1,43 | 1,41 | 1,20 $ | 0,80 | 141 $ |
| 2000 | 1,61 | 1,58 | 1,72 $ | 1,02 | 158 $ |
| 2010 | 1,82 | 1,78 | 2,64 $ | 1,39 | 178 $ |
| 2020 | 2,05 | 1,99 | 2,66 $ | 1,24 | 201 $ |
| 2030 | 2,30 | 2,24 | 2,39 $ | 0,99 | 227 $ |

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
| HAM–NUE (klein, kurz) | 465 | 946 | 1 234 | 1 397 | 1 564 | 1 351 | 86,3 % / 7,2 % / 5,3 % / 1,3 % |
| FRA–CDG (groß, kurz) | 449 | 5 418 | 7 338 | 9 430 | 10 387 | 8 440 | 86,0 % / 7,2 % / 5,4 % / 1,3 % |
| FRA–MAD (Mittelstrecke) | 1 420 | 2 624 | 3 840 | 4 455 | 5 901 | 4 995 | 84,9 % / 7,7 % / 5,9 % / 1,5 % |
| ATL–ORD (US-Inland) | 976 | 4 020 | 8 124 | 7 851 | 7 350 | 5 584 | 86,8 % / 7,0 % / 4,9 % / 1,2 % |
| FRA–JFK (Langstrecke) | 6 189 | 3 328 | 3 872 | 4 099 | 4 111 | 3 534 | 80,2 % / 9,6 % / 7,6 % / 2,6 % |
| FRA–SIN (sehr lang) | 10 278 | 728 | 1 427 | 2 458 | 3 100 | 2 911 | 76,7 % / 11,0 % / 8,9 % / 3,4 % |

`marketSize` (3.6) mit `eventFactor` 1; Klassen-Anteile `classShares` (3.7).

### Klassen-Anteile über alle Paare (1990)

| Klasse | 5 %-Wert | 95 %-Wert |
|---|---|---|
| Premium | 6,9 % | 11,1 % |
| Business | 4,1 % | 9,2 % |
| First | 1,1 % | 3,4 % |

### Schwierigkeit: Fluggäste Economy des Spielers gegenüber Normal (FRA–MAD 1990, A320ceo, 300 Abflüge je Gesellschaft, Sitze nicht voll)

| Schwierigkeit | Faktor | allein | gegen gleichen Rivalen | Auslastung Y (mit Rivale) |
|---|---|---|---|---|
| Easy | 1,10 | 1,4 % | 5,2 % | 12 % |
| Normal | 1,00 | 0,0 % | 0,0 % | 12 % |
| Hard | 0,90 | −1,6 % | −5,7 % | 11 % |

Viele Abflüge, damit die Sitze nicht begrenzen. Allein wirkt der Faktor nur gegen „Nicht fliegen“ (1.8).

## Abschnitt 4: Preis und Erlös

### Preis und Auslastung typischer Strecken (eine Gesellschaft, Mai)

| Strecke | Marktgröße | Abflüge je Woche | Sitze je Woche | Auslastung bei Marktpreis | Auslastung bei Preisniveau 4 | Bester Preis (Niveau je Klasse) | Auslastung beim besten Preis | Gewinnschwelle voll | Gewinnschwelle bei dieser Auslastung |
|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 5 746 | 14 | 994 | 100 % | 19 % | 2,37 | 100 % | 1,29 | 1,29 |
| 707-320B FRA–JFK 1965 | 3 633 | 12 | 1 644 | 100 % | 5 % | 1,47 / 1,49 / 1,25 / 1,02 | 100 % | 0,93 | 0,93 |
| 727-200 FRA–MAD 1975 | 3 840 | 14 | 1 918 | 98 % | 8 % | 1,75 / 1,42 / 1,26 / 1,52 | 96 % | 1,07 | 1,10 |
| ATR 72-200 HAM–NUE 1990 | 1 397 | 14 | 966 | 100 % | 3 % | 1,25 | 100 % | 1,03 | 1,03 |
| A320ceo FRA–MAD 1990 | 4 455 | 14 | 1 876 | 99 % | 9 % | 1,89 / 1,50 / 1,34 / 1,50 | 97 % | 0,87 | 0,89 |
| A320ceo FRA–MAD 1990 (LCC) | 4 455 | 14 | 2 828 | 100 % | 2 % | 1,06 | 100 % | 0,65 | 0,65 |
| A320ceo ATL–ORD 1990 | 7 851 | 14 | 1 876 | 100 % | 17 % | 2,39 / 1,91 / 1,68 / 1,74 | 97 % | 1,01 | 1,03 |
| A330-300 FRA–JFK 1995 | 4 283 | 14 | 4 452 | 92 % | 3 % | 1,11 / 0,99 / 0,92 / 1,07 | 93 % | 0,51 | 0,54 |
| A320ceo FRA–MAD 2019 | 4 986 | 14 | 1 876 | 99 % | 11 % | 2,03 / 1,60 / 1,45 / 1,50 | 97 % | 0,93 | 0,95 |
| A330-300 FRA–JFK 2019 | 3 542 | 8 | 2 544 | 97 % | 3 % | 1,25 / 1,08 / 0,93 / 0,97 | 98 % | 0,71 | 0,72 |
| 787-9 FRA–SIN 2019 | 2 923 | 8 | 2 432 | 97 % | 3 % | 1,12 / 1,07 / 0,93 / 0,91 | 99 % | 0,63 | 0,64 |

Bester Preis nach 4.10 (gewinnbest, Kosten je Fluggast abgezogen). Abflüge: gewinnbeste gerade Zahl bis 14 (787-9: 8) beim besten Preis (`bestDeparturesCase`). Gewinnschwelle als Preisniveau für alle Klassen (4.11).

### Empfindlichkeit: Marktgröße × Faktor (wie ein kleineres `DEMAND_SCALE`), ein Flugzeug allein

| Strecke | × 1,00: Preis Y / Auslastung / Marge | × 0,50: Preis Y / Auslastung / Marge | × 0,25: Preis Y / Auslastung / Marge | × 0,10: Preis Y / Auslastung / Marge |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 1,25 / 100 % / 17 % | 1,04 / 68 % / −34 % | 1,04 / 34 % / −140 % | 1,04 / 14 % / −458 % |
| A320ceo FRA–MAD 1990 | 1,89 / 97 % / 47 % | 1,43 / 88 % / 26 % | 1,03 / 69 % / −18 % | 1,03 / 27 % / −163 % |
| A330-300 FRA–JFK 1995 | 1,11 / 93 % / 45 % | 0,89 / 59 % / 4 % | 0,89 / 30 % / −80 % | 0,89 / 12 % / −331 % |

Der Faktor wirkt als weltweites Ereignis im Beispiel-Spielstand (3.5), also genau wie eine andere Marktgröße; keine Konstante wird geändert.

### Preiskampf: zwei gleiche Gesellschaften (A320ceo, Flag-Ausstattung) auf FRA–MAD 1990, abwechselnd bester Preis

| Abflüge je Gesellschaft | Erste Antwort Y | Verlauf Y (Gesellschaft a) | fest | Endpreis (Niveau je Klasse) | Gewinnschwelle voll | Auslastung | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|
| 14 | 1,75 | 1,75 → 1,75 → 1,75 → 1,75 | nein, Zyklus | 1,75 / 1,14 / 1,09 / 1,39 | 0,87 | 94 % | 182 474 $ |
| 28 | 1,21 | 1,21 → 1,21 → 1,21 → 1,21 | nein, Zyklus | 1,21 / 0,77 / 0,78 / 1,46 | 0,76 | 85 % | 115 516 $ |

Jede Runde: a antwortet auf b, dann b auf a (`bestFareRatios`). 14 Abflüge = ein Flugzeug, 28 = zwei Flugzeuge je Gesellschaft (eine Strecke, mehr Sitze als der Markt füllt; bis Paket 3.9d 56 = vier Flugzeuge, bei der kleineren Marktgröße nur noch Überkapazität).

## Abschnitt 5: Kosten

### Erlös, Kosten und Ergebnis je Woche beim besten Preis

| Strecke | Erlös | Kosten | Ergebnis | Marge | Treibstoff | Landung | Gebühren je Fluggast | Verpflegung | Besatzung | Flugzeug-Anteil | Slots | Jahre bis Kaufpreis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 132 050 $ | 72 100 $ | 59 950 $ | 45 % | 16 % | 31 % | 16 % | 11 % | 4 % | 18 % | 5 % | 3,1 |
| 707-320B FRA–JFK 1965 | 772 151 $ | 539 572 $ | 232 579 $ | 30 % | 66 % | 9 % | 4 % | 9 % | 6 % | 5 % | 1 % | 1,8 |
| 727-200 FRA–MAD 1975 | 447 332 $ | 318 129 $ | 129 203 $ | 29 % | 46 % | 19 % | 8 % | 14 % | 3 % | 8 % | 1 % | 2,9 |
| ATR 72-200 HAM–NUE 1990 | 95 803 $ | 79 330 $ | 16 474 $ | 17 % | 8 % | 28 % | 14 % | 14 % | 7 % | 26 % | 3 % | 18,4 |
| A320ceo FRA–MAD 1990 | 562 536 $ | 299 873 $ | 262 663 $ | 47 % | 16 % | 24 % | 10 % | 19 % | 5 % | 25 % | 2 % | 4,2 |
| A320ceo FRA–MAD 1990 (LCC) | 421 508 $ | 259 617 $ | 161 891 $ | 38 % | 19 % | 28 % | 17 % | 0 % | 5 % | 29 % | 2 % | 6,8 |
| A320ceo ATL–ORD 1990 | 580 230 $ | 283 251 $ | 296 979 $ | 51 % | 12 % | 26 % | 10 % | 20 % | 3 % | 26 % | 2 % | 3,7 |
| A330-300 FRA–JFK 1995 | 1 966 734 $ | 1 091 191 $ | 875 543 $ | 45 % | 44 % | 9 % | 6 % | 15 % | 8 % | 17 % | 0 % | 3,1 |
| A320ceo FRA–MAD 2019 | 858 647 $ | 460 205 $ | 398 442 $ | 46 % | 22 % | 22 % | 9 % | 18 % | 4 % | 23 % | 2 % | 4,0 |
| A330-300 FRA–JFK 2019 | 1 771 879 $ | 1 195 452 $ | 576 426 $ | 33 % | 50 % | 6 % | 5 % | 12 % | 6 % | 20 % | 0 % | 6,3 |
| 787-9 FRA–SIN 2019 | 2 436 239 $ | 1 550 300 $ | 885 939 $ | 36 % | 52 % | 5 % | 3 % | 11 % | 7 % | 22 % | 0 % | 5,7 |

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

## Abschnitt 6: Ruf, Rang, Fortschritt

### Satisfaction und Ruf-Ziel je Ausstattung (allein auf der Strecke, Mai)

| Strecke | Ausstattung | Airline satisfaction | Ruf-Ziel | Rang nach Ruf | mit Forschung (+8) | Ruf-Ziel | Rang nach Ruf |
|---|---|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990 | LCC | 77,9 | 39,0 | 2 | 85,9 | 43,0 | 3 |
| A320ceo FRA–MAD 1990 | Expansionist | 87,7 | 43,8 | 3 | 95,7 | 47,8 | 4 |
| A320ceo FRA–MAD 1990 | Optimizer | 107,3 | 56,1 | 7 | 115,3 | 62,8 | 8 |
| A320ceo FRA–MAD 1990 | Flag | 123,5 | 69,6 | 9 | 131,5 | 76,2 | 9 |
| A320ceo FRA–MAD 1990 | Boutique | 118,9 | 65,7 | 9 | 126,9 | 72,4 | 9 |
| A330-300 FRA–JFK 1995 | LCC | 48,1 | 24,1 | 0 | 56,1 | 28,1 | 0 |
| A330-300 FRA–JFK 1995 | Expansionist | 65,3 | 32,6 | 1 | 73,2 | 36,6 | 2 |
| A330-300 FRA–JFK 1995 | Optimizer | 87,0 | 43,5 | 3 | 95,0 | 47,5 | 4 |
| A330-300 FRA–JFK 1995 | Flag | 105,0 | 54,2 | 6 | 113,2 | 61,0 | 8 |
| A330-300 FRA–JFK 1995 | Boutique | 99,2 | 49,6 | 4 | 107,3 | 56,1 | 7 |

Kabine und Service nach `rivalCabin` / `rivalService` (7.5), neues Flugzeug, Lohn 100 %, keine Ausfälle, keine Werbung. „Mit Forschung“: sat-1 … sat-6 und cabin (6.9). „Rang nach Ruf“: höchster Rang, dessen Ruf-Schwelle das Ziel erfüllt (nur diese Spalte der Rang-Tabelle).

### Gestrichene Sitze in einem Monat: Ruf-Verlust (Ruf im Gleichgewicht, danach keine Ausfälle)

| Anteil gestrichen | Abzug im Ziel | Ruf-Verlust im Monat | Monate bis < 1 Punkt | entspricht Satisfaction-Punkten (unter 100) |
|---|---|---|---|---|
| 1 % | 1,0 | 0,15 | 0 | 2 |
| 5 % | 5,0 | 0,75 | 0 | 10 |
| 10 % | 10,0 | 1,50 | 3 | 20 |
| 25 % | 25,0 | 3,75 | 9 | 50 |
| 50 % | 50,0 | 7,50 | 13 | 100 |

Ein Defekt streicht 50 % der Flüge eines Flugzeugs (8.6); bei einer Gesellschaft mit einem Flugzeug ist das ein Anteil von 50 %. Erwarteter Anteil je Monat (Defekt, Flughafen-Streik an zwei Enden, Winter im Jahresmittel; Zelle nach Alter wie im Gebrauchtmarkt): Alter 0 0,70 %, Alter 10 1,16 %, Alter 20 1,62 %. Gecharterte Flüge zählen nicht (E32).

### Werbe-Beitrag: Satisfaction 100, Start Ruf 50

| Kampagnen | Beitrag | Ruf nach 12 Monaten | Gleichgewicht | 6 Monate nach dem Ende |
|---|---|---|---|---|
| local | 0,5 | 50,43 | 50,50 | 50,16 |
| national | 1,0 | 50,86 | 51,00 | 50,32 |
| global | 2,0 | 51,72 | 52,00 | 50,65 |
| local + national + global | 3,0 | 52,57 | 53,00 | 50,97 |

Der Beitrag steht im Ruf-Ziel (6.4); die Hauptwirkung der Werbung ist die Anziehung (3.9.5), nicht der Ruf.

### Werbung: eine Kampagne in der Region der Strecke (global: weltweit), Strecke allein beim besten Preis ohne Werbung

| Strecke | Kampagne | Kosten je Monat | Fluggäste mit ÷ ohne | Mehr-Ergebnis je Monat | Strecken bis zur Deckung |
|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990 | local | 107 697 $ | 1,001 | 3 462 $ | 31,1 |
| A320ceo FRA–MAD 1990 | national | 287 192 $ | 1,002 | 6 800 $ | 42,2 |
| A320ceo FRA–MAD 1990 | global | 717 980 $ | 1,003 | 11 948 $ | 60,1 |
| A320ceo FRA–MAD 2019 | local | 152 208 $ | 1,001 | 5 570 $ | 27,3 |
| A320ceo FRA–MAD 2019 | national | 405 889 $ | 1,002 | 10 981 $ | 37,0 |
| A320ceo FRA–MAD 2019 | global | 1 014 722 $ | 1,004 | 19 326 $ | 52,5 |

Preis fest (bester Preis ohne Werbung). Mehr-Ergebnis = (Strecken-Ergebnis mit − ohne Kampagne) × `WEEKS_PER_MONTH`. Eine regionale Kampagne wirkt auf alle Strecken mit einem Ende in der Region (3.9.5); „Strecken bis zur Deckung“ zählt gleich große Strecken.

### Beste Spieler-Ausstattung: Ruf-Ziel gegen die Ruf-Meilensteine (allein auf der Strecke, Mai)

| Strecke | Kabine und Service | Airline satisfaction | Ruf-Ziel | mit allen Kampagnen | Gold (80) |
|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990 | Flag | 138,2 | 81,9 | 84,9 | ja |
| A320ceo FRA–MAD 1990 | Boutique | 134,4 | 78,7 | 81,7 | mit Werbung |
| A330-300 FRA–JFK 1995 | Flag | 119,3 | 66,1 | 69,1 | nein |
| A330-300 FRA–JFK 1995 | Boutique | 113,9 | 61,6 | 64,6 | nein |

Alle Satisfaction-Forschung (sat-1 … sat-6, cabin), Moral 100, VIP-Lounge, Bordküche und Hangar an beiden Enden, Verwaltungsstufe 3; Kabine und Service nach der Persönlichkeit (7.5). Die Airline satisfaction ist das Mittel über alle Fluggäste der Gesellschaft: Gold braucht ein Netz, das überwiegend aus solchen Strecken besteht.

### Ruf-Schwellen: nötige Satisfaction und Ausstattungen, die sie erreichen

| Stufe | Ruf | Satisfaction nötig | erreicht ohne Forschung | erreicht erst mit Forschung |
|---|---|---|---|---|
| Rang 1 Local Airline | 30 | 60 | LCC (FRA–MAD), Expansionist (FRA–MAD), Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Expansionist (FRA–JFK), Optimizer (FRA–JFK), Flag (FRA–JFK), Boutique (FRA–JFK) | – |
| Rang 2 Regional Airline | 35 | 70 | LCC (FRA–MAD), Expansionist (FRA–MAD), Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Optimizer (FRA–JFK), Flag (FRA–JFK), Boutique (FRA–JFK) | Expansionist (FRA–JFK) |
| Rang 3 Domestic Airline | 40 | 80 | Expansionist (FRA–MAD), Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Optimizer (FRA–JFK), Flag (FRA–JFK), Boutique (FRA–JFK) | LCC (FRA–MAD) |
| Rang 4 National Airline | 45 | 90 | Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Flag (FRA–JFK), Boutique (FRA–JFK) | Expansionist (FRA–MAD), Optimizer (FRA–JFK) |
| Rang 5 Continental Airline | 50 | 100 | Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Flag (FRA–JFK) | Boutique (FRA–JFK) |
| Rang 6 International Airline | 53 | 104 | Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Flag (FRA–JFK) | Boutique (FRA–JFK) |
| Rang 7 Intercontinental Airline | 56 | 107 | Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD) | Flag (FRA–JFK), Boutique (FRA–JFK) |
| Rang 8 Flag Carrier | 60 | 112 | Flag (FRA–MAD), Boutique (FRA–MAD) | Optimizer (FRA–MAD), Flag (FRA–JFK) |
| Rang 9 Global Player | 65 | 118 | Flag (FRA–MAD), Boutique (FRA–MAD) | – |
| Meilenstein A name people know | 60 | 112 | Flag (FRA–MAD), Boutique (FRA–MAD) | Optimizer (FRA–MAD), Flag (FRA–JFK) |
| Meilenstein A reputation worth having | 70 | 124 | – | Flag (FRA–MAD), Boutique (FRA–MAD) |
| Meilenstein The gold standard | 80 | 136 | – | – |

Ausstattungen aus der Tabelle oben (allein auf der Strecke, keine Ausfälle). Das Ruf-Ziel wird nach rund einem Jahr fast erreicht (Halbwertszeit 4,3 Monate, 6.5).

### Klassen-Forschung gegen das Monatsergebnis einer Gesellschaft an der Rang-Schwelle

| Rang (frühestens) | Strecke (bester Preis) | Fluggäste je Monat (Schwelle) | Ergebnis je Fluggast | Marge | Monatsergebnis | Klassen-Forschung | Preis | Monatsergebnisse | … bei Marge 10 % |
|---|---|---|---|---|---|---|---|---|---|
| 1 (April 1960) | F27-200 HAM–FRA 1960 (Commuter) | 8 000 | 42,1 $ | 40 % | 0,34 Mio. $ | Regional aircraft class | 2,11 Mio. $ | 6,3 | 25,0 |
| 2 (Jan. 1961) | Caravelle III FRA–CDG 1961 (Regional) | 25 000 | 58,7 $ | 45 % | 1,47 Mio. $ | Narrowbody aircraft class | 8,50 Mio. $ | 5,8 | 26,1 |
| 4 (Jan. 1966) | 727-100 FRA–MAD 1966 (Narrowbody) | 170 000 | 98,7 $ | 42 % | 16,78 Mio. $ | Wide-body aircraft class | 30,08 Mio. $ | 1,8 | 7,5 |
| 5 (Jan. 1970) | 727-200 FRA–MAD 1970 (Narrowbody) | 350 000 | 79,8 $ | 36 % | 27,93 Mio. $ | Jumbo aircraft class + Supersonic aircraft class | 110,42 Mio. $ | 4,0 | 14,1 |

Monatsergebnis = Fluggäste der Rang-Schwelle × Ergebnis je Fluggast der typischen Strecke beim besten Preis (Strecken-Ergebnis 5.9, ohne Kosten der Gesellschaft wie Flughäfen und Verwaltung). Preis im Monat des Rangs (`atCost`). Die letzte Spalte rechnet mit 10 % Marge auf denselben Erlös (Ziel nach E67: 10–25 %).

### Jahresziel der Rang-Beispiele (Angebot im Monat des Rangs)

| Beispiel | Vorjahr: Ergebnis | Vorjahr: Erlös | Bezugsgröße | sicher (× 1,10) | hoch (× 1,35) | Prämie sicher / andere Art / hoch | Strafe hoch | hohes Ziel lohnt ab Chance |
|---|---|---|---|---|---|---|---|---|
| Rang 1, 1960 | 4,04 Mio. $ | 10,10 Mio. $ | 4,04 Mio. $ | 4,44 Mio. $ | 5,45 Mio. $ | 0,25 Mio. $* / 0,38 Mio. $* / 0,63 Mio. $* | 0,31 Mio. $ | 60 % |
| Rang 2, 1961 | 17,62 Mio. $ | 39,02 Mio. $ | 17,62 Mio. $ | 19,38 Mio. $ | 23,79 Mio. $ | 0,35 Mio. $ / 0,53 Mio. $ / 0,88 Mio. $ | 0,44 Mio. $ | 60 % |
| Rang 4, 1966 | 201,40 Mio. $ | 483,42 Mio. $ | 201,40 Mio. $ | 221,54 Mio. $ | 271,89 Mio. $ | 4,03 Mio. $ / 6,04 Mio. $ / 10,07 Mio. $ | 5,03 Mio. $ | 60 % |
| Rang 5, 1970 | 335,19 Mio. $ | 942,02 Mio. $ | 335,19 Mio. $ | 368,70 Mio. $ | 452,50 Mio. $ | 6,70 Mio. $ / 10,06 Mio. $ / 16,76 Mio. $ | 8,38 Mio. $ | 60 % |
| Rang 5, 1970, Marge 10 % | 94,20 Mio. $ | 942,02 Mio. $ | 94,20 Mio. $ | 103,62 Mio. $ | 127,17 Mio. $ | 1,88 Mio. $ / 2,83 Mio. $ / 4,71 Mio. $ | 2,36 Mio. $ | 60 % |
| Rang 5, 1970, Verlustjahr (−5 %) | −47,10 Mio. $ | 942,02 Mio. $ | 47,10 Mio. $ | 51,81 Mio. $ | 63,59 Mio. $ | 0,94 Mio. $ / 1,41 Mio. $ / 2,36 Mio. $ | 1,18 Mio. $ | 60 % |

* = Mindestprämie (sicher 0,25 Mio. $ von 1960 über `atCost`, andere Art und hoch im Verhältnis der Anteile, E83). „Lohnt ab Chance“: Das hohe Ziel bringt im Mittel mehr als ein sicher erreichtes sicheres Ziel, wenn es mit dieser Wahrscheinlichkeit erreicht wird (Strafe = 50 % der Prämie, E58). Das sichere Ziel selbst lohnt ab einer Chance von 33 %.

## Abschnitt 7: Flugzeugwahl der KI auf Langstrecke (O79)

### Die 20 größten Langstrecken-Paare je Jahr: bester Narrowbody gegen besten Widebody (Flag-Ausstattung)

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | HND–SVO | 7 494 | 7 766 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,82 Mio. $ | 1,68 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 92 %) | 6,96 Mio. $ | 5,67 Mio. $ | Widebody |
| 1990 | ORD–SVO | 7 974 | 7 278 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,65 Mio. $ | 1,50 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 91 %) | 6,90 Mio. $ | 5,61 Mio. $ | Widebody |
| 1990 | LHR–ORD | 6 345 | 7 268 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 3,06 Mio. $ | 2,60 Mio. $ | 747-400 (476 Sitze, 9/9 Umläufe, 87 %) | 5,26 Mio. $ | 3,97 Mio. $ | Widebody |
| 1990 | ORD–CDG | 6 665 | 6 875 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 3,20 Mio. $ | 2,74 Mio. $ | 747-400 (476 Sitze, 9/9 Umläufe, 87 %) | 5,50 Mio. $ | 4,20 Mio. $ | Widebody |
| 1990 | LHR–HND | 9 592 | 6 758 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,59 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 96 %) | 7,44 Mio. $ | 6,14 Mio. $ | Widebody |
| 1990 | LAX–SVO | 9 758 | 6 733 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,61 Mio. $ | 1,47 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 95 %) | 6,93 Mio. $ | 5,63 Mio. $ | Widebody |
| 1990 | LHR–JFK | 5 540 | 6 601 | 757-200 (173 Sitze, 10/10 Umläufe, 99 %) | 3,01 Mio. $ | 2,54 Mio. $ | 767-300 (253 Sitze, 10/10 Umläufe, 96 %) | 4,13 Mio. $ | 3,41 Mio. $ | Widebody |
| 1990 | LAX–JFK | 3 974 | 6 499 | 757-200 (173 Sitze, 14/14 Umläufe, 97 %) | 3,36 Mio. $ | 2,89 Mio. $ | 767-300 (253 Sitze, 13/13 Umläufe, 89 %) | 3,71 Mio. $ | 2,99 Mio. $ | Widebody |
| 1990 | JFK–SVO | 7 481 | 6 481 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,82 Mio. $ | 1,68 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 88 %) | 5,37 Mio. $ | 4,07 Mio. $ | Widebody |
| 1990 | HND–CDG | 9 707 | 6 457 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,60 Mio. $ | 1,45 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 96 %) | 7,45 Mio. $ | 6,15 Mio. $ | Widebody |
| 1990 | LHR–LAX | 8 760 | 6 401 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,76 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 90 %) | 6,06 Mio. $ | 4,77 Mio. $ | Widebody |
| 1990 | CDG–JFK | 5 833 | 6 256 | 757-200 (173 Sitze, 10/10 Umläufe, 99 %) | 3,07 Mio. $ | 2,61 Mio. $ | 767-300 (253 Sitze, 9/9 Umläufe, 97 %) | 3,97 Mio. $ | 3,25 Mio. $ | Widebody |
| 1990 | LHR–BOS | 5 240 | 6 228 | 757-200 (173 Sitze, 11/11 Umläufe, 98 %) | 3,17 Mio. $ | 2,71 Mio. $ | 767-300 (253 Sitze, 10/10 Umläufe, 94 %) | 3,72 Mio. $ | 3,00 Mio. $ | Widebody |
| 1990 | LAX–CDG | 9 103 | 6 102 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,53 Mio. $ | 1,39 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 90 %) | 6,26 Mio. $ | 4,96 Mio. $ | Widebody |
| 1990 | HND–LAX | 8 813 | 6 042 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,77 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 90 %) | 5,96 Mio. $ | 4,66 Mio. $ | Widebody |
| 1990 | BOS–SVO | 7 191 | 5 970 | 757-200 (173 Sitze, 8/8 Umläufe, 100 %) | 3,03 Mio. $ | 2,57 Mio. $ | 767-300 (253 Sitze, 8/8 Umläufe, 98 %) | 4,50 Mio. $ | 3,78 Mio. $ | Widebody |
| 1990 | HND–ORD | 10 124 | 5 968 | – | – | – | 747-400 (476 Sitze, 6/6 Umläufe, 94 %) | 6,95 Mio. $ | 5,66 Mio. $ | Widebody |
| 1990 | LAX–BOS | 4 193 | 5 923 | 757-200 (173 Sitze, 13/13 Umläufe, 96 %) | 3,12 Mio. $ | 2,66 Mio. $ | 767-200 (210 Sitze, 12/12 Umläufe, 93 %) | 3,29 Mio. $ | 2,66 Mio. $ | Widebody |
| 1990 | CDG–BOS | 5 534 | 5 906 | 757-200 (173 Sitze, 10/10 Umläufe, 99 %) | 2,94 Mio. $ | 2,48 Mio. $ | 767-300 (253 Sitze, 10/10 Umläufe, 94 %) | 3,73 Mio. $ | 3,01 Mio. $ | Widebody |
| 1990 | SFO–SVO | 9 434 | 5 690 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,58 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 89 %) | 5,98 Mio. $ | 4,69 Mio. $ | Widebody |
| 2000 | LHR–HND | 9 592 | 7 151 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,05 Mio. $ | 5,65 Mio. $ | Widebody |
| 2000 | LHR–ORD | 6 345 | 7 090 | 757-300 (213 Sitze, 9/9 Umläufe, 99 %) | 3,33 Mio. $ | 2,70 Mio. $ | a330-200 (293 Sitze, 9/9 Umläufe, 97 %) | 4,92 Mio. $ | 4,00 Mio. $ | Widebody |
| 2000 | LHR–LAX | 8 760 | 6 948 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 6,69 Mio. $ | 5,28 Mio. $ | Widebody |
| 2000 | HND–CDG | 9 707 | 6 916 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,15 Mio. $ | 5,74 Mio. $ | Widebody |
| 2000 | ORD–CDG | 6 665 | 6 801 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 2,92 Mio. $ | 2,40 Mio. $ | a330-200 (293 Sitze, 9/9 Umläufe, 97 %) | 5,22 Mio. $ | 4,30 Mio. $ | Widebody |
| 2000 | LAX–CDG | 9 103 | 6 708 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 7,01 Mio. $ | 5,60 Mio. $ | Widebody |
| 2000 | HND–LAX | 8 813 | 6 379 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 96 %) | 6,48 Mio. $ | 5,07 Mio. $ | Widebody |
| 2000 | LHR–JFK | 5 540 | 6 177 | 757-300 (213 Sitze, 10/10 Umläufe, 97 %) | 3,02 Mio. $ | 2,39 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 90 %) | 3,60 Mio. $ | 2,68 Mio. $ | Widebody |
| 2000 | LAX–JFK | 3 974 | 6 072 | tu-204-100 (152 Sitze, 14/14 Umläufe, 97 %) | 2,78 Mio. $ | 2,43 Mio. $ | a330-200 (293 Sitze, 13/13 Umläufe, 85 %) | 3,40 Mio. $ | 2,47 Mio. $ | Widebody |
| 2000 | LHR–BOS | 5 240 | 5 958 | 757-300 (213 Sitze, 11/11 Umläufe, 95 %) | 3,04 Mio. $ | 2,41 Mio. $ | a330-200 (293 Sitze, 11/11 Umläufe, 88 %) | 3,49 Mio. $ | 2,57 Mio. $ | Widebody |
| 2000 | CDG–JFK | 5 833 | 5 920 | 757-300 (213 Sitze, 10/10 Umläufe, 97 %) | 3,07 Mio. $ | 2,44 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 90 %) | 3,63 Mio. $ | 2,71 Mio. $ | Widebody |
| 2000 | LHR–ICN | 8 861 | 5 790 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,36 Mio. $ | 4,44 Mio. $ | Widebody |
| 2000 | LAX–BOS | 4 193 | 5 733 | tu-204-100 (152 Sitze, 13/13 Umläufe, 97 %) | 2,65 Mio. $ | 2,30 Mio. $ | a330-200 (293 Sitze, 13/13 Umläufe, 84 %) | 3,25 Mio. $ | 2,32 Mio. $ | Widebody |
| 2000 | LHR–SFO | 8 616 | 5 725 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,09 Mio. $ | 4,17 Mio. $ | Widebody |
| 2000 | CDG–BOS | 5 534 | 5 706 | 757-300 (213 Sitze, 10/10 Umläufe, 97 %) | 2,93 Mio. $ | 2,30 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 89 %) | 3,39 Mio. $ | 2,47 Mio. $ | Widebody |
| 2000 | ATL–LHR | 6 761 | 5 698 | 757-200 (173 Sitze, 9/9 Umläufe, 99 %) | 2,72 Mio. $ | 2,19 Mio. $ | a330-200 (293 Sitze, 8/8 Umläufe, 92 %) | 3,52 Mio. $ | 2,60 Mio. $ | Widebody |
| 2000 | HND–ORD | 10 124 | 5 677 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 97 %) | 6,49 Mio. $ | 5,08 Mio. $ | Widebody |
| 2000 | CDG–ICN | 8 927 | 5 637 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,42 Mio. $ | 4,49 Mio. $ | Widebody |
| 2000 | ATL–CDG | 7 055 | 5 534 | 757-200 (173 Sitze, 8/8 Umläufe, 99 %) | 2,55 Mio. $ | 2,03 Mio. $ | a330-200 (293 Sitze, 8/8 Umläufe, 92 %) | 3,67 Mio. $ | 2,75 Mio. $ | Widebody |
| 2000 | CDG–SFO | 8 962 | 5 508 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,35 Mio. $ | 4,43 Mio. $ | Widebody |
| 2010 | CDG–PEK | 8 190 | 7 211 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,19 Mio. $ | 0,70 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 94 %) | 3,36 Mio. $ | 2,32 Mio. $ | Widebody |
| 2010 | LHR–PEK | 8 154 | 6 960 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,18 Mio. $ | 0,69 Mio. $ | il-96-300 (217 Sitze, 7/7 Umläufe, 98 %) | 2,44 Mio. $ | 1,77 Mio. $ | Widebody |
| 2010 | PEK–CGK | 5 237 | 6 192 | 737-900er (160 Sitze, 11/11 Umläufe, 97 %) | 2,23 Mio. $ | 1,69 Mio. $ | il-96-300 (217 Sitze, 10/10 Umläufe, 91 %) | 1,67 Mio. $ | 0,99 Mio. $ | Narrowbody |
| 2010 | HND–CDG | 9 707 | 6 084 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,09 Mio. $ | 0,60 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 93 %) | 2,94 Mio. $ | 1,90 Mio. $ | Widebody |
| 2010 | LHR–HND | 9 592 | 5 952 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 99 %) | 2,41 Mio. $ | 1,73 Mio. $ | Widebody |
| 2010 | CDG–JFK | 5 833 | 5 856 | a320ceo (134 Sitze, 10/10 Umläufe, 96 %) | 1,41 Mio. $ | 0,91 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 97 %) | 1,01 Mio. $ | 0,33 Mio. $ | Narrowbody |
| 2010 | PEK–SVO | 5 796 | 5 856 | tu-204-300 (117 Sitze, 10/10 Umläufe, 98 %) | 1,35 Mio. $ | 0,98 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 97 %) | 1,03 Mio. $ | 0,35 Mio. $ | Narrowbody |
| 2010 | HND–BKK | 4 588 | 5 852 | 737-800 (137 Sitze, 12/12 Umläufe, 96 %) | 1,90 Mio. $ | 1,41 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 94 %) | 1,43 Mio. $ | 0,75 Mio. $ | Narrowbody |
| 2010 | ICN–BKK | 3 666 | 5 777 | tu-204-300 (117 Sitze, 15/15 Umläufe, 95 %) | 1,77 Mio. $ | 1,40 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 91 %) | 1,35 Mio. $ | 0,68 Mio. $ | Narrowbody |
| 2010 | LHR–JFK | 5 540 | 5 750 | tu-204-300 (117 Sitze, 10/10 Umläufe, 98 %) | 1,31 Mio. $ | 0,94 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 93 %) | 0,91 Mio. $ | 0,23 Mio. $ | Narrowbody |
| 2010 | CDG–ICN | 8 927 | 5 685 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 98 %) | 2,09 Mio. $ | 1,41 Mio. $ | Widebody |
| 2010 | LHR–ICN | 8 861 | 5 533 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 97 %) | 1,91 Mio. $ | 1,24 Mio. $ | Widebody |
| 2010 | SIN–PEK | 4 489 | 5 440 | tu-204-300 (117 Sitze, 12/12 Umläufe, 98 %) | 1,68 Mio. $ | 1,31 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 93 %) | 1,32 Mio. $ | 0,64 Mio. $ | Narrowbody |
| 2010 | ORD–CDG | 6 665 | 5 431 | a319ceo (114 Sitze, 8/8 Umläufe, 100 %) | 1,19 Mio. $ | 0,76 Mio. $ | il-96-300 (217 Sitze, 5/8 Umläufe, 96 %) | 1,10 Mio. $ | 0,42 Mio. $ | Narrowbody |
| 2010 | HND–CGK | 5 784 | 5 419 | 737-900er (160 Sitze, 10/10 Umläufe, 97 %) | 1,89 Mio. $ | 1,35 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 98 %) | 1,41 Mio. $ | 0,74 Mio. $ | Narrowbody |
| 2010 | LHR–ORD | 6 345 | 5 320 | a319ceo (114 Sitze, 9/9 Umläufe, 99 %) | 1,23 Mio. $ | 0,80 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 95 %) | 0,94 Mio. $ | 0,26 Mio. $ | Narrowbody |
| 2010 | LAX–PEK | 10 037 | 5 315 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,10 Mio. $ | 0,61 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 93 %) | 2,88 Mio. $ | 1,83 Mio. $ | Widebody |
| 2010 | LAX–JFK | 3 974 | 5 279 | tu-204-300 (117 Sitze, 14/14 Umläufe, 95 %) | 1,60 Mio. $ | 1,23 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 90 %) | 1,17 Mio. $ | 0,49 Mio. $ | Narrowbody |
| 2010 | DEL–PEK | 3 811 | 5 268 | tu-204-300 (117 Sitze, 14/14 Umläufe, 94 %) | 1,56 Mio. $ | 1,19 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 89 %) | 1,14 Mio. $ | 0,47 Mio. $ | Narrowbody |
| 2010 | LAX–CDG | 9 103 | 5 228 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,04 Mio. $ | 0,55 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 94 %) | 1,45 Mio. $ | 0,77 Mio. $ | Widebody |

Je Typ: neues Flugzeug mit Kabine nach 7.5, Strecke nach dem Anlauf, Preisniveau einer neuen KI-Strecke (7.6), beste Flugzahl aus `planFrequencies` (100 / 60 / 30 % der höchsten Umläufe), Planer-Hauptzahl je Monat (4.12); „nach Zins“ = `profitAfterCapital` (8 % je Jahr auf den Kaufpreis, E81). Bester Typ je Bauart nach „nach Zins“. Marktgröße = Fluggäste je Woche, beide Richtungen. Die Gesellschaft fliegt das Paar allein.

### Die 10 größten Paare über 7 500 km je Jahr

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | ORD–SVO | 7 974 | 7 278 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,65 Mio. $ | 1,50 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 91 %) | 6,90 Mio. $ | 5,61 Mio. $ | Widebody |
| 1990 | LHR–HND | 9 592 | 6 758 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,59 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 96 %) | 7,44 Mio. $ | 6,14 Mio. $ | Widebody |
| 1990 | LAX–SVO | 9 758 | 6 733 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,61 Mio. $ | 1,47 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 95 %) | 6,93 Mio. $ | 5,63 Mio. $ | Widebody |
| 1990 | HND–CDG | 9 707 | 6 457 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,60 Mio. $ | 1,45 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 96 %) | 7,45 Mio. $ | 6,15 Mio. $ | Widebody |
| 1990 | LHR–LAX | 8 760 | 6 401 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,76 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 90 %) | 6,06 Mio. $ | 4,77 Mio. $ | Widebody |
| 1990 | LAX–CDG | 9 103 | 6 102 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,53 Mio. $ | 1,39 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 90 %) | 6,26 Mio. $ | 4,96 Mio. $ | Widebody |
| 1990 | HND–LAX | 8 813 | 6 042 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,77 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 90 %) | 5,96 Mio. $ | 4,66 Mio. $ | Widebody |
| 1990 | HND–ORD | 10 124 | 5 968 | – | – | – | 747-400 (476 Sitze, 6/6 Umläufe, 94 %) | 6,95 Mio. $ | 5,66 Mio. $ | Widebody |
| 1990 | SFO–SVO | 9 434 | 5 690 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,58 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 89 %) | 5,98 Mio. $ | 4,69 Mio. $ | Widebody |
| 1990 | DFW–LHR | 7 628 | 5 590 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,84 Mio. $ | 1,69 Mio. $ | 767-300er (253 Sitze, 7/7 Umläufe, 99 %) | 4,08 Mio. $ | 3,29 Mio. $ | Widebody |
| 2000 | LHR–HND | 9 592 | 7 151 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,05 Mio. $ | 5,65 Mio. $ | Widebody |
| 2000 | LHR–LAX | 8 760 | 6 948 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 6,69 Mio. $ | 5,28 Mio. $ | Widebody |
| 2000 | HND–CDG | 9 707 | 6 916 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,15 Mio. $ | 5,74 Mio. $ | Widebody |
| 2000 | LAX–CDG | 9 103 | 6 708 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 7,01 Mio. $ | 5,60 Mio. $ | Widebody |
| 2000 | HND–LAX | 8 813 | 6 379 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 96 %) | 6,48 Mio. $ | 5,07 Mio. $ | Widebody |
| 2000 | LHR–ICN | 8 861 | 5 790 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,36 Mio. $ | 4,44 Mio. $ | Widebody |
| 2000 | LHR–SFO | 8 616 | 5 725 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,09 Mio. $ | 4,17 Mio. $ | Widebody |
| 2000 | HND–ORD | 10 124 | 5 677 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 97 %) | 6,49 Mio. $ | 5,08 Mio. $ | Widebody |
| 2000 | CDG–ICN | 8 927 | 5 637 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,42 Mio. $ | 4,49 Mio. $ | Widebody |
| 2000 | CDG–SFO | 8 962 | 5 508 | – | – | – | a330-200 (293 Sitze, 7/7 Umläufe, 98 %) | 5,35 Mio. $ | 4,43 Mio. $ | Widebody |
| 2010 | CDG–PEK | 8 190 | 7 211 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,19 Mio. $ | 0,70 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 94 %) | 3,36 Mio. $ | 2,32 Mio. $ | Widebody |
| 2010 | LHR–PEK | 8 154 | 6 960 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,18 Mio. $ | 0,69 Mio. $ | il-96-300 (217 Sitze, 7/7 Umläufe, 98 %) | 2,44 Mio. $ | 1,77 Mio. $ | Widebody |
| 2010 | HND–CDG | 9 707 | 6 084 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,09 Mio. $ | 0,60 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 93 %) | 2,94 Mio. $ | 1,90 Mio. $ | Widebody |
| 2010 | LHR–HND | 9 592 | 5 952 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 99 %) | 2,41 Mio. $ | 1,73 Mio. $ | Widebody |
| 2010 | CDG–ICN | 8 927 | 5 685 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 98 %) | 2,09 Mio. $ | 1,41 Mio. $ | Widebody |
| 2010 | LHR–ICN | 8 861 | 5 533 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 97 %) | 1,91 Mio. $ | 1,24 Mio. $ | Widebody |
| 2010 | LAX–PEK | 10 037 | 5 315 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,10 Mio. $ | 0,61 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 93 %) | 2,88 Mio. $ | 1,83 Mio. $ | Widebody |
| 2010 | LAX–CDG | 9 103 | 5 228 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,04 Mio. $ | 0,55 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 94 %) | 1,45 Mio. $ | 0,77 Mio. $ | Widebody |
| 2010 | CDG–BKK | 9 448 | 5 106 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | il-96-300 (217 Sitze, 4/6 Umläufe, 99 %) | 1,42 Mio. $ | 0,75 Mio. $ | Widebody |
| 2010 | LHR–LAX | 8 760 | 5 067 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,25 Mio. $ | 0,76 Mio. $ | il-96-300 (217 Sitze, 4/7 Umläufe, 98 %) | 1,29 Mio. $ | 0,62 Mio. $ | Narrowbody |

Wie oben. „–“ = kein lieferbarer Typ der Bauart mit dieser Reichweite.

### Kosten je Sitz und Woche: LHR–JFK 2000, ein Flugzeug allein, Marktpreis

| Typ | Bauart | Umläufe | Sitze je Woche | Fluggäste | Treibstoff je Sitz | Besatzung + Landung je Sitz | Flugzeug-Anteil je Sitz | feste Kosten je Sitz | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|---|---|
| 737-700 | Narrowbody | 5/10 | 1 080 | 1 080 | 159 | 78 | 71 | 311 | 0,13 Mio. $ |
| 737-700 | Narrowbody | 10/10 | 2 160 | 2 160 | 159 | 78 | 35 | 275 | 0,34 Mio. $ |
| a321ceo | Narrowbody | 5/10 | 1 600 | 1 600 | 153 | 71 | 69 | 295 | 0,22 Mio. $ |
| a321ceo | Narrowbody | 10/10 | 3 200 | 3 189 | 153 | 71 | 34 | 261 | 0,53 Mio. $ |
| 767-300er | Widebody | 5/10 | 2 530 | 2 530 | 170 | 45 | 69 | 286 | 0,37 Mio. $ |
| 767-300er | Widebody | 10/10 | 5 060 | 4 875 | 170 | 45 | 34 | 251 | 0,71 Mio. $ |
| a330-300 | Widebody | 5/10 | 3 180 | 3 150 | 159 | 43 | 61 | 265 | 0,49 Mio. $ |
| a330-300 | Widebody | 10/10 | 6 360 | 5 843 | 159 | 43 | 31 | 234 | 0,77 Mio. $ |
| 777-200er | Widebody | 5/10 | 3 180 | 3 153 | 154 | 43 | 73 | 271 | 0,48 Mio. $ |
| 777-200er | Widebody | 10/10 | 6 360 | 5 865 | 154 | 43 | 37 | 234 | 0,79 Mio. $ |

Treibstoff je Sitz hängt nur an der Effizienz des Typs (5.3, `fuelLitresPerSeat100km`), nicht an der Größe. Der Flugzeug-Anteil (Unterhalt + Abschreibung, 5.9) ist je Woche fest; fliegt ein Widebody nur die Hälfte der Umläufe, trägt jeder Sitz das Doppelte.

## Abschnitt 8: Monatsabschluss, Ereignisse, Flottenmarkt

### Preis-Absicherung je Ölkrise (in Treibstoff-Rechnungen des Monats vor dem Beginn)

| Ereignis | Dauer | Treibstoff im Mittel (vor Beginn = 1) | Preis | Ersparnis | Ersparnis ÷ Preis |
|---|---|---|---|---|---|
| 1973 Oil Crisis | 18 Monate | 1,92 | 6,30 | 16,62 | 2,64 |
| 1979 Energy Crisis | 24 Monate | 1,50 | 8,40 | 11,95 | 1,42 |
| Gulf War Oil Shock | 12 Monate | 1,37 | 4,20 | 4,42 | 1,05 |

Gleiche Menge Treibstoff wie vor der Krise; `fuelTable` mit den Krisen-Ausschlägen (E61). Die Absicherung friert den Tabellenpreis des Monats vor dem Beginn ein (8.5).

### Rückgewinnung: A320ceo FRA–MAD, Flag-Ausstattung, allein, bester Preis des Monats vor der Krise

| Ereignis | Marktgröße | f / r / Dauer | Fluggäste mit ÷ ohne Antwort | Ergebnis-Verlust ohne Antwort | davon zurückgeholt | Preis | Mehr-Ergebnis ÷ Preis |
|---|---|---|---|---|---|---|---|
| Aviation Downturn | × 1,00 | 0,65 / 0,40 / 12 | 1,171 | 12,77 Mio. $ | 28 % | 1,38 Mio. $ | 2,62 |
| Aviation Downturn | × 0,25 | 0,65 / 0,40 / 12 | 1,088 | 5,60 Mio. $ | 15 % | 0,63 Mio. $ | 1,32 |
| Global Financial Crisis | × 1,00 | 0,75 / 0,33 / 24 | 1,088 | 23,93 Mio. $ | 19 % | 1,75 Mio. $ | 2,53 |
| Global Financial Crisis | × 0,25 | 0,75 / 0,33 / 24 | 1,046 | 11,12 Mio. $ | 9 % | 0,79 Mio. $ | 1,28 |
| Global Pandemic | × 1,00 | 0,20 / 0,35 / 24 | 1,847 | 58,39 Mio. $ | 22 % | 6,23 Mio. $ | 2,10 |
| Global Pandemic | × 0,25 | 0,20 / 0,35 / 24 | 1,284 | 21,29 Mio. $ | 9 % | 2,58 Mio. $ | 0,72 |

Ergebnis = Strecken-Ergebnis (5.9) × `WEEKS_PER_MONTH`, Summe über die Dauer. „× 0,25“ verkleinert die Marktgröße wie ein kleineres `DEMAND_SCALE` (Richtung E67). Volle Flugzeuge verlieren bei kleinerer Nachfrage zuerst nur „Knappheit“; die Antwort holt dann wenig Fluggäste zurück.

### Charter oder streichen je betroffenem Flug (Strecken beim besten Preis)

| Strecke | Erlös je Flug | Kosten je Fluggast (Summe) | eigene Flugkosten | Charter-Gebühr | Vorteil Charter | Strecke mit Gewinn |
|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 9 432 $ | 1 379 $ | 2 604 $ | 3 907 $ | 4 147 $ | ja |
| 707-320B FRA–JFK 1965 | 64 346 $ | 5 864 $ | 36 518 $ | 54 777 $ | 3 705 $ | ja |
| 727-200 FRA–MAD 1975 | 31 952 $ | 5 038 $ | 15 595 $ | 23 392 $ | 3 521 $ | ja |
| ATR 72-200 HAM–NUE 1990 | 6 843 $ | 1 574 $ | 2 441 $ | 3 661 $ | 1 608 $ | ja |
| A320ceo FRA–MAD 1990 | 40 181 $ | 6 062 $ | 9 643 $ | 14 464 $ | 19 655 $ | ja |
| A320ceo FRA–MAD 1990 (LCC) | 30 108 $ | 3 191 $ | 9 652 $ | 14 478 $ | 12 439 $ | ja |
| A320ceo ATL–ORD 1990 | 41 445 $ | 6 175 $ | 8 343 $ | 12 515 $ | 22 756 $ | ja |
| A330-300 FRA–JFK 1995 | 140 481 $ | 16 271 $ | 48 208 $ | 72 312 $ | 51 897 $ | ja |
| A320ceo FRA–MAD 2019 | 61 332 $ | 8 802 $ | 15 961 $ | 23 942 $ | 28 588 $ | ja |
| A330-300 FRA–JFK 2019 | 221 485 $ | 24 986 $ | 93 392 $ | 140 088 $ | 56 411 $ | ja |
| 787-9 FRA–SIN 2019 | 304 530 $ | 27 782 $ | 122 393 $ | 183 589 $ | 93 158 $ | ja |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 1 929 $ | 534 $ | 2 441 $ | 3 661 $ | −2 266 $ | nein |
| A320ceo FRA–MAD 1990 × 0,25 | 15 865 $ | 3 289 $ | 9 643 $ | 14 464 $ | −1 888 $ | nein |
| A330-300 FRA–JFK 1995 × 0,25 | 36 883 $ | 4 682 $ | 48 208 $ | 72 312 $ | −40 111 $ | nein |

Vorteil = Erlös − Kosten je Fluggast − Charter-Gebühr (`charterAdvantage`, 8.9); die eigenen Flugkosten entfallen in beiden Fällen. Dazu kein Ruf-Abzug mit Charter (6.2).

### Beträge der Störungs-Frage gegen die Rechnung (Flughafen-Streik am Start-Flughafen, Monat, Strecken beim besten Preis)

| Strecke | Auslastung | Erlös im Mittel × Anteil | Erlösverlust (Frage) | Erlösverlust (Rechnung) | Vorteil Charter (Frage) | Vorteil Charter (Rechnung) | Gebühr Frage / gebucht |
|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 100 % | 344 510 $ | 344 510 $ | 344 510 $ (100 %) | 151 454 $ | 151 454 $ | 142 686 $ / 142 686 $ |
| 707-320B FRA–JFK 1965 | 100 % | 2 014 486 $ | 2 013 867 $ | 2 013 867 $ (100 %) | 115 424 $ | 115 424 $ | 1 714 919 $ / 1 714 919 $ |
| 727-200 FRA–MAD 1975 | 96 % | 1 167 056 $ | 1 090 718 $ | 1 090 718 $ (93 %) | 83 150 $ | 83 150 $ | 854 408 $ / 854 408 $ |
| ATR 72-200 HAM–NUE 1990 | 100 % | 249 944 $ | 249 894 $ | 249 894 $ (100 %) | 58 700 $ | 58 700 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 | 97 % | 1 467 616 $ | 1 380 481 $ | 1 380 481 $ (94 %) | 666 499 $ | 666 499 $ | 528 307 $ / 528 307 $ |
| A320ceo FRA–MAD 1990 (LCC) | 100 % | 1 099 683 $ | 1 099 683 $ | 1 099 683 $ (100 %) | 454 317 $ | 454 317 $ | 528 826 $ / 528 826 $ |
| A320ceo ATL–ORD 1990 | 97 % | 1 513 779 $ | 1 441 719 $ | 1 441 719 $ (95 %) | 792 098 $ | 792 098 $ | 457 107 $ / 457 107 $ |
| A330-300 FRA–JFK 1995 | 93 % | 5 131 068 $ | 4 473 907 $ | 4 473 907 $ (87 %) | 1 355 577 $ | 1 355 577 $ | 2 641 213 $ / 2 641 213 $ |
| A320ceo FRA–MAD 2019 | 97 % | 2 240 149 $ | 2 130 924 $ | 2 130 924 $ (95 %) | 979 765 $ | 979 765 $ | 874 473 $ / 874 473 $ |
| A330-300 FRA–JFK 2019 | 98 % | 4 622 704 $ | 4 438 990 $ | 4 438 990 $ (96 %) | 1 036 633 $ | 1 036 633 $ | 2 923 834 $ / 2 923 834 $ |
| 787-9 FRA–SIN 2019 | 99 % | 6 355 973 $ | 6 226 764 $ | 6 226 764 $ (98 %) | 1 836 597 $ | 1 836 597 $ | 3 831 772 $ / 3 831 772 $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 34 % | 207 714 $ | 207 714 $ | 207 714 $ (100 %) | 16 491 $ | 16 491 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 × 0,25 | 69 % | 968 530 $ | 881 407 $ | 881 407 $ (91 %) | 167 419 $ | 167 419 $ | 528 307 $ / 528 307 $ |
| A330-300 FRA–JFK 1995 × 0,25 | 30 % | 4 614 339 $ | 3 957 177 $ | 3 957 177 $ (86 %) | 838 848 $ | 838 848 $ | 2 641 213 $ / 2 641 213 $ |

Frage: `charterQuestionFigures` auf dem Monat mit der Störung (E76). Rechnung: derselbe Monat ohne Störung, gestrichen und gechartert (`monthOperations`), Vorteil = Monatsergebnis mit Charter − mit Streichen. „Erlös im Mittel × Anteil“ ist die alte Schätzung aus 5.2e: Beim Streichen verteilt das Modell die Fluggäste auf die übrigen Sitze (8.9), der echte Verlust ist darum kleiner, je mehr Sitze frei sind.

### Händler-Spanne: A320ceo (Flag-Kabine), gebaut Mai 1990

| Alter | Zelle / Kabine | Wert | Gebrauchtpreis | Verkaufserlös | mit größter Forschung | zurück nach Kauf und Verkauf | Verlust in Monatsergebnissen |
|---|---|---|---|---|---|---|---|
| 0 Jahre | 100 / 100 | 57,64 Mio. $ | 60,52 Mio. $ | 48,99 Mio. $ | 50,22 Mio. $ | 83,0 % | 10,09 |
| 5 Jahre | 87 / 78 | 43,98 Mio. $ | 46,18 Mio. $ | 37,39 Mio. $ | 38,32 Mio. $ | 83,0 % | 7,26 |
| 10 Jahre | 76 / 64 | 32,84 Mio. $ | 34,49 Mio. $ | 27,92 Mio. $ | 28,61 Mio. $ | 83,0 % | 5,10 |
| 20 Jahre | 54 / 36 | 14,46 Mio. $ | 15,19 Mio. $ | 12,29 Mio. $ | 12,60 Mio. $ | 83,0 % | 1,99 |

Zustand wie im Gebrauchtmarkt (8.11, ohne Streuung). Monatsergebnis: A320ceo FRA–MAD 1990 beim besten Preis × `WEEKS_PER_MONTH`, mit dem Kostenindex auf das Verkaufsjahr gerechnet (Fund 1: sehr hoch).

### Vorbestellung (Bestellung 12 Monate vor der Erstauslieferung; Anteile des Werts bei Lieferung)

| Stück | Rabatt | Preis | Lieferung nach | sofort verkauft (größte Forschung) | Rabatt ÷ Anzahlung je Jahr |
|---|---|---|---|---|---|
| 1 | 5 % | 95 % | 13 Monaten | −7,9 % | 23 % |
| 3 | 7 % | 93 % | 14 Monaten | −5,9 % | 30 % |
| 6 | 10 % | 90 % | 15 Monaten | −2,9 % | 40 % |
| 12 | 12 % | 88 % | 17 Monaten | −0,9 % | 42 % |

Anzahlung 20 % des geschätzten Preises bei der Bestellung (8.12). „Rabatt ÷ Anzahlung je Jahr“ zeigt, wie viel die gebundene Anzahlung im Jahr einbringt (ohne Teuerung zwischen Bestellung und Lieferung).

### Grundüberholung (erste Überholung, +50 Zellen-Punkte)

| Fall | Wertgewinn | 4 % des Neupreises | Preis mit Hangar | Preis fremde Werft | Defekt-Chance vorher / nachher | weniger gestrichene Flüge je Jahr |
|---|---|---|---|---|---|---|
| A320ceo, gebaut 1990, in 2010 (Zelle 50, Kabine 40) | 4,67 Mio. $ | 2,92 Mio. $ | 4,67 Mio. $ | 5,84 Mio. $ | 2,33 % / 1,00 % | 8,00 % |
| A320ceo, gebaut 1990, in 1995 (Zelle 85, Kabine 80) | 3,27 Mio. $ | 2,44 Mio. $ | 3,27 Mio. $ | 4,08 Mio. $ | 0,90 % / 0,50 % | 2,40 % |
| 747-400, gebaut 1995, in 2015 (Zelle 50, Kabine 40) | 16,75 Mio. $ | 10,45 Mio. $ | 16,75 Mio. $ | 20,93 Mio. $ | 2,33 % / 1,00 % | 8,00 % |
| CRJ200, gebaut 1995, in 2015 (Zelle 50, Kabine 40) | 1,86 Mio. $ | 1,16 Mio. $ | 1,86 Mio. $ | 2,32 Mio. $ | 2,33 % / 1,00 % | 8,00 % |
| A320ceo, gebaut 1990, in 2000 (Zelle 70, Kabine 60) | 5,29 Mio. $ | 2,59 Mio. $ | 5,29 Mio. $ | 6,61 Mio. $ | 1,47 % / 0,67 % | 4,80 % |

Ohne Hangar (Defekt-Chance). „Weniger gestrichene Flüge je Jahr“ = Anteil der Flüge des Flugzeugs im Jahr (Defekt streicht 50 % eines Monats). Mit Hangar ist der Netto-Preis (Preis − Wertgewinn) 0, sobald der Wertgewinn den Mindestpreis übersteigt.

### Kabinen-Umbau auf dieselbe Kabine (Flag), Strecke beim besten Preis

| Strecke | Sitze | Kabine | Umbau-Lohn | Preis | Monatsergebnis der Strecke | Preis ÷ Monatsergebnis |
|---|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990 | 134 | 0,20 Mio. $ | 0,19 Mio. $ | 0,39 Mio. $ | 1,14 Mio. $ | 0,3 |
| A320ceo FRA–MAD 2019 | 134 | 1,02 Mio. $ | 0,27 Mio. $ | 1,29 Mio. $ | 1,73 Mio. $ | 0,7 |
| A330-300 FRA–JFK 2019 | 318 | 1,71 Mio. $ | 0,65 Mio. $ | 2,36 Mio. $ | 2,51 Mio. $ | 0,9 |
| ATR 72-200 HAM–NUE 1990 | 69 | 0,04 Mio. $ | 0,10 Mio. $ | 0,14 Mio. $ | 0,07 Mio. $ | 2,0 |

`refitPrice` (8.13): `atCost(cabinListPrice)` + `refitLabour`. Der Lohn war früher Typ-Kapazität × 1 000 $ ohne Kostenindex. Wie oft umgebaut wird, zeigt der Verschleiß (B8.7, Kabine 50 nach etwa 6–7 Jahren auf Langstrecke).

### Verschleiß je Strecke (Flugplan der typischen Strecken, nichts gestrichen)

| Strecke | Blockstunden je Monat | Kabine je Jahr | Zelle je Jahr | Jahre bis Kabine 50 | Jahre bis Zelle 50 |
|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 45 | 1,8 | 1,6 | 27,1 | 31,0 |
| 707-320B FRA–JFK 1965 | 380 | 6,7 | 4,7 | 7,5 | 10,7 |
| 727-200 FRA–MAD 1975 | 110 | 2,8 | 2,2 | 17,9 | 22,7 |
| ATR 72-200 HAM–NUE 1990 | 63 | 2,1 | 1,8 | 23,7 | 28,2 |
| A320ceo FRA–MAD 1990 | 117 | 2,9 | 2,3 | 17,3 | 22,1 |
| A320ceo FRA–MAD 1990 (LCC) | 117 | 2,9 | 2,3 | 17,3 | 22,1 |
| A320ceo ATL–ORD 1990 | 84 | 2,4 | 2,0 | 20,8 | 25,5 |
| A330-300 FRA–JFK 1995 | 452 | 7,7 | 5,3 | 6,5 | 9,4 |
| A320ceo FRA–MAD 2019 | 117 | 2,9 | 2,3 | 17,3 | 22,1 |
| A330-300 FRA–JFK 2019 | 258 | 4,9 | 3,6 | 10,2 | 14,1 |
| 787-9 FRA–SIN 2019 | 410 | 7,1 | 4,9 | 7,0 | 10,1 |

Gebrauchtmarkt zum Vergleich: Zelle −2,2, Kabine −2,8 Punkte je Jahr (8.11).

### Kreditlinie für ein neues Flugzeug je Strecke

| Strecke | Kreditgrenze | feste Kosten je Monat | Grenze in Monaten fester Kosten | Kosten je Monat | Monatsergebnis | Zins bei voller Nutzung |
|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 4,89 Mio. $ | 0,23 Mio. $ | 21,3 | 0,31 Mio. $ | 0,26 Mio. $ | 0,033 Mio. $ |
| 707-320B FRA–JFK 1965 | 10,67 Mio. $ | 2,04 Mio. $ | 5,2 | 2,35 Mio. $ | 1,01 Mio. $ | 0,071 Mio. $ |
| 727-200 FRA–MAD 1975 | 9,62 Mio. $ | 1,08 Mio. $ | 8,9 | 1,38 Mio. $ | 0,56 Mio. $ | 0,064 Mio. $ |
| ATR 72-200 HAM–NUE 1990 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,34 Mio. $ | 0,07 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,30 Mio. $ | 1,14 Mio. $ | 0,192 Mio. $ |
| A320ceo FRA–MAD 1990 (LCC) | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,13 Mio. $ | 0,70 Mio. $ | 0,192 Mio. $ |
| A320ceo ATL–ORD 1990 | 28,82 Mio. $ | 0,86 Mio. $ | 33,7 | 1,23 Mio. $ | 1,29 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 | 70,44 Mio. $ | 3,75 Mio. $ | 18,8 | 4,74 Mio. $ | 3,81 Mio. $ | 0,470 Mio. $ |
| A320ceo FRA–MAD 2019 | 41,10 Mio. $ | 1,47 Mio. $ | 28,0 | 2,00 Mio. $ | 1,73 Mio. $ | 0,274 Mio. $ |
| A330-300 FRA–JFK 2019 | 94,21 Mio. $ | 4,33 Mio. $ | 21,8 | 5,20 Mio. $ | 2,51 Mio. $ | 0,628 Mio. $ |
| 787-9 FRA–SIN 2019 | 132,74 Mio. $ | 5,77 Mio. $ | 23,0 | 6,74 Mio. $ | 3,85 Mio. $ | 0,885 Mio. $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,28 Mio. $ | −0,16 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 × 0,25 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,14 Mio. $ | −0,17 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 × 0,25 | 70,44 Mio. $ | 3,75 Mio. $ | 18,8 | 4,04 Mio. $ | −1,79 Mio. $ | 0,470 Mio. $ |

Feste Kosten = Treibstoff, Besatzung, Landung, Slot- und Flugzeug-Anteil (5.9); ohne Kosten der Gesellschaft. Kauf nur aus Guthaben; die Kreditlinie deckt laufende Verluste (8.14).

### Szenario „Oil Shock“ (LHR, Okt. 1973 bis Dez. 1976): Ruf am Stichtag je Ausstattung (Start 50)

| Ausstattung | Airline satisfaction | Ruf am Stichtag | Ziel 55 erreicht |
|---|---|---|---|
| LCC-Kabine, Zustand 60 | 58,8 | 29,4 | nein |
| Flag-Kabine, Zustand 60 (ohne Umbau) | 102,7 | 52,3 | nein |
| Flag-Kabine nach Umbau (Zustand 90) | 109,8 | 58,2 | ja |
| Boutique-Kabine nach Umbau (Zustand 90) | 109,0 | 57,5 | ja |

Trident 2E LHR–CDG und 707-320B LHR–JFK, je 14 Abflüge, Zelle 60, Service nach der Persönlichkeit; Satisfaction nach Fluggästen gemittelt, ohne Ausfälle. Ruf nach `reputationChange` Monat für Monat (6.5).

### Dollar-Beträge der Szenarien als Wert von 1960 (für Phase 5.1, E6)

| Szenario | Ziel / Schwelle | heute | Wert 1960 (÷ Kostenindex des Starts) |
|---|---|---|---|
| Jet Age | Capital of $100M | 100 000 000 $ | 100 000 000 $ |
| Jet Age | Capital below the negative credit line at three month-ends in a row means bankruptcy | −Kreditlinie | −Kreditlinie |
| Jet Age | Startkasse | 12 000 000 $ | 12 000 000 $ |
| Oil Shock | Capital must never be below $0 at a month-end | 0 $ | 0 $ |
| Oil Shock | Startkasse | 8 000 000 $ | 6 789 815 $ |
| Deregulation | An operating profit in that same month | 0 $ | 0 $ |
| Deregulation | Capital below the negative credit line at three month-ends in a row means bankruptcy | −Kreditlinie | −Kreditlinie |
| Deregulation | Startkasse | 40 000 000 $ | 32 270 877 $ |
| Hub Builder | Capital below the negative credit line at three month-ends in a row means bankruptcy | −Kreditlinie | −Kreditlinie |
| Hub Builder | Startkasse | 80 000 000 $ | 55 933 837 $ |

Nach 8.15 stehen Dollar-Ziele als Wert von 1960 in den Daten und laufen über `atCost` des Prüfmonats. Die Pleite-Schwelle ist −`creditLimit` (8.15); „Oil Shock“ hat die eigene Schwelle 0 $ (E77).

