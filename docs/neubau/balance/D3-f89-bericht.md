# Balance-Bericht

Erzeugt mit `npm run balance` aus `src/balance/` (Pakete 3.9a–3.9c; Langläufe mit `--long`). Alle Zahlen kommen aus den Funktionen in `src/model/`
mit den Startwerten aus `src/model/constants.ts`; das Skript ändert keine Konstante. Bewertung und Empfehlungen:
`docs/neubau/BALANCE.md`.

Urteile: **ok** = Regel der Spezifikation gilt; **Abweichung** = Regel gilt nicht (Entscheidung nötig);
**Info** = keine feste Grenze in der Spezifikation, Wert zur Bewertung.

Prüfregeln: 21 ok · 0 Abweichung · 33 Info.

## Übersicht der Prüfregeln

| Nr. | Spez. | Regel | Wert | Urteil |
|---|---|---|---|---|
| B1.1 | 1.3, 5.2 | Treibstoff (Tabelle) gegenüber Kostenindex: wie stark verschiebt sich das Verhältnis 1960 → 2020 (Grundlage der Langstrecken-Marge, 5.18) | Treibstoff ÷ Kostenindex 2020 = 1,24 (1960 = 1) | Info |
| B2.1 | 2.10 | `satisfactionFactor(50)` liegt bei 0,75 (± 0,05) | 0,750 | ok |
| B2.2 | 2.6.2, 7.4 | Stärke der Service-Abzüge: Satisfaction der LCC (kein Service, dichte Kabine) auf Kurzstrecke; Ausgleich über Preis-Lage 0,95 (7.4) | LCC Economy FRA–CDG: 89 → Faktor 0,95 | Info |
| B3.1 | 3.3 | Die Summe der Marktgrößen aller Paare wächst 1960 → 2019 um × 2,5 (± 10 %, E64) | Summe 2,52, Mittel der Verhältnisse 3,02, Median 2,51 (115 440 Paare) | ok |
| B3.2 | 3.7 | Premium-Anteil schwankt über alle Paare: 5 %- bis 95 %-Wert mindestens 3 Prozentpunkte auseinander (1990) | 6,8 % … 11,1 % (4,3 Pp.) | ok |
| B3.3 | 3.4 | Entfernungs-Faktor kurz : lang (45 min : 20 h); Startwert 5,2 | 2,68 | Info |
| B3.4 | 3.9.3 | Stärke von `FLIGHT_TIME_EXP`: Anziehung Turboprop ÷ Jet bei sonst gleichem Angebot | FRA–CDG 0,72, FRA–MAD 0,65 | Info |
| B3.5 | 1.8 | Stärke der Schwierigkeit: Fluggäste des Spielers auf Hard gegenüber Normal (gegen einen gleichen Rivalen) | −5,7 % | Info |
| B4.1 | 3.6, 4.10 | Marktgröße gegenüber einem Flugzeug: Strecken, die selbst beim höchsten Preisniveau voll bleiben (Hinweis aus 3.8b) | keine | Info |
| B4.2 | 4.10, 7.6, E103 | Wechselseitige beste Antworten zweier gleicher Gesellschaften laufen nicht gegen 0: tiefster Preis ≥ 90 % der Gewinnschwelle voller Maschine; mit einem Flugzeug je Gesellschaft (erster Fall) auch Ergebnis > 0. Ein Verlust mit mehr Sitzen, als der Markt füllt, kommt aus der Überkapazität, nicht aus dem Unterbieten (Paket 3.9d, E103) | 14 Abflüge: tiefster Preis Y 1,43, Schwelle 0,87 (165 %), Ergebnis 68 681 $; 28 Abflüge: tiefster Preis Y 0,71, Schwelle 0,76 (93 %), Ergebnis −85 058 $ | ok |
| B4.3 | 7.6 | Enden die besten Antworten in einem festen Punkt? Nicht verlangt (7.6, E65); verlangt ist B4.2 | 14 Abflüge: Zyklus; 28 Abflüge: Zyklus | Info |
| B4.4 | 4.10 | Bester Preis gegen einen gleichen Rivalen beim Marktpreis (Hinweis 4.10: 70 % des Marktpreises) | 14 Abflüge: 1,43; 28 Abflüge: 0,87 | Info |
| B4.5 | 3.6, 4.10 | Empfindlichkeit: bester Preis Y eines A320ceo allein auf FRA–MAD 1990 bei kleinerer Marktgröße | × 1,00: 1,64; × 0,50: 1,16; × 0,25: 1,03; × 0,10: 1,03 | Info |
| B5.1 | 5.5 | Landegebühr auf Kurzstrecke 26–40 % der Kosten (Hinweis 5.5 / 5.18) | Caravelle III FRA–CDG 1962: 31 %; ATR 72-200 HAM–NUE 1990: 28 % | ok |
| B5.2 | 5.18 | Marge beim besten Preis: Langstrecke gegenüber Kurz- und Mittelstrecke (Hinweis 5.18: Langstrecke sehr einträglich) | Lang Ø 23 %, kurz/mittel Ø 32 % | Info |
| B5.3 | 5.6 | Check-in und Abfertigung ohne Bodenpersonal-Aufschlag: Anteil an den Kosten (heute mit Bodenpersonal 2–4 % mehr) | 3 % … 16 % | Info |
| B5.4 | 5.13, E54 | Listenpreise und Abschreibung: Jahre, bis eine Strecke den Kaufpreis eines neuen Flugzeugs einspielt | 5,2 … 20,9 Jahre | Info |
| B5.5 | E7 | Eine gut geführte Strecke jeder Länge bringt in jedem Jahrzehnt Gewinn (alle Fälle beim besten Preis) | 11 von 11 mit Gewinn | ok |
| B5.6 | 7.4, E45 | Vorschau „ähnlicher Erfolg“: Ergebnis LCC ÷ Flag mit demselben Flugzeug allein auf derselben Strecke | A320ceo FRA–MAD 1990: 0,49 (Marge 26 % gegen 36 %) | Info |
| B6.1 | 6.1, E36 | Ruf-Ziel bei üblicher Satisfaction um 50: Median der Ruf-Ziele aller Ausstattungen (5 Persönlichkeiten × 2 Strecken, ohne Forschung) in 40 … 60 | Median 46,1; Flag: A320ceo FRA–MAD 1990 Satisfaction 123 → 69,5, A330-300 FRA–JFK 1995 Satisfaction 105 → 53,8 | ok |
| B6.2 | 6.1 | Steigungen 0,5 (unter 100) und 0,83 (über 100): Spanne der Ruf-Ziele aller Ausstattungen, mit und ohne Forschung | 24,1 … 76,2 (Satisfaction 48 … 131) | Info |
| B6.3 | 6.2, 8.6 | `CANCELLED_REPUTATION_WEIGHT` = 100: erwarteter Abzug im Ruf-Ziel und Wirkung eines Defekts (ohne Charter) | erwartet Alter 0: 0,70, Alter 10: 1,16, Alter 20: 1,62 Punkte; ein Defekt bei 1 Flugzeug: Ruf −7,5 im Monat, 13 Monate bis < 1 Punkt; bei 10 Flugzeugen −0,75 | Info |
| B6.4 | 6.3, E37 | Werbung hebt den Ruf im Gleichgewicht um höchstens 3 Punkte und klingt nach dem Ende ab | größter Anstieg 3,00 (alle drei Kampagnen); Nachfrage-Wirkung über den Ruf 0,6 % | ok |
| B6.9 | 3.9.5, 5.14 | Werbung: Kosten je Monat ÷ Mehr-Ergebnis je Strecke (Strecken, ab denen eine Kampagne sich trägt) | 1990 local 13,4; 1990 national 18,4; 1990 global 26,5; 2019 local 11,8; 2019 national 19,8; 2019 global 39,5 | Info |
| B6.5 | 6.7, E36 | Ruf-Schwellen der Ränge: Rang 9 (Ruf 65) ist mit der besten Ausstattung und Forschung erreichbar; Rang 5 (Ruf 50) mit üblicher (Flag) Ausstattung | bestes Ziel 76,2 (ohne Forschung 69,5); Flag ohne Forschung ≥ 53,8 | ok |
| B6.6 | 6.10 | Ruf-Meilensteine 60 / 70 / 80: Satisfaction, die sie brauchen, und ob eine Ausstattung sie erreicht | 60 → Satisfaction 112, 70 → Satisfaction 124, 80 → Satisfaction 136; Gold mit keiner KI-Ausstattung erreichbar; beste Spieler-Ausstattung: Flag FRA–MAD 81,7 (mit Werbung 84,7), Boutique FRA–MAD 77,9 (mit Werbung 80,9), Flag FRA–JFK 65,2 (mit Werbung 68,2), Boutique FRA–JFK 59,0 (mit Werbung 62,0) | Info |
| B6.7 | 6.8 | Eine Gesellschaft, die die Bedingungen eines Rangs gerade erfüllt, bezahlt die Klassen-Forschung dieses Rangs aus höchstens 12 Monatsergebnissen | Rang 1: 9,2 (bei Marge 10 %: 29,3); Rang 2: 11,7 (bei Marge 10 %: 33,9); Rang 4: 4,1 (bei Marge 10 %: 9,4); Rang 5: 9,1 (bei Marge 10 %: 16,6) | ok |
| B6.8 | 6.11, E58 | Ziel-, Prämien- und Straf-Anteile: Prämie in Monatsergebnissen und nötige Chance, damit das hohe Ziel mehr bringt als das sichere | Prämie sicher / hoch = 0,24 / 0,60 Monatsergebnisse (ohne Mindestbetrag); hohes Ziel lohnt ab Chance 60 % … 60 %; Mindestprämie bindet bei 2 von 6 Beispielen (gestaffelt nach Art, E83: auch dann zahlt das hohe Ziel mehr) | Info |
| B7.13 | 7.11, E81, E84, E85 | Größte Langstrecken-Paare (über 3 500 km, beide Flughäfen ab Größe 3): bringt der beste Widebody der KI mehr als der beste Narrowbody? | 0 von 60 Paaren vor Kapitalkosten (Planer-Zahl), 0 von 60 nach Kapitalkosten (1990, 2000, 2010, je 20 Paare) | Info |
| B7.14 | 7.11, E81, E84, E85 | Paare über 7 500 km (fast nur Widebodies haben die Reichweite): Widebody vorn und nach Kapitalkosten mit Gewinn | Widebody vorn auf 11 von 30 Paaren, davon mit Gewinn nach Kapitalkosten 11 | Info |
| B8.1 | 8.5 | Preis-Absicherung (`HEDGE_PRICE_SHARE` = 0,35): Ersparnis ÷ Preis je Ölkrise | 1973 Oil Crisis: 2,64; 1979 Energy Crisis: 1,42; Gulf War Oil Shock: 1,05 | Info |
| B8.2 | 8.5 | Rückgewinnung (`RECOVERY_PRICE_SHARE` = 0,25): Mehr-Ergebnis ÷ Preis (A320ceo FRA–MAD allein, Preis vor der Krise fest) | Downturn × 1,00: 2,13; Downturn × 0,25: 1,09; Financial × 1,00: 2,16; Financial × 0,25: 1,12; Pandemic × 1,00: 1,68; Pandemic × 0,25: 0,71 | Info |
| B8.3 | 8.9, E32 | `CHARTER_MARKUP`: Charter lohnt gegenüber Streichen auf jeder Strecke mit Gewinn (Vorteil je Flug > 0) | 11 von 11 Strecken mit Gewinn; kleinster Vorteil 1 888 $ je Flug (Gebühr ÷ Erlös je Flug 37 % … 375 %) | ok |
| B8.10 | 8.9, E76, R2 | Beträge der Störungs-Frage (`charterQuestionFigures`, Flughafen-Streik 60 %) = Rechnung des Monats mit und ohne Charter (Erlösverlust, Gebühr, Vorteil) | 14 von 14 Fällen gleich; echter Erlösverlust ÷ Erlös im Mittel 45 % … 100 % (so weit lag die Schätzung bis 5.3a daneben) | ok |
| B8.4 | 8.11, E30 | Händler-Spanne −15 % / +5 %: Gebraucht kaufen und sofort verkaufen bringt höchstens 83,0 % zurück; Verlust in Monatsergebnissen einer Strecke | höchstens 83,0 %; Verlust Kauf→Verkauf Alter 0: 16,20, Alter 5: 11,65, Alter 10: 8,20, Alter 20: 3,20 Monatsergebnisse (A320ceo FRA–MAD) | ok |
| B8.5 | 8.12, E30 | Vorbestell-Rabatt höchstens 12 % < 12,9 % (Vorbestellen und sofort verkaufen bringt nie Gewinn); Rabatt als Ertrag der Anzahlung | Rabatt 5 … 12 %; sofort verkauft −0,9 % des Werts; Rabatt ÷ Anzahlung je Jahr 23 % … 42 % (Kreditzins 8 %) | ok |
| B8.6 | 8.13, E31 | Überholung (`OVERHAUL_PRICE_SHARE` = 0,04): Preis ≥ Wertgewinn; wo bindet der Mindestpreis? | Preis ≥ Wertgewinn in 5 von 5 Fällen; Mindestpreis bindet in 0; Defekt-Chance sinkt um 1,33 % / 0,40 % / 1,33 % / 1,33 % / 0,80 % je Monat | ok |
| B8.11 | 8.13 | Kabinen-Umbau (Kabine + `REFIT_PER_SEAT_1960` × Sitze, mit Kostenindex): Preis in Monatsergebnissen der Strecke | A320ceo FRA–MAD 1990: 0,5 (Lohn 0,27); A320ceo FRA–MAD 2019: 1,2 (Lohn 0,25); A330-300 FRA–JFK 2019: 2,5 (Lohn 0,70); ATR 72-200 HAM–NUE 1990: 0,6 (Lohn 0,39) | Info |
| B8.7 | 8.10 | Verschleiß mit `WEEKS_PER_MONTH`: Punkte je Jahr und Jahre bis Zustand 50 (Kabine / Zelle) bei typischem Flugplan | 45 … 205 Stunden je Monat; Kabine 1,8 … 4,2, Zelle 1,6 … 3,1 Punkte je Jahr | Info |
| B8.8 | 8.14, E34 | Kreditlinie (8 % Zins, Grenze `CREDIT_LIMIT_SHARE` × Flottenwert): Grenze in Monaten fester Strecken-Kosten; Zins bei voller Nutzung gegen das Monatsergebnis | Grenze = 14,0 … 36,5 Monate fester Kosten; Zins = 21 % … 84 % des Monatsergebnisses | Info |
| B8.9 | 8.15, 6.15 | Szenario „Oil Shock“: Ruf 55 bis zum Stichtag ist mit einer besseren Kabine erreichbar, aber nicht ohne Zutun | nach 39 Monaten: LCC-Kabine, Zustand 60 36,3; Flag-Kabine, Zustand 60 (ohne Umbau) 53,5; Flag-Kabine nach Umbau (Zustand 90) 58,5; Boutique-Kabine nach Umbau (Zustand 90) 57,4 | ok |
| B7.1 | 7.4 | Ähnlicher Erfolg (Zuschuss abgeschafft): Median des Unternehmenswerts je Persönlichkeit nach 20 und 40 Jahren innerhalb Faktor 2 des Medians aller | Faktor 1,46 nach 20, 1,83 nach 40 Jahren (schwächste: boutique, stärkste: flag; 10 Läufe) | ok |
| B7.2 | 7.14 | Abschaffung des Zuschusses | abgeschafft (E68, `RIVAL_SUBSIDY_ENABLED = false`); die Haupt-Läufe sind Läufe ohne Zuschuss | Info |
| B7.3 | 7.6 | Preise und Preiskampf im laufenden Spiel (Nachweis zu O60) | Preisniveau Y Median 1,05, p10 0,89; Preiskampf 0,0 % der Strecken; 1,01 Gesellschaften je Paar; Auslastung 100 %; Marge 23 % | Info |
| B7.4 | 7.6, E65 | Störende Sprünge der Optimizer-Preise (Schritte ≥ 0,25 je Monat) | Optimizer 0,8 % der Strecken-Monate (p90 0,07), andere 0,0 % | Info |
| B7.10 | 3.6, E67 | Marktgröße: typische KI-Strecke mit Marge 10 %–25 % (Median, Mittel der Jahre). Auslastung nur Info (E71): Ziel 75 %–90 % gilt für den Spieler beim besten Preis; die KI fliegt ihre Paare meist allein und wählt eine volle Maschine | Marge 23 %; Auslastung 100 % (Info) | ok |
| B3.13 | 3.13 | Umsteiger in Märkten mit Direktangebot typisch unter 25 % | Median je Paar 0,0 %, p90 1,5 %; Paare über 25 %: 0,6 % | ok |
| B7.5 | 7.10 | Slot-Anteile der KI | Haltungen an der eigenen Grenze 1,4 %; größter KI-Anteil an einem Flughafen 30 % | Info |
| B7.11 | 5.10, 7.10, E78 | Widebody-Slots erst ab Flughafengröße 3: keine KI-Strecke mit Widebody an einem kleineren Flughafen | Strecken mit Widebody je Jahr (Januar) im Mittel 0,5; davon an Flughäfen unter Größe 3: 0 (alle Jahre und Läufe) | ok |
| B7.12 | 7.11, E81 | Langstrecke der KI: Anteil der KI-Strecken über 3 500 km ab 1990 deutlich über 5 % (Ziel aus O76) | 12,7 % der Strecken-Monate; Strecken mit Widebody (Januar) ab 1990 im Mittel 1,1 je Lauf | ok |
| B7.6 | 7.13 | Dividende und neue Drehkreuze (`NEW_HUB_MIN_SEATS`) | Dividende je KI und Jahr 126 Mio. $ (1960); neue Drehkreuze 8,7 je Lauf | Info |
| B7.7 | 7.9, 7.11 | Eröffnungen und Käufe je Jahr | je KI und Jahr: 3,2 Eröffnungen, 2,5 Käufe, 1,4 Schließungen | Info |
| B7.9 | 7.9 | Rechenzeit der KI-Planung mit allen Flughäfen | 1 710 ms je Monat in den 2010ern; 11,9 min je Lauf | Info |
| B7.8 | 7.3 | KI-Stärke-Werte: Easy < Normal < Hard im Erfolg | easy 692 Mio. $, normal 1 535 Mio. $, hard 1 670 Mio. $ | Info |

## Abschnitt 1: Zeit und Geld

### Kostenindex, Nachfrage-Wachstum, Treibstoff, Marktpreis (Januar)

| Jahr | costIndex | demandGrowth | Treibstoff je Gallone | Treibstoff ÷ Index (1960 = 1) | Marktpreis Y FRA–MAD |
|---|---|---|---|---|---|
| 1960 | 1,00 | 1,00 | 1,05 $ | 1,00 | 98 $ |
| 1970 | 1,13 | 1,15 | 1,55 $ | 1,31 | 111 $ |
| 1980 | 1,27 | 1,32 | 2,92 $ | 2,19 | 125 $ |
| 1990 | 1,43 | 1,51 | 1,20 $ | 0,80 | 141 $ |
| 2000 | 1,61 | 1,73 | 1,72 $ | 1,02 | 158 $ |
| 2010 | 1,82 | 1,99 | 2,64 $ | 1,39 | 178 $ |
| 2020 | 2,05 | 2,28 | 2,66 $ | 1,24 | 201 $ |
| 2030 | 2,30 | 2,62 | 2,39 $ | 0,99 | 227 $ |

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
| HAM–NUE (klein, kurz) | 465 | 1 903 | 2 728 | 3 326 | 4 164 | 3 953 | 85,8 % / 7,3 % / 5,6 % / 1,3 % |
| FRA–CDG (groß, kurz) | 449 | 2 579 | 3 676 | 4 227 | 4 993 | 4 778 | 86,1 % / 7,2 % / 5,4 % / 1,3 % |
| FRA–MAD (Mittelstrecke) | 1 420 | 1 345 | 2 097 | 3 037 | 3 446 | 3 427 | 85,5 % / 7,5 % / 5,6 % / 1,4 % |
| ATL–ORD (US-Inland) | 976 | 2 379 | 3 002 | 3 368 | 4 044 | 3 835 | 83,8 % / 7,9 % / 6,6 % / 1,6 % |
| FRA–JFK (Langstrecke) | 6 189 | 1 448 | 1 969 | 2 119 | 2 460 | 2 354 | 80,3 % / 9,6 % / 7,6 % / 2,6 % |
| FRA–SIN (sehr lang) | 10 278 | 437 | 520 | 651 | 1 162 | 1 794 | 77,4 % / 10,8 % / 8,6 % / 3,2 % |

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
| Easy | 1,10 | 1,4 % | 5,2 % | 8 % |
| Normal | 1,00 | 0,0 % | 0,0 % | 8 % |
| Hard | 0,90 | −1,6 % | −5,7 % | 7 % |

Viele Abflüge, damit die Sitze nicht begrenzen. Allein wirkt der Faktor nur gegen „Nicht fliegen“ (1.8).

## Abschnitt 4: Preis und Erlös

### Preis und Auslastung typischer Strecken (eine Gesellschaft, Mai)

| Strecke | Marktgröße | Abflüge je Woche | Sitze je Woche | Auslastung bei Marktpreis | Auslastung bei Preisniveau 4 | Bester Preis (Niveau je Klasse) | Auslastung beim besten Preis | Gewinnschwelle voll | Gewinnschwelle bei dieser Auslastung |
|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 2 758 | 14 | 994 | 100 % | 9 % | 1,83 | 100 % | 1,29 | 1,29 |
| 707-320B FRA–JFK 1965 | 1 699 | 4 | 548 | 100 % | 4 % | 1,41 / 1,45 / 1,22 / 1,02 | 100 % | 1,03 | 1,03 |
| 727-200 FRA–MAD 1975 | 2 097 | 6 | 822 | 98 % | 6 % | 1,70 / 1,37 / 1,16 / 1,40 | 96 % | 1,18 | 1,21 |
| ATR 72-200 HAM–NUE 1990 | 3 326 | 14 | 966 | 100 % | 8 % | 1,79 | 100 % | 1,03 | 1,03 |
| A320ceo FRA–MAD 1990 | 3 037 | 14 | 1 876 | 96 % | 6 % | 1,64 / 1,17 / 1,09 / 1,50 | 94 % | 0,87 | 0,90 |
| A320ceo FRA–MAD 1990 (LCC) | 3 037 | 12 | 2 424 | 85 % | 1 % | 0,92 | 100 % | 0,68 | 0,68 |
| A320ceo ATL–ORD 1990 | 3 368 | 14 | 1 876 | 98 % | 8 % | 1,75 / 1,32 / 1,22 / 1,74 | 96 % | 1,01 | 1,04 |
| A330-300 FRA–JFK 1995 | 2 264 | 6 | 1 908 | 92 % | 2 % | 1,10 / 0,91 / 0,79 / 0,93 | 97 % | 0,62 | 0,64 |
| A320ceo FRA–MAD 2019 | 3 433 | 14 | 1 876 | 97 % | 7 % | 1,77 / 1,27 / 1,09 / 1,50 | 95 % | 0,93 | 0,96 |
| A330-300 FRA–JFK 2019 | 2 366 | 6 | 1 908 | 93 % | 2 % | 1,14 / 0,94 / 0,79 / 0,93 | 97 % | 0,76 | 0,77 |
| 787-9 FRA–SIN 2019 | 1 750 | 4 | 1 216 | 96 % | 2 % | 1,10 / 1,05 / 0,89 / 0,81 | 100 % | 0,77 | 0,78 |

Bester Preis nach 4.10 (gewinnbest, Kosten je Fluggast abgezogen). Abflüge: gewinnbeste gerade Zahl bis 14 (787-9: 8) beim besten Preis (`bestDeparturesCase`). Gewinnschwelle als Preisniveau für alle Klassen (4.11).

### Empfindlichkeit: Marktgröße × Faktor (wie ein kleineres `DEMAND_SCALE`), ein Flugzeug allein

| Strecke | × 1,00: Preis Y / Auslastung / Marge | × 0,50: Preis Y / Auslastung / Marge | × 0,25: Preis Y / Auslastung / Marge | × 0,10: Preis Y / Auslastung / Marge |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 1,79 / 100 % / 42 % | 1,36 / 100 % / 24 % | 1,04 / 80 % / −17 % | 1,04 / 32 % / −152 % |
| A320ceo FRA–MAD 1990 | 1,64 / 94 % / 36 % | 1,16 / 81 % / 7 % | 1,03 / 47 % / −64 % | 1,03 / 19 % / −278 % |
| A330-300 FRA–JFK 1995 | 0,89 / 62 % / 7 % | 0,89 / 31 % / −73 % | 0,89 / 16 % / −233 % | 0,89 / 6 % / −713 % |

Der Faktor wirkt als weltweites Ereignis im Beispiel-Spielstand (3.5), also genau wie eine andere Marktgröße; keine Konstante wird geändert.

### Preiskampf: zwei gleiche Gesellschaften (A320ceo, Flag-Ausstattung) auf FRA–MAD 1990, abwechselnd bester Preis

| Abflüge je Gesellschaft | Erste Antwort Y | Verlauf Y (Gesellschaft a) | fest | Endpreis (Niveau je Klasse) | Gewinnschwelle voll | Auslastung | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|
| 14 | 1,43 | 1,43 → 1,43 → 1,43 → 1,43 | nein, Zyklus | 1,43 / 0,84 / 0,74 / 1,39 | 0,87 | 88 % | 68 681 $ |
| 28 | 0,87 | 0,87 → 0,71 → 0,95 → 0,76 → 0,95 → 0,76 | nein, Zyklus | 0,76 / 0,76 / 0,78 / 1,46 | 0,76 | 79 % | −85 058 $ |

Jede Runde: a antwortet auf b, dann b auf a (`bestFareRatios`). 14 Abflüge = ein Flugzeug, 28 = zwei Flugzeuge je Gesellschaft (eine Strecke, mehr Sitze als der Markt füllt; bis Paket 3.9d 56 = vier Flugzeuge, bei der kleineren Marktgröße nur noch Überkapazität).

## Abschnitt 5: Kosten

### Erlös, Kosten und Ergebnis je Woche beim besten Preis

| Strecke | Erlös | Kosten | Ergebnis | Marge | Treibstoff | Landung | Gebühren je Fluggast | Verpflegung | Besatzung | Flugzeug-Anteil | Slots | Jahre bis Kaufpreis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 102 160 $ | 72 100 $ | 30 061 $ | 29 % | 16 % | 31 % | 16 % | 11 % | 4 % | 18 % | 5 % | 6,2 |
| 707-320B FRA–JFK 1965 | 250 125 $ | 198 393 $ | 51 732 $ | 21 % | 60 % | 8 % | 3 % | 9 % | 6 % | 14 % | 1 % | 7,9 |
| 727-200 FRA–MAD 1975 | 183 060 $ | 150 465 $ | 32 595 $ | 18 % | 42 % | 17 % | 7 % | 13 % | 3 % | 17 % | 1 % | 11,3 |
| ATR 72-200 HAM–NUE 1990 | 137 638 $ | 79 336 $ | 58 302 $ | 42 % | 8 % | 28 % | 14 % | 14 % | 7 % | 26 % | 3 % | 5,2 |
| A320ceo FRA–MAD 1990 | 455 137 $ | 291 532 $ | 163 605 $ | 36 % | 17 % | 25 % | 10 % | 17 % | 5 % | 26 % | 2 % | 6,8 |
| A320ceo FRA–MAD 1990 (LCC) | 313 109 $ | 233 178 $ | 79 931 $ | 26 % | 18 % | 26 % | 16 % | 0 % | 5 % | 32 % | 2 % | 13,7 |
| A320ceo ATL–ORD 1990 | 414 734 $ | 275 873 $ | 138 861 $ | 33 % | 12 % | 27 % | 10 % | 18 % | 4 % | 27 % | 2 % | 8,0 |
| A330-300 FRA–JFK 1995 | 842 072 $ | 580 211 $ | 261 861 $ | 31 % | 36 % | 7 % | 5 % | 13 % | 7 % | 32 % | 0 % | 10,3 |
| A320ceo FRA–MAD 2019 | 704 058 $ | 449 829 $ | 254 229 $ | 36 % | 23 % | 23 % | 9 % | 16 % | 4 % | 24 % | 2 % | 6,2 |
| A330-300 FRA–JFK 2019 | 1 163 940 $ | 950 887 $ | 213 053 $ | 18 % | 47 % | 6 % | 4 % | 11 % | 5 % | 26 % | 0 % | 16,9 |
| 787-9 FRA–SIN 2019 | 1 194 665 $ | 951 338 $ | 243 327 $ | 20 % | 42 % | 4 % | 3 % | 9 % | 6 % | 36 % | 0 % | 20,9 |

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
| A320ceo FRA–MAD 1990 | Flag | 123,4 | 69,5 | 9 | 131,4 | 76,2 | 9 |
| A320ceo FRA–MAD 1990 | Boutique | 117,9 | 64,9 | 8 | 126,1 | 71,7 | 9 |
| A330-300 FRA–JFK 1995 | LCC | 48,1 | 24,1 | 0 | 56,1 | 28,1 | 0 |
| A330-300 FRA–JFK 1995 | Expansionist | 65,3 | 32,6 | 1 | 73,2 | 36,6 | 2 |
| A330-300 FRA–JFK 1995 | Optimizer | 87,0 | 43,5 | 3 | 95,0 | 47,5 | 4 |
| A330-300 FRA–JFK 1995 | Flag | 104,5 | 53,8 | 6 | 112,5 | 60,4 | 8 |
| A330-300 FRA–JFK 1995 | Boutique | 96,8 | 48,4 | 4 | 104,8 | 54,0 | 6 |

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
| A320ceo FRA–MAD 1990 | local | 107 697 $ | 1,003 | 8 037 $ | 13,4 |
| A320ceo FRA–MAD 1990 | national | 287 192 $ | 1,006 | 15 624 $ | 18,4 |
| A320ceo FRA–MAD 1990 | global | 717 980 $ | 1,011 | 27 117 $ | 26,5 |
| A320ceo FRA–MAD 2019 | local | 152 208 $ | 1,004 | 12 929 $ | 11,8 |
| A320ceo FRA–MAD 2019 | national | 405 889 $ | 1,006 | 20 448 $ | 19,8 |
| A320ceo FRA–MAD 2019 | global | 1 014 722 $ | 1,007 | 25 706 $ | 39,5 |

Preis fest (bester Preis ohne Werbung). Mehr-Ergebnis = (Strecken-Ergebnis mit − ohne Kampagne) × `WEEKS_PER_MONTH`. Eine regionale Kampagne wirkt auf alle Strecken mit einem Ende in der Region (3.9.5); „Strecken bis zur Deckung“ zählt gleich große Strecken.

### Beste Spieler-Ausstattung: Ruf-Ziel gegen die Ruf-Meilensteine (allein auf der Strecke, Mai)

| Strecke | Kabine und Service | Airline satisfaction | Ruf-Ziel | mit allen Kampagnen | Gold (80) |
|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990 | Flag | 138,0 | 81,7 | 84,7 | ja |
| A320ceo FRA–MAD 1990 | Boutique | 133,5 | 77,9 | 80,9 | mit Werbung |
| A330-300 FRA–JFK 1995 | Flag | 118,2 | 65,2 | 68,2 | nein |
| A330-300 FRA–JFK 1995 | Boutique | 110,8 | 59,0 | 62,0 | nein |

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
| Rang 7 Intercontinental Airline | 56 | 107 | Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD) | Flag (FRA–JFK) |
| Rang 8 Flag Carrier | 60 | 112 | Flag (FRA–MAD), Boutique (FRA–MAD) | Optimizer (FRA–MAD), Flag (FRA–JFK) |
| Rang 9 Global Player | 65 | 118 | Flag (FRA–MAD) | Boutique (FRA–MAD) |
| Meilenstein A name people know | 60 | 112 | Flag (FRA–MAD), Boutique (FRA–MAD) | Optimizer (FRA–MAD), Flag (FRA–JFK) |
| Meilenstein A reputation worth having | 70 | 124 | – | Flag (FRA–MAD), Boutique (FRA–MAD) |
| Meilenstein The gold standard | 80 | 136 | – | – |

Ausstattungen aus der Tabelle oben (allein auf der Strecke, keine Ausfälle). Das Ruf-Ziel wird nach rund einem Jahr fast erreicht (Halbwertszeit 4,3 Monate, 6.5).

### Klassen-Forschung gegen das Monatsergebnis einer Gesellschaft an der Rang-Schwelle

| Rang (frühestens) | Strecke (bester Preis) | Fluggäste je Monat (Schwelle) | Ergebnis je Fluggast | Marge | Monatsergebnis | Klassen-Forschung | Preis | Monatsergebnisse | … bei Marge 10 % |
|---|---|---|---|---|---|---|---|---|---|
| 1 (April 1960) | F27-200 HAM–NUE 1960 (Commuter) | 8 000 | 28,7 $ | 32 % | 0,23 Mio. $ | Regional aircraft class | 2,11 Mio. $ | 9,2 | 29,3 |
| 2 (Jan. 1961) | Caravelle III FRA–CDG 1961 (Regional) | 25 000 | 29,0 $ | 29 % | 0,73 Mio. $ | Narrowbody aircraft class | 8,50 Mio. $ | 11,7 | 33,9 |
| 4 (Jan. 1966) | 727-100 FRA–MAD 1966 (Narrowbody) | 170 000 | 43,5 $ | 23 % | 7,39 Mio. $ | Wide-body aircraft class | 30,08 Mio. $ | 4,1 | 9,4 |
| 5 (Jan. 1970) | 727-200 FRA–MAD 1970 (Narrowbody) | 350 000 | 34,6 $ | 18 % | 12,12 Mio. $ | Jumbo aircraft class + Supersonic aircraft class | 110,42 Mio. $ | 9,1 | 16,6 |

Monatsergebnis = Fluggäste der Rang-Schwelle × Ergebnis je Fluggast der typischen Strecke beim besten Preis (Strecken-Ergebnis 5.9, ohne Kosten der Gesellschaft wie Flughäfen und Verwaltung). Preis im Monat des Rangs (`atCost`). Die letzte Spalte rechnet mit 10 % Marge auf denselben Erlös (Ziel nach E67: 10–25 %).

### Jahresziel der Rang-Beispiele (Angebot im Monat des Rangs)

| Beispiel | Vorjahr: Ergebnis | Vorjahr: Erlös | Bezugsgröße | sicher (× 1,10) | hoch (× 1,35) | Prämie sicher / andere Art / hoch | Strafe hoch | hohes Ziel lohnt ab Chance |
|---|---|---|---|---|---|---|---|---|
| Rang 1, 1960 | 2,76 Mio. $ | 8,63 Mio. $ | 2,76 Mio. $ | 3,03 Mio. $ | 3,72 Mio. $ | 0,25 Mio. $* / 0,38 Mio. $* / 0,63 Mio. $* | 0,31 Mio. $ | 60 % |
| Rang 2, 1961 | 8,71 Mio. $ | 30,10 Mio. $ | 8,71 Mio. $ | 9,58 Mio. $ | 11,75 Mio. $ | 0,25 Mio. $* / 0,38 Mio. $* / 0,63 Mio. $* | 0,32 Mio. $ | 60 % |
| Rang 4, 1966 | 88,68 Mio. $ | 382,58 Mio. $ | 88,68 Mio. $ | 97,54 Mio. $ | 119,71 Mio. $ | 1,77 Mio. $ / 2,66 Mio. $ / 4,43 Mio. $ | 2,22 Mio. $ | 60 % |
| Rang 5, 1970 | 145,44 Mio. $ | 795,88 Mio. $ | 145,44 Mio. $ | 159,98 Mio. $ | 196,34 Mio. $ | 2,91 Mio. $ / 4,36 Mio. $ / 7,27 Mio. $ | 3,64 Mio. $ | 60 % |
| Rang 5, 1970, Marge 10 % | 79,59 Mio. $ | 795,88 Mio. $ | 79,59 Mio. $ | 87,55 Mio. $ | 107,44 Mio. $ | 1,59 Mio. $ / 2,39 Mio. $ / 3,98 Mio. $ | 1,99 Mio. $ | 60 % |
| Rang 5, 1970, Verlustjahr (−5 %) | −39,79 Mio. $ | 795,88 Mio. $ | 39,79 Mio. $ | 43,77 Mio. $ | 53,72 Mio. $ | 0,80 Mio. $ / 1,19 Mio. $ / 1,99 Mio. $ | 0,99 Mio. $ | 60 % |

* = Mindestprämie (sicher 0,25 Mio. $ von 1960 über `atCost`, andere Art und hoch im Verhältnis der Anteile, E83). „Lohnt ab Chance“: Das hohe Ziel bringt im Mittel mehr als ein sicher erreichtes sicheres Ziel, wenn es mit dieser Wahrscheinlichkeit erreicht wird (Strafe = 50 % der Prämie, E58). Das sichere Ziel selbst lohnt ab einer Chance von 33 %.

## Abschnitt 7: Flugzeugwahl der KI auf Langstrecke (O79)

### Die 20 größten Langstrecken-Paare je Jahr: bester Narrowbody gegen besten Widebody (Flag-Ausstattung)

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | LAX–JFK | 3 974 | 2 493 | 737-500 (97 Sitze, 13/13 Umläufe, 90 %) | 0,88 Mio. $ | 0,65 Mio. $ | 767-200 (210 Sitze, 8/13 Umläufe, 78 %) | 0,85 Mio. $ | 0,22 Mio. $ | Narrowbody |
| 1990 | JFK–SFO | 4 152 | 2 450 | 737-500 (97 Sitze, 12/12 Umläufe, 92 %) | 0,93 Mio. $ | 0,70 Mio. $ | il-86 (253 Sitze, 4/13 Umläufe, 88 %) | 0,59 Mio. $ | 0,25 Mio. $ | Narrowbody |
| 1990 | SFO–YYZ | 3 628 | 2 434 | 737-500 (97 Sitze, 14/14 Umläufe, 89 %) | 0,94 Mio. $ | 0,71 Mio. $ | il-86 (253 Sitze, 5/15 Umläufe, 85 %) | 0,66 Mio. $ | 0,33 Mio. $ | Narrowbody |
| 1990 | LAX–MIA | 3 763 | 2 406 | 737-500 (97 Sitze, 13/13 Umläufe, 89 %) | 0,79 Mio. $ | 0,56 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 86 %) | 0,50 Mio. $ | 0,16 Mio. $ | Narrowbody |
| 1990 | LAX–BOS | 4 193 | 2 356 | 737-500 (97 Sitze, 12/12 Umläufe, 91 %) | 0,89 Mio. $ | 0,66 Mio. $ | 767-200 (210 Sitze, 7/12 Umläufe, 82 %) | 0,87 Mio. $ | 0,25 Mio. $ | Narrowbody |
| 1990 | LAX–PHL | 3 856 | 2 354 | 737-500 (97 Sitze, 13/13 Umläufe, 89 %) | 0,86 Mio. $ | 0,63 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 87 %) | 0,55 Mio. $ | 0,21 Mio. $ | Narrowbody |
| 1990 | JFK–SEA | 3 887 | 2 347 | 737-500 (97 Sitze, 13/13 Umläufe, 90 %) | 0,87 Mio. $ | 0,64 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 87 %) | 0,55 Mio. $ | 0,22 Mio. $ | Narrowbody |
| 1990 | MIA–SFO | 4 154 | 2 324 | 737-500 (97 Sitze, 12/12 Umläufe, 90 %) | 0,83 Mio. $ | 0,60 Mio. $ | il-86 (253 Sitze, 4/13 Umläufe, 86 %) | 0,51 Mio. $ | 0,17 Mio. $ | Narrowbody |
| 1990 | LAX–YUL | 3 973 | 2 317 | 737-500 (97 Sitze, 13/13 Umläufe, 89 %) | 0,87 Mio. $ | 0,64 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 87 %) | 0,54 Mio. $ | 0,21 Mio. $ | Narrowbody |
| 1990 | SFO–BOS | 4 341 | 2 311 | 737-500 (97 Sitze, 12/12 Umläufe, 91 %) | 0,95 Mio. $ | 0,72 Mio. $ | il-86 (253 Sitze, 4/13 Umläufe, 88 %) | 0,59 Mio. $ | 0,25 Mio. $ | Narrowbody |
| 1990 | JFK–YVR | 3 930 | 2 309 | 737-500 (97 Sitze, 13/13 Umläufe, 89 %) | 0,84 Mio. $ | 0,61 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 86 %) | 0,52 Mio. $ | 0,19 Mio. $ | Narrowbody |
| 1990 | LHR–JFK | 5 540 | 2 297 | a320ceo (134 Sitze, 10/10 Umläufe, 86 %) | 1,06 Mio. $ | 0,68 Mio. $ | 767-200 (210 Sitze, 6/10 Umläufe, 86 %) | 0,92 Mio. $ | 0,30 Mio. $ | Narrowbody |
| 1990 | SFO–PHL | 4 048 | 2 287 | 737-500 (97 Sitze, 13/13 Umläufe, 90 %) | 0,91 Mio. $ | 0,68 Mio. $ | il-86 (253 Sitze, 4/13 Umläufe, 87 %) | 0,57 Mio. $ | 0,23 Mio. $ | Narrowbody |
| 1990 | AMS–SVX | 3 546 | 2 284 | 737-500 (97 Sitze, 14/14 Umläufe, 89 %) | 0,95 Mio. $ | 0,72 Mio. $ | il-86 (253 Sitze, 5/15 Umläufe, 84 %) | 0,66 Mio. $ | 0,33 Mio. $ | Narrowbody |
| 1990 | CDG–SVX | 3 877 | 2 283 | 737-500 (97 Sitze, 13/13 Umläufe, 90 %) | 0,91 Mio. $ | 0,68 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 87 %) | 0,58 Mio. $ | 0,24 Mio. $ | Narrowbody |
| 1990 | ICN–OVB | 3 805 | 2 278 | 737-500 (97 Sitze, 13/13 Umläufe, 90 %) | 0,93 Mio. $ | 0,69 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 87 %) | 0,60 Mio. $ | 0,26 Mio. $ | Narrowbody |
| 1990 | SFO–YUL | 4 076 | 2 272 | 737-500 (97 Sitze, 12/12 Umläufe, 91 %) | 0,89 Mio. $ | 0,66 Mio. $ | il-86 (253 Sitze, 4/13 Umläufe, 87 %) | 0,56 Mio. $ | 0,22 Mio. $ | Narrowbody |
| 1990 | LHR–SVX | 3 900 | 2 270 | 737-500 (97 Sitze, 13/13 Umläufe, 90 %) | 0,94 Mio. $ | 0,71 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 87 %) | 0,61 Mio. $ | 0,27 Mio. $ | Narrowbody |
| 1990 | BOS–PHX | 3 693 | 2 264 | 737-500 (97 Sitze, 14/14 Umläufe, 88 %) | 0,84 Mio. $ | 0,61 Mio. $ | il-86 (253 Sitze, 4/14 Umläufe, 86 %) | 0,53 Mio. $ | 0,19 Mio. $ | Narrowbody |
| 1990 | ATL–SEA | 3 505 | 2 264 | 737-500 (97 Sitze, 14/14 Umläufe, 89 %) | 0,94 Mio. $ | 0,71 Mio. $ | il-86 (253 Sitze, 5/15 Umläufe, 85 %) | 0,66 Mio. $ | 0,32 Mio. $ | Narrowbody |
| 2000 | LAX–JFK | 3 974 | 2 766 | a319ceo (114 Sitze, 13/13 Umläufe, 88 %) | 0,97 Mio. $ | 0,58 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 83 %) | 0,72 Mio. $ | 0,12 Mio. $ | Narrowbody |
| 2000 | LHR–JFK | 5 540 | 2 757 | 737-700 (108 Sitze, 10/10 Umläufe, 96 %) | 1,20 Mio. $ | 0,81 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 88 %) | 0,80 Mio. $ | 0,20 Mio. $ | Narrowbody |
| 2000 | SFO–YYZ | 3 628 | 2 722 | 717-200 (98 Sitze, 14/14 Umläufe, 91 %) | 1,07 Mio. $ | 0,74 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 83 %) | 0,85 Mio. $ | 0,25 Mio. $ | Narrowbody |
| 2000 | LAX–MIA | 3 763 | 2 721 | 717-200 (98 Sitze, 14/14 Umläufe, 89 %) | 0,93 Mio. $ | 0,60 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 82 %) | 0,71 Mio. $ | 0,11 Mio. $ | Narrowbody |
| 2000 | JFK–SFO | 4 152 | 2 719 | a319ceo (114 Sitze, 13/13 Umläufe, 89 %) | 1,03 Mio. $ | 0,65 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 83 %) | 0,76 Mio. $ | 0,16 Mio. $ | Narrowbody |
| 2000 | CDG–JFK | 5 833 | 2 704 | 737-700 (108 Sitze, 10/10 Umläufe, 95 %) | 1,13 Mio. $ | 0,73 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 90 %) | 0,73 Mio. $ | 0,13 Mio. $ | Narrowbody |
| 2000 | LHR–BOS | 5 240 | 2 657 | 737-700 (108 Sitze, 10/10 Umläufe, 95 %) | 1,18 Mio. $ | 0,79 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 88 %) | 0,80 Mio. $ | 0,20 Mio. $ | Narrowbody |
| 2000 | LAX–PHL | 3 856 | 2 640 | a319ceo (114 Sitze, 14/14 Umläufe, 87 %) | 0,96 Mio. $ | 0,58 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 80 %) | 0,66 Mio. $ | 0,06 Mio. $ | Narrowbody |
| 2000 | LAX–BOS | 4 193 | 2 634 | a319ceo (114 Sitze, 13/13 Umläufe, 88 %) | 0,98 Mio. $ | 0,60 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 84 %) | 0,70 Mio. $ | 0,10 Mio. $ | Narrowbody |
| 2000 | JFK–AMS | 5 848 | 2 632 | a319ceo (114 Sitze, 9/9 Umläufe, 96 %) | 1,10 Mio. $ | 0,71 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 90 %) | 0,72 Mio. $ | 0,12 Mio. $ | Narrowbody |
| 2000 | MIA–SFO | 4 154 | 2 627 | a319ceo (114 Sitze, 13/13 Umläufe, 88 %) | 0,97 Mio. $ | 0,59 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 80 %) | 0,62 Mio. $ | 0,02 Mio. $ | Narrowbody |
| 2000 | LAX–YUL | 3 973 | 2 618 | a319ceo (114 Sitze, 13/13 Umläufe, 88 %) | 0,97 Mio. $ | 0,59 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 80 %) | 0,64 Mio. $ | 0,04 Mio. $ | Narrowbody |
| 2000 | CDG–BOS | 5 534 | 2 618 | 737-700 (108 Sitze, 10/10 Umläufe, 95 %) | 1,12 Mio. $ | 0,73 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 87 %) | 0,72 Mio. $ | 0,12 Mio. $ | Narrowbody |
| 2000 | JFK–SEA | 3 887 | 2 605 | a319ceo (114 Sitze, 14/14 Umläufe, 87 %) | 0,97 Mio. $ | 0,58 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 79 %) | 0,62 Mio. $ | 0,02 Mio. $ | Narrowbody |
| 2000 | LHR–YYZ | 5 707 | 2 595 | 737-700 (108 Sitze, 10/10 Umläufe, 95 %) | 1,16 Mio. $ | 0,77 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 88 %) | 0,75 Mio. $ | 0,16 Mio. $ | Narrowbody |
| 2000 | JFK–DUB | 5 103 | 2 588 | 737-700 (108 Sitze, 11/11 Umläufe, 92 %) | 1,06 Mio. $ | 0,67 Mio. $ | il-96-300 (217 Sitze, 7/11 Umläufe, 84 %) | 0,70 Mio. $ | 0,11 Mio. $ | Narrowbody |
| 2000 | SFO–BOS | 4 341 | 2 587 | a319ceo (114 Sitze, 12/12 Umläufe, 90 %) | 1,04 Mio. $ | 0,66 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 84 %) | 0,74 Mio. $ | 0,15 Mio. $ | Narrowbody |
| 2000 | LHR–TLV | 3 588 | 2 586 | 717-200 (98 Sitze, 14/14 Umläufe, 89 %) | 0,96 Mio. $ | 0,63 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 79 %) | 0,65 Mio. $ | 0,06 Mio. $ | Narrowbody |
| 2000 | SFO–PHL | 4 048 | 2 581 | a319ceo (114 Sitze, 13/13 Umläufe, 88 %) | 1,02 Mio. $ | 0,64 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 79 %) | 0,61 Mio. $ | 0,01 Mio. $ | Narrowbody |
| 2000 | SFO–YUL | 4 076 | 2 578 | a319ceo (114 Sitze, 13/13 Umläufe, 88 %) | 1,04 Mio. $ | 0,65 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 79 %) | 0,62 Mio. $ | 0,02 Mio. $ | Narrowbody |
| 2010 | LHR–TLV | 3 588 | 3 042 | a318ceo (97 Sitze, 8/14 Umläufe, 92 %) | 0,36 Mio. $ | 0,01 Mio. $ | il-96-300 (217 Sitze, 4/14 Umläufe, 84 %) | 0,04 Mio. $ | −0,63 Mio. $ | Narrowbody |
| 2010 | LAX–JFK | 3 974 | 2 897 | a318ceo (97 Sitze, 8/13 Umläufe, 95 %) | 0,47 Mio. $ | 0,12 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 87 %) | 0,11 Mio. $ | −0,57 Mio. $ | Narrowbody |
| 2010 | LHR–CAI | 3 532 | 2 887 | a318ceo (97 Sitze, 5/15 Umläufe, 96 %) | 0,24 Mio. $ | −0,11 Mio. $ | il-96-300 (217 Sitze, 4/14 Umläufe, 82 %) | −0,06 Mio. $ | −0,73 Mio. $ | Narrowbody |
| 2010 | JFK–SFO | 4 152 | 2 848 | a318ceo (97 Sitze, 8/13 Umläufe, 96 %) | 0,51 Mio. $ | 0,17 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 87 %) | 0,14 Mio. $ | −0,54 Mio. $ | Narrowbody |
| 2010 | SFO–YYZ | 3 628 | 2 838 | a318ceo (97 Sitze, 8/14 Umläufe, 96 %) | 0,55 Mio. $ | 0,21 Mio. $ | il-96-300 (217 Sitze, 4/14 Umläufe, 87 %) | 0,20 Mio. $ | −0,47 Mio. $ | Narrowbody |
| 2010 | LAX–MIA | 3 763 | 2 827 | a318ceo (97 Sitze, 8/14 Umläufe, 94 %) | 0,42 Mio. $ | 0,08 Mio. $ | il-96-300 (217 Sitze, 4/14 Umläufe, 86 %) | 0,08 Mio. $ | −0,59 Mio. $ | Narrowbody |
| 2010 | MAD–TLV | 3 544 | 2 811 | a318ceo (97 Sitze, 5/15 Umläufe, 96 %) | 0,25 Mio. $ | −0,09 Mio. $ | il-96-300 (217 Sitze, 4/14 Umläufe, 82 %) | −0,04 Mio. $ | −0,72 Mio. $ | Narrowbody |
| 2010 | LHR–JFK | 5 540 | 2 798 | a318ceo (97 Sitze, 6/10 Umläufe, 97 %) | 0,28 Mio. $ | −0,07 Mio. $ | il-96-300 (217 Sitze, 3/10 Umläufe, 88 %) | −0,11 Mio. $ | −0,78 Mio. $ | Narrowbody |
| 2010 | LAX–PHL | 3 856 | 2 754 | a318ceo (97 Sitze, 8/14 Umläufe, 95 %) | 0,46 Mio. $ | 0,12 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 87 %) | 0,11 Mio. $ | −0,56 Mio. $ | Narrowbody |
| 2010 | DUB–TLV | 4 034 | 2 750 | a318ceo (97 Sitze, 8/13 Umläufe, 90 %) | 0,25 Mio. $ | −0,10 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 83 %) | −0,08 Mio. $ | −0,76 Mio. $ | Narrowbody |
| 2010 | LAX–BOS | 4 193 | 2 747 | a318ceo (97 Sitze, 8/13 Umläufe, 95 %) | 0,47 Mio. $ | 0,13 Mio. $ | il-96-300 (217 Sitze, 4/12 Umläufe, 87 %) | 0,10 Mio. $ | −0,58 Mio. $ | Narrowbody |
| 2010 | CDG–JFK | 5 833 | 2 745 | 737-700 (108 Sitze, 6/10 Umläufe, 92 %) | 0,22 Mio. $ | −0,23 Mio. $ | il-96-300 (217 Sitze, 3/9 Umläufe, 87 %) | −0,17 Mio. $ | −0,85 Mio. $ | Narrowbody |
| 2010 | LAX–YUL | 3 973 | 2 731 | a318ceo (97 Sitze, 8/13 Umläufe, 95 %) | 0,47 Mio. $ | 0,12 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 86 %) | 0,11 Mio. $ | −0,57 Mio. $ | Narrowbody |
| 2010 | JFK–SEA | 3 887 | 2 728 | a318ceo (97 Sitze, 8/14 Umläufe, 95 %) | 0,46 Mio. $ | 0,12 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 87 %) | 0,11 Mio. $ | −0,57 Mio. $ | Narrowbody |
| 2010 | MIA–SFO | 4 154 | 2 726 | a318ceo (97 Sitze, 8/13 Umläufe, 94 %) | 0,43 Mio. $ | 0,08 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 86 %) | 0,06 Mio. $ | −0,61 Mio. $ | Narrowbody |
| 2010 | OSL–TLV | 3 587 | 2 707 | a318ceo (97 Sitze, 5/15 Umläufe, 96 %) | 0,27 Mio. $ | −0,07 Mio. $ | il-96-300 (217 Sitze, 4/14 Umläufe, 82 %) | −0,03 Mio. $ | −0,70 Mio. $ | Narrowbody |
| 2010 | SFO–BOS | 4 341 | 2 698 | a318ceo (97 Sitze, 7/12 Umläufe, 97 %) | 0,50 Mio. $ | 0,15 Mio. $ | il-96-300 (217 Sitze, 4/12 Umläufe, 87 %) | 0,13 Mio. $ | −0,55 Mio. $ | Narrowbody |
| 2010 | LHR–BOS | 5 240 | 2 695 | a318ceo (97 Sitze, 6/10 Umläufe, 96 %) | 0,30 Mio. $ | −0,05 Mio. $ | il-96-300 (217 Sitze, 3/10 Umläufe, 87 %) | −0,09 Mio. $ | −0,77 Mio. $ | Narrowbody |
| 2010 | SFO–PHL | 4 048 | 2 690 | a318ceo (97 Sitze, 8/13 Umläufe, 96 %) | 0,50 Mio. $ | 0,16 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 87 %) | 0,13 Mio. $ | −0,55 Mio. $ | Narrowbody |
| 2010 | JFK–YVR | 3 930 | 2 683 | a318ceo (97 Sitze, 8/13 Umläufe, 94 %) | 0,42 Mio. $ | 0,08 Mio. $ | il-96-300 (217 Sitze, 4/13 Umläufe, 86 %) | 0,08 Mio. $ | −0,60 Mio. $ | Narrowbody |

Je Typ: neues Flugzeug mit Kabine nach 7.5, Strecke nach dem Anlauf, Preisniveau einer neuen KI-Strecke (7.6), beste Flugzahl aus `planFrequencies` (100 / 60 / 30 % der höchsten Umläufe), Planer-Hauptzahl je Monat (4.12); „nach Zins“ = `profitAfterCapital` (8 % je Jahr auf den Kaufpreis, E81). Bester Typ je Bauart nach „nach Zins“. Marktgröße = Fluggäste je Woche, beide Richtungen. Die Gesellschaft fliegt das Paar allein.

### Die 10 größten Paare über 7 500 km je Jahr

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | HND–SFO | 8 286 | 2 080 | il-62m (134 Sitze, 7/7 Umläufe, 93 %) | 1,01 Mio. $ | 0,87 Mio. $ | 767-200er (210 Sitze, 4/7 Umläufe, 93 %) | 1,25 Mio. $ | 0,58 Mio. $ | Narrowbody |
| 1990 | HND–LED | 7 622 | 2 074 | il-62m (134 Sitze, 5/8 Umläufe, 97 %) | 0,85 Mio. $ | 0,71 Mio. $ | 767-200er (210 Sitze, 4/7 Umläufe, 91 %) | 1,01 Mio. $ | 0,33 Mio. $ | Narrowbody |
| 1990 | HND–LAX | 8 813 | 2 052 | il-62m (134 Sitze, 7/7 Umläufe, 93 %) | 1,00 Mio. $ | 0,86 Mio. $ | 767-200er (210 Sitze, 4/7 Umläufe, 92 %) | 1,29 Mio. $ | 0,62 Mio. $ | Narrowbody |
| 1990 | LHR–ICN | 8 861 | 2 043 | il-62m (134 Sitze, 7/7 Umläufe, 93 %) | 1,08 Mio. $ | 0,93 Mio. $ | 767-200er (210 Sitze, 4/6 Umläufe, 93 %) | 1,36 Mio. $ | 0,69 Mio. $ | Narrowbody |
| 1990 | LHR–HND | 9 592 | 2 038 | il-62m (134 Sitze, 6/6 Umläufe, 97 %) | 1,22 Mio. $ | 1,07 Mio. $ | 767-200er (210 Sitze, 4/6 Umläufe, 93 %) | 1,51 Mio. $ | 0,84 Mio. $ | Narrowbody |
| 1990 | TPE–LED | 7 671 | 2 019 | il-62m (134 Sitze, 5/8 Umläufe, 96 %) | 0,84 Mio. $ | 0,69 Mio. $ | 767-200er (210 Sitze, 4/7 Umläufe, 90 %) | 0,98 Mio. $ | 0,31 Mio. $ | Narrowbody |
| 1990 | HND–JFK | 10 875 | 2 016 | – | – | – | 767-200er (210 Sitze, 5/5 Umläufe, 89 %) | 1,67 Mio. $ | 0,99 Mio. $ | Widebody |
| 1990 | CDG–ICN | 8 927 | 2 014 | il-62m (134 Sitze, 7/7 Umläufe, 92 %) | 0,98 Mio. $ | 0,83 Mio. $ | 767-200er (210 Sitze, 4/6 Umläufe, 92 %) | 1,28 Mio. $ | 0,61 Mio. $ | Narrowbody |
| 1990 | KIX–LED | 7 514 | 2 002 | il-62m (134 Sitze, 5/8 Umläufe, 96 %) | 0,79 Mio. $ | 0,65 Mio. $ | 767-200er (210 Sitze, 5/8 Umläufe, 87 %) | 1,01 Mio. $ | 0,34 Mio. $ | Narrowbody |
| 1990 | HND–CDG | 9 707 | 2 001 | il-62m (134 Sitze, 6/6 Umläufe, 96 %) | 1,11 Mio. $ | 0,97 Mio. $ | 767-200er (210 Sitze, 4/6 Umläufe, 92 %) | 1,41 Mio. $ | 0,74 Mio. $ | Narrowbody |
| 2000 | LHR–IAH | 7 764 | 2 351 | – | – | – | il-96-300 (217 Sitze, 4/7 Umläufe, 95 %) | 1,17 Mio. $ | 0,57 Mio. $ | Widebody |
| 2000 | CDG–IAH | 8 072 | 2 324 | – | – | – | il-96-300 (217 Sitze, 4/7 Umläufe, 95 %) | 1,14 Mio. $ | 0,54 Mio. $ | Widebody |
| 2000 | LHR–AUS | 7 893 | 2 286 | – | – | – | il-96-300 (217 Sitze, 4/7 Umläufe, 93 %) | 1,01 Mio. $ | 0,41 Mio. $ | Widebody |
| 2000 | LHR–HND | 9 592 | 2 284 | – | – | – | il-96-300 (217 Sitze, 4/6 Umläufe, 95 %) | 1,40 Mio. $ | 0,80 Mio. $ | Widebody |
| 2000 | HND–CDG | 9 707 | 2 275 | – | – | – | il-96-300 (217 Sitze, 4/6 Umläufe, 94 %) | 1,31 Mio. $ | 0,72 Mio. $ | Widebody |
| 2000 | AMS–IAH | 8 050 | 2 258 | – | – | – | il-96-300 (217 Sitze, 4/7 Umläufe, 94 %) | 1,12 Mio. $ | 0,53 Mio. $ | Widebody |
| 2000 | ATL–ZRH | 7 531 | 2 257 | – | – | – | il-96-300 (217 Sitze, 5/8 Umläufe, 91 %) | 1,14 Mio. $ | 0,54 Mio. $ | Widebody |
| 2000 | MIA–ZRH | 7 845 | 2 255 | – | – | – | il-96-300 (217 Sitze, 4/7 Umläufe, 92 %) | 0,90 Mio. $ | 0,30 Mio. $ | Widebody |
| 2000 | LHR–ICN | 8 861 | 2 254 | – | – | – | il-96-300 (217 Sitze, 4/6 Umläufe, 94 %) | 1,19 Mio. $ | 0,59 Mio. $ | Widebody |
| 2000 | CDG–AUS | 8 206 | 2 248 | – | – | – | il-96-300 (217 Sitze, 4/7 Umläufe, 93 %) | 1,00 Mio. $ | 0,41 Mio. $ | Widebody |
| 2010 | LHR–IAH | 7 764 | 2 386 | 737-700er (108 Sitze, 4/7 Umläufe, 99 %) | 0,39 Mio. $ | −0,10 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 95 %) | 0,09 Mio. $ | −0,59 Mio. $ | Narrowbody |
| 2010 | CDG–IAH | 8 072 | 2 358 | 737-700er (108 Sitze, 4/7 Umläufe, 99 %) | 0,39 Mio. $ | −0,10 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 94 %) | 0,06 Mio. $ | −0,62 Mio. $ | Narrowbody |
| 2010 | JFK–TLV | 9 117 | 2 324 | 737-700er (108 Sitze, 6/6 Umläufe, 97 %) | 0,76 Mio. $ | 0,27 Mio. $ | il-96-300 (217 Sitze, 2/6 Umläufe, 98 %) | 0,35 Mio. $ | −0,32 Mio. $ | Narrowbody |
| 2010 | LHR–AUS | 7 893 | 2 320 | 737-700er (108 Sitze, 4/7 Umläufe, 98 %) | 0,33 Mio. $ | −0,16 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 93 %) | −0,01 Mio. $ | −0,69 Mio. $ | Narrowbody |
| 2010 | LHR–LAX | 8 760 | 2 299 | 737-700er (108 Sitze, 4/7 Umläufe, 98 %) | 0,36 Mio. $ | −0,14 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 93 %) | 0,01 Mio. $ | −0,67 Mio. $ | Narrowbody |
| 2010 | LHR–SFO | 8 616 | 2 293 | 737-700er (108 Sitze, 4/7 Umläufe, 98 %) | 0,39 Mio. $ | −0,10 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 93 %) | 0,04 Mio. $ | −0,63 Mio. $ | Narrowbody |
| 2010 | AMS–IAH | 8 050 | 2 291 | 737-700er (108 Sitze, 4/7 Umläufe, 99 %) | 0,39 Mio. $ | −0,10 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 94 %) | 0,05 Mio. $ | −0,63 Mio. $ | Narrowbody |
| 2010 | ATL–ZRH | 7 531 | 2 290 | 737-700er (108 Sitze, 5/8 Umläufe, 97 %) | 0,43 Mio. $ | −0,06 Mio. $ | il-96-300 (217 Sitze, 2/8 Umläufe, 95 %) | 0,08 Mio. $ | −0,60 Mio. $ | Narrowbody |
| 2010 | MIA–ZRH | 7 845 | 2 288 | 737-700er (108 Sitze, 4/7 Umläufe, 97 %) | 0,28 Mio. $ | −0,21 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 92 %) | −0,07 Mio. $ | −0,74 Mio. $ | Narrowbody |
| 2010 | CDG–AUS | 8 206 | 2 283 | 737-700er (108 Sitze, 4/7 Umläufe, 97 %) | 0,33 Mio. $ | −0,16 Mio. $ | il-96-300 (217 Sitze, 2/7 Umläufe, 92 %) | −0,02 Mio. $ | −0,70 Mio. $ | Narrowbody |

Wie oben. „–“ = kein lieferbarer Typ der Bauart mit dieser Reichweite.

### Kosten je Sitz und Woche: LHR–JFK 2000, ein Flugzeug allein, Marktpreis

| Typ | Bauart | Umläufe | Sitze je Woche | Fluggäste | Treibstoff je Sitz | Besatzung + Landung je Sitz | Flugzeug-Anteil je Sitz | feste Kosten je Sitz | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|---|---|
| 737-700 | Narrowbody | 5/10 | 1 080 | 1 080 | 159 | 78 | 71 | 311 | 0,13 Mio. $ |
| 737-700 | Narrowbody | 10/10 | 2 160 | 2 079 | 159 | 78 | 35 | 275 | 0,25 Mio. $ |
| a321ceo | Narrowbody | 5/10 | 1 600 | 1 568 | 153 | 71 | 69 | 295 | 0,18 Mio. $ |
| a321ceo | Narrowbody | 10/10 | 3 200 | 2 846 | 153 | 71 | 34 | 261 | 0,23 Mio. $ |
| 767-300er | Widebody | 5/10 | 2 530 | 2 305 | 170 | 45 | 69 | 286 | 0,16 Mio. $ |
| 767-300er | Widebody | 10/10 | 5 060 | 3 200 | 170 | 45 | 34 | 251 | −0,10 Mio. $ |
| a330-300 | Widebody | 5/10 | 3 180 | 2 762 | 159 | 43 | 61 | 265 | 0,17 Mio. $ |
| a330-300 | Widebody | 10/10 | 6 360 | 3 248 | 159 | 43 | 31 | 234 | −0,30 Mio. $ |
| 777-200er | Widebody | 5/10 | 3 180 | 2 773 | 154 | 43 | 73 | 271 | 0,16 Mio. $ |
| 777-200er | Widebody | 10/10 | 6 360 | 3 310 | 154 | 43 | 37 | 234 | −0,28 Mio. $ |

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
| Aviation Downturn | × 1,00 | 0,65 / 0,40 / 12 | 1,140 | 9,20 Mio. $ | 24 % | 1,03 Mio. $ | 2,13 |
| Aviation Downturn | × 0,25 | 0,65 / 0,40 / 12 | 1,072 | 3,24 Mio. $ | 12 % | 0,36 Mio. $ | 1,09 |
| Global Financial Crisis | × 1,00 | 0,75 / 0,33 / 24 | 1,075 | 17,63 Mio. $ | 17 % | 1,36 Mio. $ | 2,16 |
| Global Financial Crisis | × 0,25 | 0,75 / 0,33 / 24 | 1,039 | 7,15 Mio. $ | 8 % | 0,48 Mio. $ | 1,12 |
| Global Pandemic | × 1,00 | 0,20 / 0,35 / 24 | 1,686 | 46,71 Mio. $ | 18 % | 5,11 Mio. $ | 1,68 |
| Global Pandemic | × 0,25 | 0,20 / 0,35 / 24 | 1,283 | 14,04 Mio. $ | 9 % | 1,77 Mio. $ | 0,71 |

Ergebnis = Strecken-Ergebnis (5.9) × `WEEKS_PER_MONTH`, Summe über die Dauer. „× 0,25“ verkleinert die Marktgröße wie ein kleineres `DEMAND_SCALE` (Richtung E67). Volle Flugzeuge verlieren bei kleinerer Nachfrage zuerst nur „Knappheit“; die Antwort holt dann wenig Fluggäste zurück.

### Charter oder streichen je betroffenem Flug (Strecken beim besten Preis)

| Strecke | Erlös je Flug | Kosten je Fluggast (Summe) | eigene Flugkosten | Charter-Gebühr | Vorteil Charter | Strecke mit Gewinn |
|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 7 297 $ | 1 379 $ | 2 604 $ | 3 907 $ | 2 012 $ | ja |
| 707-320B FRA–JFK 1965 | 62 531 $ | 5 866 $ | 36 518 $ | 54 777 $ | 1 888 $ | ja |
| 727-200 FRA–MAD 1975 | 30 510 $ | 5 006 $ | 15 595 $ | 23 392 $ | 2 112 $ | ja |
| ATR 72-200 HAM–NUE 1990 | 9 831 $ | 1 574 $ | 2 441 $ | 3 661 $ | 4 596 $ | ja |
| A320ceo FRA–MAD 1990 | 32 510 $ | 5 466 $ | 9 643 $ | 14 464 $ | 12 579 $ | ja |
| A320ceo FRA–MAD 1990 (LCC) | 26 092 $ | 3 188 $ | 9 652 $ | 14 478 $ | 8 426 $ | ja |
| A320ceo ATL–ORD 1990 | 29 624 $ | 5 648 $ | 8 343 $ | 12 515 $ | 11 461 $ | ja |
| A330-300 FRA–JFK 1995 | 140 345 $ | 17 589 $ | 48 208 $ | 72 312 $ | 50 444 $ | ja |
| A320ceo FRA–MAD 2019 | 50 290 $ | 8 061 $ | 15 961 $ | 23 942 $ | 18 287 $ | ja |
| A330-300 FRA–JFK 2019 | 193 990 $ | 23 853 $ | 93 392 $ | 140 088 $ | 30 049 $ | ja |
| 787-9 FRA–SIN 2019 | 298 666 $ | 28 724 $ | 122 393 $ | 183 589 $ | 86 353 $ | ja |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 4 566 $ | 1 264 $ | 2 441 $ | 3 661 $ | −359 $ | nein |
| A320ceo FRA–MAD 1990 × 0,25 | 10 736 $ | 2 216 $ | 9 643 $ | 14 464 $ | −5 944 $ | nein |
| A330-300 FRA–JFK 1995 × 0,25 | 19 269 $ | 2 439 $ | 48 208 $ | 72 312 $ | −55 483 $ | nein |

Vorteil = Erlös − Kosten je Fluggast − Charter-Gebühr (`charterAdvantage`, 8.9); die eigenen Flugkosten entfallen in beiden Fällen. Dazu kein Ruf-Abzug mit Charter (6.2).

### Beträge der Störungs-Frage gegen die Rechnung (Flughafen-Streik am Start-Flughafen, Monat, Strecken beim besten Preis)

| Strecke | Auslastung | Erlös im Mittel × Anteil | Erlösverlust (Frage) | Erlösverlust (Rechnung) | Vorteil Charter (Frage) | Vorteil Charter (Rechnung) | Gebühr Frage / gebucht |
|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 100 % | 266 529 $ | 266 529 $ | 266 529 $ (100 %) | 73 474 $ | 73 474 $ | 142 686 $ / 142 686 $ |
| 707-320B FRA–JFK 1965 | 100 % | 652 558 $ | 652 518 $ | 652 518 $ (100 %) | 19 671 $ | 19 671 $ | 571 640 $ / 571 640 $ |
| 727-200 FRA–MAD 1975 | 96 % | 477 590 $ | 448 533 $ | 448 533 $ (94 %) | 16 751 $ | 16 751 $ | 366 175 $ / 366 175 $ |
| ATR 72-200 HAM–NUE 1990 | 100 % | 359 088 $ | 359 088 $ | 359 088 $ (100 %) | 167 865 $ | 167 865 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 | 94 % | 1 187 419 $ | 1 102 529 $ | 1 102 529 $ (93 %) | 405 597 $ | 405 597 $ | 528 307 $ / 528 307 $ |
| A320ceo FRA–MAD 1990 (LCC) | 100 % | 816 878 $ | 816 383 $ | 816 383 $ (100 %) | 263 363 $ | 263 363 $ | 453 279 $ / 453 279 $ |
| A320ceo ATL–ORD 1990 | 96 % | 1 082 012 $ | 1 024 530 $ | 1 024 530 $ (95 %) | 387 373 $ | 387 373 $ | 457 107 $ / 457 107 $ |
| A330-300 FRA–JFK 1995 | 97 % | 2 196 906 $ | 2 039 220 $ | 2 039 220 $ (93 %) | 668 417 $ | 668 417 $ | 1 131 948 $ / 1 131 948 $ |
| A320ceo FRA–MAD 2019 | 95 % | 1 836 837 $ | 1 727 250 $ | 1 727 250 $ (94 %) | 602 020 $ | 602 020 $ | 874 473 $ / 874 473 $ |
| A330-300 FRA–JFK 2019 | 97 % | 3 036 638 $ | 2 852 610 $ | 2 852 610 $ (94 %) | 330 389 $ | 330 389 $ | 2 192 876 $ / 2 192 876 $ |
| 787-9 FRA–SIN 2019 | 100 % | 3 116 797 $ | 3 094 397 $ | 3 094 397 $ (99 %) | 882 930 $ | 882 930 $ | 1 915 886 $ / 1 915 886 $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 80 % | 207 714 $ | 207 714 $ | 207 714 $ (100 %) | 16 491 $ | 16 491 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 × 0,25 | 47 % | 901 706 $ | 816 876 $ | 816 876 $ (91 %) | 119 906 $ | 119 906 $ | 528 307 $ / 528 307 $ |
| A330-300 FRA–JFK 1995 × 0,25 | 16 % | 2 815 241 $ | 1 270 587 $ | 1 270 587 $ (45 %) | −1 517 810 $ | −1 517 810 $ | 2 641 213 $ / 2 641 213 $ |

Frage: `charterQuestionFigures` auf dem Monat mit der Störung (E76). Rechnung: derselbe Monat ohne Störung, gestrichen und gechartert (`monthOperations`), Vorteil = Monatsergebnis mit Charter − mit Streichen. „Erlös im Mittel × Anteil“ ist die alte Schätzung aus 5.2e: Beim Streichen verteilt das Modell die Fluggäste auf die übrigen Sitze (8.9), der echte Verlust ist darum kleiner, je mehr Sitze frei sind.

### Händler-Spanne: A320ceo (Flag-Kabine), gebaut Mai 1990

| Alter | Zelle / Kabine | Wert | Gebrauchtpreis | Verkaufserlös | mit größter Forschung | zurück nach Kauf und Verkauf | Verlust in Monatsergebnissen |
|---|---|---|---|---|---|---|---|
| 0 Jahre | 100 / 100 | 57,64 Mio. $ | 60,52 Mio. $ | 48,99 Mio. $ | 50,22 Mio. $ | 83,0 % | 16,20 |
| 5 Jahre | 87 / 78 | 43,98 Mio. $ | 46,18 Mio. $ | 37,39 Mio. $ | 38,32 Mio. $ | 83,0 % | 11,65 |
| 10 Jahre | 76 / 64 | 32,84 Mio. $ | 34,49 Mio. $ | 27,92 Mio. $ | 28,61 Mio. $ | 83,0 % | 8,20 |
| 20 Jahre | 54 / 36 | 14,46 Mio. $ | 15,19 Mio. $ | 12,29 Mio. $ | 12,60 Mio. $ | 83,0 % | 3,20 |

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
| A320ceo FRA–MAD 1990 | 134 | 0,20 Mio. $ | 0,19 Mio. $ | 0,39 Mio. $ | 0,71 Mio. $ | 0,5 |
| A320ceo FRA–MAD 2019 | 134 | 1,02 Mio. $ | 0,27 Mio. $ | 1,29 Mio. $ | 1,11 Mio. $ | 1,2 |
| A330-300 FRA–JFK 2019 | 318 | 1,71 Mio. $ | 0,65 Mio. $ | 2,36 Mio. $ | 0,93 Mio. $ | 2,5 |
| ATR 72-200 HAM–NUE 1990 | 69 | 0,04 Mio. $ | 0,10 Mio. $ | 0,14 Mio. $ | 0,25 Mio. $ | 0,6 |

`refitPrice` (8.13): `atCost(cabinListPrice)` + `refitLabour`. Der Lohn war früher Typ-Kapazität × 1 000 $ ohne Kostenindex. Wie oft umgebaut wird, zeigt der Verschleiß (B8.7, Kabine 50 nach etwa 6–7 Jahren auf Langstrecke).

### Verschleiß je Strecke (Flugplan der typischen Strecken, nichts gestrichen)

| Strecke | Blockstunden je Monat | Kabine je Jahr | Zelle je Jahr | Jahre bis Kabine 50 | Jahre bis Zelle 50 |
|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 45 | 1,8 | 1,6 | 27,1 | 31,0 |
| 707-320B FRA–JFK 1965 | 127 | 3,0 | 2,4 | 16,5 | 21,2 |
| 727-200 FRA–MAD 1975 | 47 | 1,9 | 1,6 | 26,6 | 30,6 |
| ATR 72-200 HAM–NUE 1990 | 63 | 2,1 | 1,8 | 23,7 | 28,2 |
| A320ceo FRA–MAD 1990 | 117 | 2,9 | 2,3 | 17,3 | 22,1 |
| A320ceo FRA–MAD 1990 (LCC) | 100 | 2,6 | 2,1 | 18,9 | 23,6 |
| A320ceo ATL–ORD 1990 | 84 | 2,4 | 2,0 | 20,8 | 25,5 |
| A330-300 FRA–JFK 1995 | 194 | 4,0 | 3,0 | 12,5 | 16,8 |
| A320ceo FRA–MAD 2019 | 117 | 2,9 | 2,3 | 17,3 | 22,1 |
| A330-300 FRA–JFK 2019 | 194 | 4,0 | 3,0 | 12,5 | 16,8 |
| 787-9 FRA–SIN 2019 | 205 | 4,2 | 3,1 | 12,0 | 16,3 |

Gebrauchtmarkt zum Vergleich: Zelle −2,2, Kabine −2,8 Punkte je Jahr (8.11).

### Kreditlinie für ein neues Flugzeug je Strecke

| Strecke | Kreditgrenze | feste Kosten je Monat | Grenze in Monaten fester Kosten | Kosten je Monat | Monatsergebnis | Zins bei voller Nutzung |
|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 4,89 Mio. $ | 0,23 Mio. $ | 21,3 | 0,31 Mio. $ | 0,13 Mio. $ | 0,033 Mio. $ |
| 707-320B FRA–JFK 1965 | 10,67 Mio. $ | 0,76 Mio. $ | 14,0 | 0,86 Mio. $ | 0,22 Mio. $ | 0,071 Mio. $ |
| 727-200 FRA–MAD 1975 | 9,62 Mio. $ | 0,52 Mio. $ | 18,4 | 0,65 Mio. $ | 0,14 Mio. $ | 0,064 Mio. $ |
| ATR 72-200 HAM–NUE 1990 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,34 Mio. $ | 0,25 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,27 Mio. $ | 0,71 Mio. $ | 0,192 Mio. $ |
| A320ceo FRA–MAD 1990 (LCC) | 28,82 Mio. $ | 0,85 Mio. $ | 34,0 | 1,01 Mio. $ | 0,35 Mio. $ | 0,192 Mio. $ |
| A320ceo ATL–ORD 1990 | 28,82 Mio. $ | 0,86 Mio. $ | 33,7 | 1,20 Mio. $ | 0,60 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 | 70,44 Mio. $ | 2,06 Mio. $ | 34,1 | 2,52 Mio. $ | 1,14 Mio. $ | 0,470 Mio. $ |
| A320ceo FRA–MAD 2019 | 41,10 Mio. $ | 1,47 Mio. $ | 28,0 | 1,96 Mio. $ | 1,11 Mio. $ | 0,274 Mio. $ |
| A330-300 FRA–JFK 2019 | 94,21 Mio. $ | 3,51 Mio. $ | 26,8 | 4,13 Mio. $ | 0,93 Mio. $ | 0,628 Mio. $ |
| 787-9 FRA–SIN 2019 | 132,74 Mio. $ | 3,64 Mio. $ | 36,5 | 4,14 Mio. $ | 1,06 Mio. $ | 0,885 Mio. $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,33 Mio. $ | −0,05 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 × 0,25 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,07 Mio. $ | −0,42 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 × 0,25 | 70,44 Mio. $ | 3,75 Mio. $ | 18,8 | 3,90 Mio. $ | −2,73 Mio. $ | 0,470 Mio. $ |

Feste Kosten = Treibstoff, Besatzung, Landung, Slot- und Flugzeug-Anteil (5.9); ohne Kosten der Gesellschaft. Kauf nur aus Guthaben; die Kreditlinie deckt laufende Verluste (8.14).

### Szenario „Oil Shock“ (LHR, Okt. 1973 bis Dez. 1976): Ruf am Stichtag je Ausstattung (Start 50)

| Ausstattung | Airline satisfaction | Ruf am Stichtag | Ziel 55 erreicht |
|---|---|---|---|
| LCC-Kabine, Zustand 60 | 72,6 | 36,3 | nein |
| Flag-Kabine, Zustand 60 (ohne Umbau) | 104,2 | 53,5 | nein |
| Flag-Kabine nach Umbau (Zustand 90) | 110,2 | 58,5 | ja |
| Boutique-Kabine nach Umbau (Zustand 90) | 108,8 | 57,4 | ja |

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

## 7 Konkurrenz und 3.13 Umsteiger: Langläufe ohne Spieler (Paket 3.9b)

### Unternehmenswert der Gründer, Zuschuss abgeschafft (Median, Preise von 1960; in Klammern ÷ Median aller)

| Nach Jahren | Median alle | flag | lcc | expansionist | optimizer | boutique | Faktor |
|---|---|---|---|---|---|---|---|
| 10 (1970) | 216 Mio. $ | 311 Mio. $ (1,44) | 215 Mio. $ (1,00) | 201 Mio. $ (0,93) | 189 Mio. $ (0,87) | 252 Mio. $ (1,16) | 1,44 |
| 20 (1980) | 229 Mio. $ | 333 Mio. $ (1,46) | 223 Mio. $ (0,98) | 162 Mio. $ (0,71) | 205 Mio. $ (0,89) | 296 Mio. $ (1,29) | 1,46 |
| 30 (1990) | 995 Mio. $ | 1 416 Mio. $ (1,42) | 1 160 Mio. $ (1,17) | 1 047 Mio. $ (1,05) | 980 Mio. $ (0,98) | 785 Mio. $ (0,79) | 1,42 |
| 40 (2000) | 1 535 Mio. $ | 2 808 Mio. $ (1,83) | 1 373 Mio. $ (0,89) | 2 321 Mio. $ (1,51) | 1 761 Mio. $ (1,15) | 987 Mio. $ (0,64) | 1,83 |
| 50 (2010) | 1 752 Mio. $ | 2 704 Mio. $ (1,54) | 1 625 Mio. $ (0,93) | 2 924 Mio. $ (1,67) | 1 719 Mio. $ (0,98) | 1 055 Mio. $ (0,60) | 1,67 |
| 60 (2020) | 2 011 Mio. $ | 3 440 Mio. $ (1,71) | 1 592 Mio. $ (0,79) | 3 762 Mio. $ (1,87) | 2 104 Mio. $ (1,05) | 1 251 Mio. $ (0,62) | 1,87 |

„Faktor“ = größtes Verhältnis einer Persönlichkeit zum Median aller, in beide Richtungen. Aufgelöste Gründer zählen mit 0.

### Gründer je Lauf am Ende (Drehkreuz: Unternehmenswert in Preisen von 1960)

| Lauf | flag | lcc | expansionist | optimizer | boutique |
|---|---|---|---|---|---|
| 0 | JFK: 3 355 Mio. $ | FRA: 1 727 Mio. $ | CDG: 2 216 Mio. $ | ATL: 2 597 Mio. $ | SYD: 1 427 Mio. $ |
| 1 | LHR: 4 515 Mio. $ | ORD: 1 736 Mio. $ | LAX: 3 943 Mio. $ | ATL: 3 164 Mio. $ | JFK: 1 104 Mio. $ |
| 2 | FRA: 3 602 Mio. $ | CDG: 1 534 Mio. $ | ATL: 5 780 Mio. $ | SYD: 1 994 Mio. $ | JFK: 1 249 Mio. $ |
| 3 | ORD: 2 784 Mio. $ | LAX: 881 Mio. $ | ATL: 3 464 Mio. $ | SYD: 1 180 Mio. $ | LHR: 1 338 Mio. $ |
| 4 | CDG: 3 332 Mio. $ | ATL: 1 999 Mio. $ | SYD: 714 Mio. $ | JFK: 3 145 Mio. $ | FRA: 1 097 Mio. $ |
| 5 | LAX: 2 939 Mio. $ | ATL: 1 551 Mio. $ | SYD: 3 864 Mio. $ | LHR: 1 834 Mio. $ | ORD: 1 405 Mio. $ |
| 6 | HND: 3 525 Mio. $ | ATL: 1 940 Mio. $ | JFK: 3 670 Mio. $ | FRA: 2 184 Mio. $ | CDG: 1 429 Mio. $ |
| 7 | ATL: 4 309 Mio. $ | SYD: 805 Mio. $ | LHR: 3 234 Mio. $ | ORD: 2 727 Mio. $ | LAX: 1 149 Mio. $ |
| 8 | ATL: 4 402 Mio. $ | JFK: 1 634 Mio. $ | FRA: 3 855 Mio. $ | CDG: 1 574 Mio. $ | HND: 1 254 Mio. $ |
| 9 | SYD: 2 517 Mio. $ | LHR: 1 360 Mio. $ | ORD: 3 890 Mio. $ | LAX: 2 023 Mio. $ | ATL: 1 083 Mio. $ |

Feste Drehkreuze nach `founderHub` (über 10 Läufe jedes einmal je Persönlichkeit); ist von dort keine Strecke mit Gewinn möglich, das nächste freie aus `FOUNDER_HUBS` (E71).

### Preise und Markt im laufenden Spiel (Mittel der Jahre, alle Haupt-Läufe)

| Jahrzehnt | Preis Y p10 | Preis Y Median | Preis Y p90 | Preiskampf | Gesellschaften je Paar | Paare mit ≥ 2 | Auslastung (Median) | Marge (Median) | Strecken mit Verlust |
|---|---|---|---|---|---|---|---|---|---|
| 1960er | 0,88 | 1,03 | 1,26 | 0,0 % | 1,01 | 1 % | 100 % | 19 % | 8 % |
| 1970er | 0,91 | 1,07 | 1,38 | 0,0 % | 1,00 | 0 % | 100 % | 9 % | 22 % |
| 1980er | 0,91 | 1,07 | 1,41 | 0,0 % | 1,00 | 0 % | 100 % | 27 % | 2 % |
| 1990er | 0,88 | 1,03 | 1,31 | 0,1 % | 1,01 | 1 % | 100 % | 33 % | 1 % |
| 2000er | 0,89 | 1,04 | 1,34 | 0,1 % | 1,01 | 1 % | 100 % | 20 % | 5 % |
| 2010er | 0,91 | 1,06 | 1,38 | 0,0 % | 1,01 | 1 % | 100 % | 31 % | 1 % |

Preis Y = Preisniveau Economy (`fareRatio`) je Strecke und Monat. Auslastung und Marge je Strecke und Monat aus dem Bericht des Abschlusses.

### Auslastung / Marge je Streckenlänge (Median je Jahr, Mittel der Jahre, Haupt-Läufe; E67)

| Jahrzehnt | kurz | Strecken | mittel | Strecken | lang | Strecken | mit Widebody |
|---|---|---|---|---|---|---|---|
| 1960er | 100 % / 20 % | 40 | 100 % / 18 % | 38 | 98 % / 14 % | 2 | 0 |
| 1970er | 100 % / 10 % | 89 | 100 % / 7 % | 55 | 100 % / −6 % | 3 | 0 |
| 1980er | 100 % / 25 % | 101 | 100 % / 29 % | 88 | 98 % / 30 % | 9 | 0 |
| 1990er | 100 % / 29 % | 119 | 100 % / 34 % | 200 | 99 % / 35 % | 66 | 1 |
| 2000er | 100 % / 23 % | 134 | 100 % / 20 % | 255 | 100 % / 12 % | 55 | 1 |
| 2010er | 100 % / 30 % | 140 | 100 % / 32 % | 305 | 100 % / 30 % | 47 | 1 |

kurz unter 1 000 km, mittel bis 3 500 km, lang darüber (Großkreis). „Strecken“ = KI-Strecken je Monat und Lauf. „mit Widebody“ = KI-Strecken mit einem Flugzeug der Klasse Widebody im Januar, je Lauf (E81).

### Preisniveau Economy je Persönlichkeit (Median, Mittel der Jahre)

| Jahrzehnt | flag | lcc | expansionist | optimizer | boutique |
|---|---|---|---|---|---|
| 1960er | 1,16 | 0,90 | 0,94 | 1,24 | 1,12 |
| 1970er | 1,21 | 0,93 | 0,96 | 1,49 | 1,15 |
| 1980er | 1,22 | 0,93 | 0,96 | 1,46 | 1,15 |
| 1990er | 1,13 | 0,91 | 0,92 | 1,21 | 1,14 |
| 2000er | 1,17 | 0,93 | 0,94 | 1,26 | 1,19 |
| 2010er | 1,22 | 0,94 | 0,96 | 1,33 | 1,23 |

### Preis-Sprünge von Monat zu Monat (|Δ Preisniveau Economy| je Strecke)

| Jahrzehnt | Optimizer Median | Optimizer p90 | Optimizer ≥ 0,25 | andere p90 | andere ≥ 0,25 |
|---|---|---|---|---|---|
| 1960er | 0,02 | 0,08 | 1,7 % | 0,02 | 0,0 % |
| 1970er | 0,03 | 0,09 | 1,1 % | 0,00 | 0,0 % |
| 1980er | 0,02 | 0,07 | 0,3 % | 0,02 | 0,0 % |
| 1990er | 0,02 | 0,06 | 0,2 % | 0,02 | 0,0 % |
| 2000er | 0,02 | 0,08 | 1,2 % | 0,02 | 0,0 % |
| 2010er | 0,02 | 0,07 | 0,4 % | 0,02 | 0,0 % |

„Sprung“ = Änderung um mindestens 0,25 Preisniveau in einem Monat (z. B. 1,20 → 1,45).

### Umsteiger in Märkten mit Direktangebot (Januar, Mittel der Haupt-Läufe)

| Januar | Paare | Anteil Median | Anteil p90 | Wunsch Median | Paare über 25 % | Anteil gesamt | Umsteiger ohne Direktangebot je Woche |
|---|---|---|---|---|---|---|---|
| 1965 | 4 | 0,0 % | 0,2 % | 20,6 % | 0,0 % | 0,0 % | 3 388 |
| 1970 | 12 | 0,0 % | 2,0 % | 16,9 % | 1,1 % | 0,0 % | 4 797 |
| 1975 | 4 | 0,0 % | 0,0 % | 22,6 % | 0,0 % | 0,0 % | 1 034 |
| 1980 | 7 | 0,0 % | 2,3 % | 17,5 % | 2,5 % | 0,0 % | 3 499 |
| 1985 | 20 | 0,0 % | 0,9 % | 15,6 % | 0,0 % | 0,0 % | 10 156 |
| 1990 | 35 | 0,0 % | 1,5 % | 15,7 % | 0,4 % | 0,1 % | 17 854 |
| 1995 | 54 | 0,0 % | 0,7 % | 15,9 % | 0,0 % | 0,1 % | 19 468 |
| 2000 | 69 | 0,0 % | 1,1 % | 15,5 % | 0,3 % | 0,1 % | 30 313 |
| 2005 | 60 | 0,0 % | 0,5 % | 15,9 % | 0,3 % | 0,1 % | 28 453 |
| 2010 | 65 | 0,0 % | 6,0 % | 14,5 % | 1,5 % | 0,3 % | 81 052 |
| 2015 | 78 | 0,0 % | 1,4 % | 18,1 % | 0,7 % | 0,1 % | 37 337 |
| 2020 | 81 | 0,0 % | 1,4 % | 18,0 % | 0,7 % | 0,1 % | 43 271 |

Anteil = platzierte Umsteiger ÷ (Direktgäste + Umsteiger) je Paar O–D mit Direktangebot und Umsteige-Verbindung. „Wunsch“ = vor der Verteilung auf freie Sitze. `CONNECTION_APPEAL` = 0,50.

### Wachstum der KI (Mittel der Jahre, Haupt-Läufe)

| Jahrzehnt | KI | Flugzeuge je KI | Eröffnungen je KI und Jahr | Käufe je KI und Jahr | Schließungen je KI und Jahr | Verkäufe je KI und Jahr | neue Drehkreuze je Jahr | Nachrücker je Jahr | Auflösungen je Jahr |
|---|---|---|---|---|---|---|---|---|---|
| 1960er | 5,0 | 18 | 3,7 | 2,7 | 0,9 | 0,1 | 0,15 | 0,00 | 0,00 |
| 1970er | 5,0 | 30 | 3,5 | 2,2 | 3,7 | 2,2 | 0,22 | 0,00 | 0,00 |
| 1980er | 5,0 | 42 | 3,8 | 3,6 | 0,4 | 1,8 | 0,16 | 0,00 | 0,00 |
| 1990er | 5,0 | 79 | 3,4 | 3,2 | 0,2 | 2,1 | 0,18 | 0,00 | 0,00 |
| 2000er | 5,0 | 89 | 2,8 | 1,6 | 3,0 | 5,3 | 0,12 | 0,00 | 0,00 |
| 2010er | 5,0 | 99 | 1,9 | 1,5 | 0,4 | 4,5 | 0,04 | 0,00 | 0,00 |

### Geld und Slots der KI je Jahr (Preise von 1960, Mittel je lebender KI, Haupt-Läufe)

| Jahrzehnt | Erlös | Ergebnis | Zuschuss | Dividende | Kasse (Januar) | Slot-Haltungen an der eigenen Grenze | größter KI-Anteil an einem Flughafen |
|---|---|---|---|---|---|---|---|
| 1960er | 109 Mio. $ | 16 Mio. $ | 0 Mio. $ | 3 Mio. $ | 24 Mio. $ | 0,2 % | 18 % |
| 1970er | 187 Mio. $ | 11 Mio. $ | 0 Mio. $ | 4 Mio. $ | 74 Mio. $ | 0,4 % | 23 % |
| 1980er | 383 Mio. $ | 104 Mio. $ | 0 Mio. $ | 27 Mio. $ | 200 Mio. $ | 1,1 % | 26 % |
| 1990er | 1 040 Mio. $ | 331 Mio. $ | 0 Mio. $ | 225 Mio. $ | 678 Mio. $ | 2,1 % | 27 % |
| 2000er | 1 240 Mio. $ | 210 Mio. $ | 0 Mio. $ | 168 Mio. $ | 1 008 Mio. $ | 1,9 % | 28 % |
| 2010er | 1 394 Mio. $ | 406 Mio. $ | 0 Mio. $ | 331 Mio. $ | 973 Mio. $ | 2,7 % | 28 % |

Slot-Haltung = eine KI mit Slots an einem Flughafen; Grenze = `rivalSlotCap` (25 % am Drehkreuz, sonst 10 %, 7.10).

### KI-Stärke: Gründer nach 40 Jahren (mit Zuschuss)

| Stärke | Läufe | Median Unternehmenswert | Flugzeuge je Gründer | aufgelöste Gründer |
|---|---|---|---|---|
| easy | 3 | 692 Mio. $ | 34 | 0 |
| normal | 10 | 1 535 Mio. $ | 91 | 0 |
| hard | 3 | 1 670 Mio. $ | 107 | 0 |

### Rechenzeit (ein Prozess, alle Flughäfen der Daten)

| Jahrzehnt | ms je Monat | KI-Strecken |
|---|---|---|
| 1960er | 185 | 83 |
| 1970er | 424 | 136 |
| 1980er | 657 | 193 |
| 1990er | 1 203 | 362 |
| 2000er | 1 576 | 442 |
| 2010er | 1 710 | 496 |
| ganzer Lauf | 9,0 min |  |

Gemessen während mehrere Läufe gleichzeitig rechneten; ein einzelner Lauf ist etwas schneller.

