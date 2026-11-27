# Balance-Bericht

Erzeugt mit `npm run balance` aus `src/balance/` (Pakete 3.9a–3.9c; Langläufe mit `--long`). Alle Zahlen kommen aus den Funktionen in `src/model/`
mit den Startwerten aus `src/model/constants.ts`; das Skript ändert keine Konstante. Bewertung und Empfehlungen:
`docs/neubau/BALANCE.md`.

Urteile: **ok** = Regel der Spezifikation gilt; **Abweichung** = Regel gilt nicht (Entscheidung nötig);
**Info** = keine feste Grenze in der Spezifikation, Wert zur Bewertung.

Prüfregeln: 19 ok · 2 Abweichung · 33 Info.

## Übersicht der Prüfregeln

| Nr. | Spez. | Regel | Wert | Urteil |
|---|---|---|---|---|
| B1.1 | 1.3, 5.2 | Treibstoff (Tabelle) gegenüber Kostenindex: wie stark verschiebt sich das Verhältnis 1960 → 2020 (Grundlage der Langstrecken-Marge, 5.18) | Treibstoff ÷ Kostenindex 2020 = 1,24 (1960 = 1) | Info |
| B2.1 | 2.10 | `satisfactionFactor(50)` liegt bei 0,75 (± 0,05) | 0,750 | ok |
| B2.2 | 2.6.2, 7.4 | Stärke der Service-Abzüge: Satisfaction der LCC (kein Service, dichte Kabine) auf Kurzstrecke; Ausgleich über Preis-Lage 0,95 (7.4) | LCC Economy FRA–CDG: 89 → Faktor 0,95 | Info |
| B3.1 | 3.3 | Die Summe der Marktgrößen aller Paare wächst 1960 → 2019 um × 1,9 (± 10 %, E64, E108) | Summe 1,90, Mittel der Verhältnisse 2,50, Median 1,71 (115 440 Paare) | ok |
| B3.2 | 3.7 | Premium-Anteil schwankt über alle Paare: 5 %- bis 95 %-Wert mindestens 3 Prozentpunkte auseinander (1990) | 6,9 % … 11,1 % (4,1 Pp.) | ok |
| B3.3 | 3.4 | Entfernungs-Faktor kurz : lang (45 min : 20 h); Startwert 5,2 | 2,68 | Info |
| B3.4 | 3.9.3 | Stärke von `FLIGHT_TIME_EXP`: Anziehung Turboprop ÷ Jet bei sonst gleichem Angebot | FRA–CDG 0,72, FRA–MAD 0,65 | Info |
| B3.5 | 1.8 | Stärke der Schwierigkeit: Fluggäste des Spielers auf Hard gegenüber Normal (gegen einen gleichen Rivalen) | −5,7 % | Info |
| B4.1 | 3.6, 4.10 | Marktgröße gegenüber einem Flugzeug: Strecken, die selbst beim höchsten Preisniveau voll bleiben (Hinweis aus 3.8b) | keine | Info |
| B4.2 | 4.10, 7.6, E103 | Wechselseitige beste Antworten zweier gleicher Gesellschaften laufen nicht gegen 0: tiefster Preis ≥ 90 % der Gewinnschwelle voller Maschine; mit einem Flugzeug je Gesellschaft (erster Fall) auch Ergebnis > 0. Ein Verlust mit mehr Sitzen, als der Markt füllt, kommt aus der Überkapazität, nicht aus dem Unterbieten (Paket 3.9d, E103) | 14 Abflüge: tiefster Preis Y 1,88, Schwelle 0,87 (217 %), Ergebnis 234 684 $; 28 Abflüge: tiefster Preis Y 1,41, Schwelle 0,76 (185 %), Ergebnis 204 936 $ | ok |
| B4.3 | 7.6 | Enden die besten Antworten in einem festen Punkt? Nicht verlangt (7.6, E65); verlangt ist B4.2 | 14 Abflüge: fest; 28 Abflüge: Zyklus | Info |
| B4.4 | 4.10 | Bester Preis gegen einen gleichen Rivalen beim Marktpreis (Hinweis 4.10: 70 % des Marktpreises) | 14 Abflüge: 1,88; 28 Abflüge: 1,41 | Info |
| B4.5 | 3.6, 4.10 | Empfindlichkeit: bester Preis Y eines A320ceo allein auf FRA–MAD 1990 bei kleinerer Marktgröße | × 1,00: 2,00; × 0,50: 1,53; × 0,25: 1,04; × 0,10: 1,03 | Info |
| B5.1 | 5.5 | Landegebühr auf Kurzstrecke 26–40 % der Kosten (Hinweis 5.5 / 5.18) | Caravelle III FRA–CDG 1962: 31 %; ATR 72-200 HAM–NUE 1990: 28 % | ok |
| B5.2 | 5.18 | Marge beim besten Preis: Langstrecke gegenüber Kurz- und Mittelstrecke (Hinweis 5.18: Langstrecke sehr einträglich) | Lang Ø 39 %, kurz/mittel Ø 43 % | Info |
| B5.3 | 5.6 | Check-in und Abfertigung ohne Bodenpersonal-Aufschlag: Anteil an den Kosten (heute mit Bodenpersonal 2–4 % mehr) | 3 % … 17 % | Info |
| B5.4 | 5.13, E54 | Listenpreise und Abschreibung: Jahre, bis eine Strecke den Kaufpreis eines neuen Flugzeugs einspielt | 1,2 … 12,5 Jahre | Info |
| B5.5 | E7 | Eine gut geführte Strecke jeder Länge bringt in jedem Jahrzehnt Gewinn (alle Fälle beim besten Preis) | 11 von 11 mit Gewinn | ok |
| B5.6 | 7.4, E45 | Vorschau „ähnlicher Erfolg“: Ergebnis LCC ÷ Flag mit demselben Flugzeug allein auf derselben Strecke | A320ceo FRA–MAD 1990: 0,64 (Marge 43 % gegen 50 %) | Info |
| B6.1 | 6.1, E36 | Ruf-Ziel bei üblicher Satisfaction um 50: Median der Ruf-Ziele aller Ausstattungen (5 Persönlichkeiten × 2 Strecken, ohne Forschung) in 40 … 60 | Median 46,9; Flag: A320ceo FRA–MAD 1990 Satisfaction 124 → 69,6, A330-300 FRA–JFK 1995 Satisfaction 105 → 54,5 | ok |
| B6.2 | 6.1 | Steigungen 0,5 (unter 100) und 0,83 (über 100): Spanne der Ruf-Ziele aller Ausstattungen, mit und ohne Forschung | 24,1 … 76,3 (Satisfaction 48 … 132) | Info |
| B6.3 | 6.2, 8.6 | `CANCELLED_REPUTATION_WEIGHT` = 100: erwarteter Abzug im Ruf-Ziel und Wirkung eines Defekts (ohne Charter) | erwartet Alter 0: 0,70, Alter 10: 1,16, Alter 20: 1,62 Punkte; ein Defekt bei 1 Flugzeug: Ruf −7,5 im Monat, 13 Monate bis < 1 Punkt; bei 10 Flugzeugen −0,75 | Info |
| B6.4 | 6.3, E37 | Werbung hebt den Ruf im Gleichgewicht um höchstens 3 Punkte und klingt nach dem Ende ab | größter Anstieg 3,00 (alle drei Kampagnen); Nachfrage-Wirkung über den Ruf 0,6 % | ok |
| B6.9 | 3.9.5, 5.14 | Werbung: Kosten je Monat ÷ Mehr-Ergebnis je Strecke (Strecken, ab denen eine Kampagne sich trägt) | 1990 local 25,9; 1990 national 35,6; 1990 global 50,9; 2019 local 24,8; 2019 national 34,7; 2019 global 50,1 | Info |
| B6.5 | 6.7, E36 | Ruf-Schwellen der Ränge: Rang 9 (Ruf 65) ist mit der besten Ausstattung und Forschung erreichbar; Rang 5 (Ruf 50) mit üblicher (Flag) Ausstattung | bestes Ziel 76,3 (ohne Forschung 69,6); Flag ohne Forschung ≥ 54,5 | ok |
| B6.6 | 6.10 | Ruf-Meilensteine 60 / 70 / 80: Satisfaction, die sie brauchen, und ob eine Ausstattung sie erreicht | 60 → Satisfaction 112, 70 → Satisfaction 124, 80 → Satisfaction 136; Gold mit keiner KI-Ausstattung erreichbar; beste Spieler-Ausstattung: Flag FRA–MAD 81,9 (mit Werbung 84,9), Boutique FRA–MAD 78,8 (mit Werbung 81,8), Flag FRA–JFK 66,3 (mit Werbung 69,3), Boutique FRA–JFK 62,2 (mit Werbung 65,2) | Info |
| B6.7 | 6.8 | Eine Gesellschaft, die die Bedingungen eines Rangs gerade erfüllt, bezahlt die Klassen-Forschung dieses Rangs aus höchstens 12 Monatsergebnissen | Rang 1: 5,0 (bei Marge 10 %: 22,7); Rang 2: 4,7 (bei Marge 10 %: 23,8); Rang 4: 1,4 (bei Marge 10 %: 6,7); Rang 5: 3,0 (bei Marge 10 %: 12,5) | ok |
| B6.8 | 6.11, E58 | Ziel-, Prämien- und Straf-Anteile: Prämie in Monatsergebnissen und nötige Chance, damit das hohe Ziel mehr bringt als das sichere | Prämie sicher / hoch = 0,24 / 0,60 Monatsergebnisse (ohne Mindestbetrag); hohes Ziel lohnt ab Chance 60 % … 60 %; Mindestprämie bindet bei 1 von 6 Beispielen (gestaffelt nach Art, E83: auch dann zahlt das hohe Ziel mehr) | Info |
| B7.13 | 7.11, E81, E84, E85 | Größte Langstrecken-Paare (über 3 500 km, beide Flughäfen ab Größe 3): bringt der beste Widebody der KI mehr als der beste Narrowbody? | 37 von 49 Paaren vor Kapitalkosten (Planer-Zahl), 37 von 49 nach Kapitalkosten (1990, 2000, 2010, je 20 Paare) | Info |
| B7.14 | 7.11, E81, E84, E85 | Paare über 7 500 km (fast nur Widebodies haben die Reichweite): Widebody vorn und nach Kapitalkosten mit Gewinn | Widebody vorn auf 29 von 30 Paaren, davon mit Gewinn nach Kapitalkosten 29 | Info |
| B8.1 | 8.5 | Preis-Absicherung (`HEDGE_PRICE_SHARE` = 0,35): Ersparnis ÷ Preis je Ölkrise | 1973 Oil Crisis: 2,64; 1979 Energy Crisis: 1,42; Gulf War Oil Shock: 1,05 | Info |
| B8.2 | 8.5 | Rückgewinnung (`RECOVERY_PRICE_SHARE` = 0,25): Mehr-Ergebnis ÷ Preis (A320ceo FRA–MAD allein, Preis vor der Krise fest) | Downturn × 1,00: 2,69; Downturn × 0,25: 1,45; Financial × 1,00: 2,57; Financial × 0,25: 1,38; Pandemic × 1,00: 2,12; Pandemic × 0,25: 0,72 | Info |
| B8.3 | 8.9, E32 | `CHARTER_MARKUP`: Charter lohnt gegenüber Streichen auf jeder Strecke mit Gewinn (Vorteil je Flug > 0) | 11 von 11 Strecken mit Gewinn; kleinster Vorteil 2 170 $ je Flug (Gebühr ÷ Erlös je Flug 28 % … 171 %) | ok |
| B8.10 | 8.9, E76, R2 | Beträge der Störungs-Frage (`charterQuestionFigures`, Flughafen-Streik 60 %) = Rechnung des Monats mit und ohne Charter (Erlösverlust, Gebühr, Vorteil) | 14 von 14 Fällen gleich; echter Erlösverlust ÷ Erlös im Mittel 91 % … 100 % (so weit lag die Schätzung bis 5.3a daneben) | ok |
| B8.4 | 8.11, E30 | Händler-Spanne −15 % / +5 %: Gebraucht kaufen und sofort verkaufen bringt höchstens 83,0 % zurück; Verlust in Monatsergebnissen einer Strecke | höchstens 83,0 %; Verlust Kauf→Verkauf Alter 0: 8,74, Alter 5: 6,28, Alter 10: 4,42, Alter 20: 1,73 Monatsergebnisse (A320ceo FRA–MAD) | ok |
| B8.5 | 8.12, E30 | Vorbestell-Rabatt höchstens 12 % < 12,9 % (Vorbestellen und sofort verkaufen bringt nie Gewinn); Rabatt als Ertrag der Anzahlung | Rabatt 5 … 12 %; sofort verkauft −0,9 % des Werts; Rabatt ÷ Anzahlung je Jahr 23 % … 42 % (Kreditzins 8 %) | ok |
| B8.6 | 8.13, E31 | Überholung (`OVERHAUL_PRICE_SHARE` = 0,04): Preis ≥ Wertgewinn; wo bindet der Mindestpreis? | Preis ≥ Wertgewinn in 5 von 5 Fällen; Mindestpreis bindet in 0; Defekt-Chance sinkt um 1,33 % / 0,40 % / 1,33 % / 1,33 % / 0,80 % je Monat | ok |
| B8.11 | 8.13 | Kabinen-Umbau (Kabine + `REFIT_PER_SEAT_1960` × Sitze, mit Kostenindex): Preis in Monatsergebnissen der Strecke | A320ceo FRA–MAD 1990: 0,3 (Lohn 0,15); A320ceo FRA–MAD 2019: 0,7 (Lohn 0,15); A330-300 FRA–JFK 2019: 0,9 (Lohn 0,25); ATR 72-200 HAM–NUE 1990: 1,4 (Lohn 0,94) | Info |
| B8.7 | 8.10 | Verschleiß mit `WEEKS_PER_MONTH`: Punkte je Jahr und Jahre bis Zustand 50 (Kabine / Zelle) bei typischem Flugplan | 45 … 452 Stunden je Monat; Kabine 1,8 … 7,7, Zelle 1,6 … 5,3 Punkte je Jahr | Info |
| B8.8 | 8.14, E34 | Kreditlinie (8 % Zins, Grenze `CREDIT_LIMIT_SHARE` × Flottenwert): Grenze in Monaten fester Strecken-Kosten; Zins bei voller Nutzung gegen das Monatsergebnis | Grenze = 4,5 … 33,7 Monate fester Kosten; Zins = 5 % … 50 % des Monatsergebnisses | Info |
| B8.9 | 8.15, 6.15 | Szenario „Oil Shock“: Ruf 55 bis zum Stichtag ist mit einer besseren Kabine erreichbar, aber nicht ohne Zutun | nach 39 Monaten: LCC-Kabine, Zustand 60 28,0; Flag-Kabine, Zustand 60 (ohne Umbau) 52,3; Flag-Kabine nach Umbau (Zustand 90) 58,2; Boutique-Kabine nach Umbau (Zustand 90) 57,5 | ok |
| B7.1 | 7.4 | Ähnlicher Erfolg (Zuschuss abgeschafft): Median des Unternehmenswerts je Persönlichkeit nach 20 und 40 Jahren innerhalb Faktor 2 des Medians aller | Faktor 1,30 nach 20, 2,54 nach 40 Jahren (schwächste: boutique, stärkste: flag; 10 Läufe) | **Abweichung** |
| B7.2 | 7.14 | Abschaffung des Zuschusses | abgeschafft (E68, `RIVAL_SUBSIDY_ENABLED = false`); die Haupt-Läufe sind Läufe ohne Zuschuss | Info |
| B7.3 | 7.6 | Preise und Preiskampf im laufenden Spiel (Nachweis zu O60) | Preisniveau Y Median 1,03, p10 0,86; Preiskampf 0,6 % der Strecken; 1,03 Gesellschaften je Paar; Auslastung 100 %; Marge 26 % | Info |
| B7.4 | 7.6, E65 | Störende Sprünge der Optimizer-Preise (Schritte ≥ 0,25 je Monat) | Optimizer 0,7 % der Strecken-Monate (p90 0,08), andere 0,0 % | Info |
| B7.10 | 3.6, E67 | Marktgröße: typische KI-Strecke mit Marge 10 %–25 % (Median, Mittel der Jahre). Auslastung nur Info (E71): Ziel 75 %–90 % gilt für den Spieler beim besten Preis; die KI fliegt ihre Paare meist allein und wählt eine volle Maschine | Marge 26 %; Auslastung 100 % (Info) | **Abweichung** |
| B3.13 | 3.13 | Umsteiger in Märkten mit Direktangebot typisch unter 25 % | Median je Paar 0,0 %, p90 8,4 %; Paare über 25 %: 3,4 % | ok |
| B7.5 | 7.10 | Slot-Anteile der KI | Haltungen an der eigenen Grenze 1,9 %; größter KI-Anteil an einem Flughafen 34 % | Info |
| B7.11 | 5.10, 7.10, E78 | Widebody-Slots erst ab Flughafengröße 3: keine KI-Strecke mit Widebody an einem kleineren Flughafen | Strecken mit Widebody je Jahr (Januar) im Mittel 44,5; davon an Flughäfen unter Größe 3: 0 (alle Jahre und Läufe) | ok |
| B7.12 | 7.11, E81 | Langstrecke der KI: Anteil der KI-Strecken über 3 500 km ab 1990 deutlich über 5 % (Ziel aus O76) | 34,0 % der Strecken-Monate; Strecken mit Widebody (Januar) ab 1990 im Mittel 74,9 je Lauf | ok |
| B7.6 | 7.13 | Dividende und neue Drehkreuze (`NEW_HUB_MIN_SEATS`) | Dividende je KI und Jahr 370 Mio. $ (1960); neue Drehkreuze 7,7 je Lauf | Info |
| B7.7 | 7.9, 7.11 | Eröffnungen und Käufe je Jahr | je KI und Jahr: 3,0 Eröffnungen, 2,4 Käufe, 1,5 Schließungen | Info |
| B7.9 | 7.9 | Rechenzeit der KI-Planung mit allen Flughäfen | 1 130 ms je Monat in den 2010ern; 11,2 min je Lauf | Info |
| B7.8 | 7.3 | KI-Stärke-Werte: Easy < Normal < Hard im Erfolg | easy 1 995 Mio. $, normal 2 864 Mio. $, hard 2 812 Mio. $ | Info |

## Abschnitt 1: Zeit und Geld

### Kostenindex, Nachfrage-Wachstum, Treibstoff, Marktpreis (Januar)

| Jahr | costIndex | demandGrowth | Treibstoff je Gallone | Treibstoff ÷ Index (1960 = 1) | Marktpreis Y FRA–MAD |
|---|---|---|---|---|---|
| 1960 | 1,00 | 1,00 | 1,05 $ | 1,00 | 98 $ |
| 1970 | 1,13 | 1,07 | 1,55 $ | 1,31 | 111 $ |
| 1980 | 1,27 | 1,15 | 2,92 $ | 2,19 | 125 $ |
| 1990 | 1,43 | 1,23 | 1,20 $ | 0,80 | 141 $ |
| 2000 | 1,61 | 1,32 | 1,72 $ | 1,02 | 158 $ |
| 2010 | 1,82 | 1,41 | 2,64 $ | 1,39 | 178 $ |
| 2020 | 2,05 | 1,51 | 2,66 $ | 1,24 | 201 $ |
| 2030 | 2,30 | 1,62 | 2,39 $ | 0,99 | 227 $ |

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
| HAM–NUE (klein, kurz) | 465 | 1 276 | 1 552 | 1 640 | 1 712 | 1 380 | 86,3 % / 7,2 % / 5,3 % / 1,3 % |
| FRA–CDG (groß, kurz) | 449 | 7 303 | 9 228 | 11 066 | 11 373 | 8 623 | 86,0 % / 7,2 % / 5,4 % / 1,3 % |
| FRA–MAD (Mittelstrecke) | 1 420 | 3 537 | 4 829 | 5 228 | 6 461 | 5 103 | 84,9 % / 7,7 % / 5,9 % / 1,5 % |
| ATL–ORD (US-Inland) | 976 | 5 419 | 10 217 | 9 213 | 8 047 | 5 704 | 86,8 % / 7,0 % / 4,9 % / 1,2 % |
| FRA–JFK (Langstrecke) | 6 189 | 4 486 | 4 870 | 4 810 | 4 501 | 3 610 | 80,2 % / 9,6 % / 7,6 % / 2,6 % |
| FRA–SIN (sehr lang) | 10 278 | 981 | 1 795 | 2 885 | 3 394 | 2 974 | 76,7 % / 11,0 % / 8,9 % / 3,4 % |

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
| Easy | 1,10 | 1,4 % | 5,2 % | 14 % |
| Normal | 1,00 | 0,0 % | 0,0 % | 14 % |
| Hard | 0,90 | −1,6 % | −5,7 % | 13 % |

Viele Abflüge, damit die Sitze nicht begrenzen. Allein wirkt der Faktor nur gegen „Nicht fliegen“ (1.8).

## Abschnitt 4: Preis und Erlös

### Preis und Auslastung typischer Strecken (eine Gesellschaft, Mai)

| Strecke | Marktgröße | Abflüge je Woche | Sitze je Woche | Auslastung bei Marktpreis | Auslastung bei Preisniveau 4 | Bester Preis (Niveau je Klasse) | Auslastung beim besten Preis | Gewinnschwelle voll | Gewinnschwelle bei dieser Auslastung |
|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 7 674 | 14 | 994 | 100 % | 25 % | 2,60 | 100 % | 1,29 | 1,29 |
| 707-320B FRA–JFK 1965 | 4 785 | 14 | 1 918 | 100 % | 6 % | 1,57 / 1,61 / 1,38 / 1,14 | 100 % | 0,92 | 0,92 |
| 727-200 FRA–MAD 1975 | 4 829 | 14 | 1 918 | 99 % | 10 % | 1,91 / 1,61 / 1,45 / 1,52 | 97 % | 1,07 | 1,10 |
| ATR 72-200 HAM–NUE 1990 | 1 640 | 14 | 966 | 100 % | 4 % | 1,35 | 100 % | 1,03 | 1,03 |
| A320ceo FRA–MAD 1990 | 5 228 | 14 | 1 876 | 99 % | 10 % | 2,00 / 1,63 / 1,47 / 1,50 | 97 % | 0,87 | 0,88 |
| A320ceo FRA–MAD 1990 (LCC) | 5 228 | 14 | 2 828 | 100 % | 2 % | 1,14 | 100 % | 0,65 | 0,65 |
| A320ceo ATL–ORD 1990 | 9 213 | 14 | 1 876 | 100 % | 20 % | 2,52 / 2,04 / 1,82 / 1,74 | 97 % | 1,01 | 1,03 |
| A330-300 FRA–JFK 1995 | 4 912 | 14 | 4 452 | 96 % | 3 % | 1,19 / 1,00 / 0,92 / 1,07 | 96 % | 0,51 | 0,53 |
| A320ceo FRA–MAD 2019 | 5 117 | 14 | 1 876 | 99 % | 11 % | 2,05 / 1,62 / 1,47 / 1,50 | 97 % | 0,93 | 0,95 |
| A330-300 FRA–JFK 2019 | 3 635 | 8 | 2 544 | 97 % | 3 % | 1,26 / 1,10 / 0,94 / 0,97 | 98 % | 0,71 | 0,72 |
| 787-9 FRA–SIN 2019 | 3 000 | 8 | 2 432 | 98 % | 3 % | 1,13 / 1,08 / 0,95 / 0,91 | 99 % | 0,63 | 0,64 |

Bester Preis nach 4.10 (gewinnbest, Kosten je Fluggast abgezogen). Abflüge: gewinnbeste gerade Zahl bis 14 (787-9: 8) beim besten Preis (`bestDeparturesCase`). Gewinnschwelle als Preisniveau für alle Klassen (4.11).

### Empfindlichkeit: Marktgröße × Faktor (wie ein kleineres `DEMAND_SCALE`), ein Flugzeug allein

| Strecke | × 1,00: Preis Y / Auslastung / Marge | × 0,50: Preis Y / Auslastung / Marge | × 0,25: Preis Y / Auslastung / Marge | × 0,10: Preis Y / Auslastung / Marge |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 1,35 / 100 % / 23 % | 1,04 / 80 % / −18 % | 1,04 / 40 % / −108 % | 1,04 / 16 % / −380 % |
| A320ceo FRA–MAD 1990 | 2,00 / 97 % / 50 % | 1,53 / 91 % / 32 % | 1,04 / 80 % / −3 % | 1,03 / 32 % / −127 % |
| A330-300 FRA–JFK 1995 | 1,19 / 96 % / 49 % | 0,89 / 68 % / 14 % | 0,89 / 34 % / −59 % | 0,89 / 14 % / −277 % |

Der Faktor wirkt als weltweites Ereignis im Beispiel-Spielstand (3.5), also genau wie eine andere Marktgröße; keine Konstante wird geändert.

### Preiskampf: zwei gleiche Gesellschaften (A320ceo, Flag-Ausstattung) auf FRA–MAD 1990, abwechselnd bester Preis

| Abflüge je Gesellschaft | Erste Antwort Y | Verlauf Y (Gesellschaft a) | fest | Endpreis (Niveau je Klasse) | Gewinnschwelle voll | Auslastung | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|
| 14 | 1,88 | 1,88 → 1,88 → 1,88 | ja | 1,88 / 1,33 / 1,15 / 1,39 | 0,87 | 97 % | 234 684 $ |
| 28 | 1,41 | 1,41 → 1,41 → 1,41 → 1,41 | nein, Zyklus | 1,41 / 0,77 / 0,78 / 1,46 | 0,76 | 88 % | 204 936 $ |

Jede Runde: a antwortet auf b, dann b auf a (`bestFareRatios`). 14 Abflüge = ein Flugzeug, 28 = zwei Flugzeuge je Gesellschaft (eine Strecke, mehr Sitze als der Markt füllt; bis Paket 3.9d 56 = vier Flugzeuge, bei der kleineren Marktgröße nur noch Überkapazität).

## Abschnitt 5: Kosten

### Erlös, Kosten und Ergebnis je Woche beim besten Preis

| Strecke | Erlös | Kosten | Ergebnis | Marge | Treibstoff | Landung | Gebühren je Fluggast | Verpflegung | Besatzung | Flugzeug-Anteil | Slots | Jahre bis Kaufpreis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 145 068 $ | 72 096 $ | 72 973 $ | 50 % | 16 % | 31 % | 16 % | 11 % | 4 % | 18 % | 5 % | 2,6 |
| 707-320B FRA–JFK 1965 | 979 798 $ | 624 863 $ | 354 935 $ | 36 % | 67 % | 9 % | 4 % | 10 % | 6 % | 4 % | 1 % | 1,2 |
| 727-200 FRA–MAD 1975 | 499 638 $ | 321 173 $ | 178 465 $ | 36 % | 46 % | 19 % | 8 % | 15 % | 3 % | 8 % | 1 % | 2,1 |
| ATR 72-200 HAM–NUE 1990 | 103 671 $ | 79 336 $ | 24 334 $ | 23 % | 8 % | 28 % | 14 % | 14 % | 7 % | 26 % | 3 % | 12,5 |
| A320ceo FRA–MAD 1990 | 605 945 $ | 302 608 $ | 303 337 $ | 50 % | 16 % | 24 % | 10 % | 19 % | 5 % | 25 % | 2 % | 3,6 |
| A320ceo FRA–MAD 1990 (LCC) | 454 637 $ | 259 617 $ | 195 021 $ | 43 % | 19 % | 28 % | 17 % | 0 % | 5 % | 29 % | 2 % | 5,6 |
| A320ceo ATL–ORD 1990 | 620 174 $ | 286 263 $ | 333 911 $ | 54 % | 12 % | 26 % | 10 % | 21 % | 3 % | 26 % | 2 % | 3,3 |
| A330-300 FRA–JFK 1995 | 2 183 358 $ | 1 109 984 $ | 1 073 373 $ | 49 % | 44 % | 9 % | 6 % | 16 % | 8 % | 16 % | 0 % | 2,5 |
| A320ceo FRA–MAD 2019 | 868 992 $ | 460 859 $ | 408 133 $ | 47 % | 22 % | 22 % | 9 % | 18 % | 4 % | 23 % | 2 % | 3,9 |
| A330-300 FRA–JFK 2019 | 1 800 237 $ | 1 196 874 $ | 603 364 $ | 34 % | 50 % | 6 % | 5 % | 12 % | 6 % | 20 % | 0 % | 6,0 |
| 787-9 FRA–SIN 2019 | 2 477 884 $ | 1 552 000 $ | 925 884 $ | 37 % | 52 % | 5 % | 3 % | 11 % | 7 % | 22 % | 0 % | 5,5 |

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
| A320ceo FRA–MAD 1990 | Flag | 123,5 | 69,6 | 9 | 131,5 | 76,3 | 9 |
| A320ceo FRA–MAD 1990 | Boutique | 118,9 | 65,8 | 9 | 127,0 | 72,5 | 9 |
| A330-300 FRA–JFK 1995 | LCC | 48,1 | 24,1 | 0 | 56,1 | 28,1 | 0 |
| A330-300 FRA–JFK 1995 | Expansionist | 65,2 | 32,6 | 1 | 73,1 | 36,6 | 2 |
| A330-300 FRA–JFK 1995 | Optimizer | 87,0 | 43,5 | 3 | 95,0 | 47,5 | 4 |
| A330-300 FRA–JFK 1995 | Flag | 105,4 | 54,5 | 6 | 113,5 | 61,2 | 8 |
| A330-300 FRA–JFK 1995 | Boutique | 99,8 | 49,9 | 4 | 108,0 | 56,6 | 7 |

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
| A320ceo FRA–MAD 1990 | local | 107 697 $ | 1,001 | 4 158 $ | 25,9 |
| A320ceo FRA–MAD 1990 | national | 287 192 $ | 1,002 | 8 075 $ | 35,6 |
| A320ceo FRA–MAD 1990 | global | 717 980 $ | 1,004 | 14 116 $ | 50,9 |
| A320ceo FRA–MAD 2019 | local | 152 208 $ | 1,001 | 6 134 $ | 24,8 |
| A320ceo FRA–MAD 2019 | national | 405 889 $ | 1,002 | 11 687 $ | 34,7 |
| A320ceo FRA–MAD 2019 | global | 1 014 722 $ | 1,004 | 20 251 $ | 50,1 |

Preis fest (bester Preis ohne Werbung). Mehr-Ergebnis = (Strecken-Ergebnis mit − ohne Kampagne) × `WEEKS_PER_MONTH`. Eine regionale Kampagne wirkt auf alle Strecken mit einem Ende in der Region (3.9.5); „Strecken bis zur Deckung“ zählt gleich große Strecken.

### Beste Spieler-Ausstattung: Ruf-Ziel gegen die Ruf-Meilensteine (allein auf der Strecke, Mai)

| Strecke | Kabine und Service | Airline satisfaction | Ruf-Ziel | mit allen Kampagnen | Gold (80) |
|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990 | Flag | 138,3 | 81,9 | 84,9 | ja |
| A320ceo FRA–MAD 1990 | Boutique | 134,6 | 78,8 | 81,8 | mit Werbung |
| A330-300 FRA–JFK 1995 | Flag | 119,6 | 66,3 | 69,3 | nein |
| A330-300 FRA–JFK 1995 | Boutique | 114,7 | 62,2 | 65,2 | nein |

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
| 1 (April 1960) | F27-200 HAM–FRA 1960 (Commuter) | 8 000 | 53,0 $ | 46 % | 0,42 Mio. $ | Regional aircraft class | 2,11 Mio. $ | 5,0 | 22,7 |
| 2 (Jan. 1961) | Caravelle III FRA–CDG 1961 (Regional) | 25 000 | 71,8 $ | 50 % | 1,80 Mio. $ | Narrowbody aircraft class | 8,50 Mio. $ | 4,7 | 23,8 |
| 4 (Jan. 1966) | 727-100 FRA–MAD 1966 (Narrowbody) | 170 000 | 126,6 $ | 48 % | 21,52 Mio. $ | Wide-body aircraft class | 30,08 Mio. $ | 1,4 | 6,7 |
| 5 (Jan. 1970) | 727-200 FRA–MAD 1970 (Narrowbody) | 350 000 | 106,7 $ | 42 % | 37,33 Mio. $ | Jumbo aircraft class + Supersonic aircraft class | 110,42 Mio. $ | 3,0 | 12,5 |

Monatsergebnis = Fluggäste der Rang-Schwelle × Ergebnis je Fluggast der typischen Strecke beim besten Preis (Strecken-Ergebnis 5.9, ohne Kosten der Gesellschaft wie Flughäfen und Verwaltung). Preis im Monat des Rangs (`atCost`). Die letzte Spalte rechnet mit 10 % Marge auf denselben Erlös (Ziel nach E67: 10–25 %).

### Jahresziel der Rang-Beispiele (Angebot im Monat des Rangs)

| Beispiel | Vorjahr: Ergebnis | Vorjahr: Erlös | Bezugsgröße | sicher (× 1,10) | hoch (× 1,35) | Prämie sicher / andere Art / hoch | Strafe hoch | hohes Ziel lohnt ab Chance |
|---|---|---|---|---|---|---|---|---|
| Rang 1, 1960 | 5,08 Mio. $ | 11,14 Mio. $ | 5,08 Mio. $ | 5,59 Mio. $ | 6,86 Mio. $ | 0,25 Mio. $* / 0,38 Mio. $* / 0,63 Mio. $* | 0,31 Mio. $ | 60 % |
| Rang 2, 1961 | 21,54 Mio. $ | 42,94 Mio. $ | 21,54 Mio. $ | 23,70 Mio. $ | 29,08 Mio. $ | 0,43 Mio. $ / 0,65 Mio. $ / 1,08 Mio. $ | 0,54 Mio. $ | 60 % |
| Rang 4, 1966 | 258,21 Mio. $ | 542,20 Mio. $ | 258,21 Mio. $ | 284,03 Mio. $ | 348,58 Mio. $ | 5,16 Mio. $ / 7,75 Mio. $ / 12,91 Mio. $ | 6,46 Mio. $ | 60 % |
| Rang 5, 1970 | 447,94 Mio. $ | 1 057,91 Mio. $ | 447,94 Mio. $ | 492,74 Mio. $ | 604,72 Mio. $ | 8,96 Mio. $ / 13,44 Mio. $ / 22,40 Mio. $ | 11,20 Mio. $ | 60 % |
| Rang 5, 1970, Marge 10 % | 105,79 Mio. $ | 1 057,91 Mio. $ | 105,79 Mio. $ | 116,37 Mio. $ | 142,82 Mio. $ | 2,12 Mio. $ / 3,17 Mio. $ / 5,29 Mio. $ | 2,64 Mio. $ | 60 % |
| Rang 5, 1970, Verlustjahr (−5 %) | −52,90 Mio. $ | 1 057,91 Mio. $ | 52,90 Mio. $ | 58,18 Mio. $ | 71,41 Mio. $ | 1,06 Mio. $ / 1,59 Mio. $ / 2,64 Mio. $ | 1,32 Mio. $ | 60 % |

* = Mindestprämie (sicher 0,25 Mio. $ von 1960 über `atCost`, andere Art und hoch im Verhältnis der Anteile, E83). „Lohnt ab Chance“: Das hohe Ziel bringt im Mittel mehr als ein sicher erreichtes sicheres Ziel, wenn es mit dieser Wahrscheinlichkeit erreicht wird (Strafe = 50 % der Prämie, E58). Das sichere Ziel selbst lohnt ab einer Chance von 33 %.

## Abschnitt 7: Flugzeugwahl der KI auf Langstrecke (O79)

### Die 20 größten Langstrecken-Paare je Jahr: bester Narrowbody gegen besten Widebody (Flag-Ausstattung)

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | HND–SVO | 7 494 | 9 113 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,82 Mio. $ | 1,68 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 96 %) | 8,35 Mio. $ | 7,05 Mio. $ | Widebody |
| 1990 | ORD–SVO | 7 974 | 8 540 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,65 Mio. $ | 1,50 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 95 %) | 8,30 Mio. $ | 7,00 Mio. $ | Widebody |
| 1990 | LHR–ORD | 6 345 | 8 528 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 3,06 Mio. $ | 2,60 Mio. $ | 747-400 (476 Sitze, 9/9 Umläufe, 91 %) | 6,32 Mio. $ | 5,02 Mio. $ | Widebody |
| 1990 | ORD–CDG | 6 665 | 8 067 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 3,20 Mio. $ | 2,74 Mio. $ | 747-400 (476 Sitze, 9/9 Umläufe, 91 %) | 6,60 Mio. $ | 5,30 Mio. $ | Widebody |
| 1990 | LHR–HND | 9 592 | 7 930 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,59 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,36 Mio. $ | 7,06 Mio. $ | Widebody |
| 1990 | LAX–SVO | 9 758 | 7 901 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,61 Mio. $ | 1,47 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 98 %) | 8,03 Mio. $ | 6,74 Mio. $ | Widebody |
| 1990 | LHR–JFK | 5 540 | 7 746 | 757-200 (173 Sitze, 10/10 Umläufe, 100 %) | 3,13 Mio. $ | 2,67 Mio. $ | 767-300 (253 Sitze, 10/10 Umläufe, 98 %) | 4,57 Mio. $ | 3,85 Mio. $ | Widebody |
| 1990 | LAX–JFK | 3 974 | 7 626 | 757-200 (173 Sitze, 14/14 Umläufe, 98 %) | 3,62 Mio. $ | 3,16 Mio. $ | 767-300 (253 Sitze, 13/13 Umläufe, 93 %) | 4,33 Mio. $ | 3,61 Mio. $ | Widebody |
| 1990 | JFK–SVO | 7 481 | 7 606 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,82 Mio. $ | 1,68 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 91 %) | 6,47 Mio. $ | 5,18 Mio. $ | Widebody |
| 1990 | HND–CDG | 9 707 | 7 577 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,60 Mio. $ | 1,45 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,45 Mio. $ | 7,15 Mio. $ | Widebody |
| 1990 | LHR–LAX | 8 760 | 7 512 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,76 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 94 %) | 7,34 Mio. $ | 6,04 Mio. $ | Widebody |
| 1990 | CDG–JFK | 5 833 | 7 341 | 757-200 (173 Sitze, 10/10 Umläufe, 100 %) | 3,18 Mio. $ | 2,72 Mio. $ | 747-400 (476 Sitze, 10/10 Umläufe, 86 %) | 4,96 Mio. $ | 3,67 Mio. $ | Widebody |
| 1990 | LHR–BOS | 5 240 | 7 308 | 757-200 (173 Sitze, 11/11 Umläufe, 99 %) | 3,32 Mio. $ | 2,86 Mio. $ | 767-300 (253 Sitze, 10/10 Umläufe, 97 %) | 4,29 Mio. $ | 3,57 Mio. $ | Widebody |
| 1990 | LAX–CDG | 9 103 | 7 160 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,53 Mio. $ | 1,39 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 94 %) | 7,58 Mio. $ | 6,28 Mio. $ | Widebody |
| 1990 | HND–LAX | 8 813 | 7 090 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,77 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 93 %) | 7,22 Mio. $ | 5,92 Mio. $ | Widebody |
| 1990 | BOS–SVO | 7 191 | 7 006 | 757-200 (173 Sitze, 8/8 Umläufe, 100 %) | 3,03 Mio. $ | 2,57 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 89 %) | 5,62 Mio. $ | 4,32 Mio. $ | Widebody |
| 1990 | HND–ORD | 10 124 | 7 003 | – | – | – | 747-400 (476 Sitze, 6/6 Umläufe, 98 %) | 8,31 Mio. $ | 7,01 Mio. $ | Widebody |
| 1990 | LAX–BOS | 4 193 | 6 950 | 757-200 (173 Sitze, 13/13 Umläufe, 98 %) | 3,43 Mio. $ | 2,97 Mio. $ | 767-300 (253 Sitze, 12/12 Umläufe, 92 %) | 3,95 Mio. $ | 3,23 Mio. $ | Widebody |
| 1990 | CDG–BOS | 5 534 | 6 930 | 757-200 (173 Sitze, 10/10 Umläufe, 100 %) | 3,09 Mio. $ | 2,63 Mio. $ | 767-300 (253 Sitze, 10/10 Umläufe, 97 %) | 4,36 Mio. $ | 3,64 Mio. $ | Widebody |
| 1990 | SFO–SVO | 9 434 | 6 677 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,58 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 92 %) | 7,27 Mio. $ | 5,97 Mio. $ | Widebody |
| 2000 | LHR–HND | 9 592 | 8 013 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,39 Mio. $ | 5,98 Mio. $ | Widebody |
| 2000 | LHR–ORD | 6 345 | 7 944 | 757-300 (213 Sitze, 9/9 Umläufe, 100 %) | 3,48 Mio. $ | 2,85 Mio. $ | a330-300 (318 Sitze, 9/9 Umläufe, 98 %) | 5,45 Mio. $ | 4,45 Mio. $ | Widebody |
| 2000 | LHR–LAX | 8 760 | 7 786 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 98 %) | 7,40 Mio. $ | 5,99 Mio. $ | Widebody |
| 2000 | HND–CDG | 9 707 | 7 749 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,49 Mio. $ | 6,08 Mio. $ | Widebody |
| 2000 | ORD–CDG | 6 665 | 7 621 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 2,92 Mio. $ | 2,40 Mio. $ | a330-300 (318 Sitze, 9/9 Umläufe, 98 %) | 5,78 Mio. $ | 4,78 Mio. $ | Widebody |
| 2000 | LAX–CDG | 9 103 | 7 516 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 98 %) | 7,75 Mio. $ | 6,34 Mio. $ | Widebody |
| 2000 | HND–LAX | 8 813 | 7 148 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 98 %) | 7,27 Mio. $ | 5,86 Mio. $ | Widebody |
| 2000 | LHR–JFK | 5 540 | 6 921 | 757-300 (213 Sitze, 10/10 Umläufe, 98 %) | 3,21 Mio. $ | 2,58 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 93 %) | 4,17 Mio. $ | 3,25 Mio. $ | Widebody |
| 2000 | LAX–JFK | 3 974 | 6 803 | 757-200 (173 Sitze, 14/14 Umläufe, 97 %) | 3,21 Mio. $ | 2,69 Mio. $ | a330-200 (293 Sitze, 13/13 Umläufe, 87 %) | 3,84 Mio. $ | 2,92 Mio. $ | Widebody |
| 2000 | LHR–BOS | 5 240 | 6 676 | 757-300 (213 Sitze, 11/11 Umläufe, 97 %) | 3,38 Mio. $ | 2,75 Mio. $ | a330-200 (293 Sitze, 11/11 Umläufe, 90 %) | 4,03 Mio. $ | 3,10 Mio. $ | Widebody |
| 2000 | CDG–JFK | 5 833 | 6 633 | 757-300 (213 Sitze, 10/10 Umläufe, 98 %) | 3,25 Mio. $ | 2,62 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 93 %) | 4,22 Mio. $ | 3,30 Mio. $ | Widebody |
| 2000 | LHR–ICN | 8 861 | 6 488 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 95 %) | 6,36 Mio. $ | 4,95 Mio. $ | Widebody |
| 2000 | LAX–BOS | 4 193 | 6 424 | 757-200 (173 Sitze, 13/13 Umläufe, 97 %) | 3,05 Mio. $ | 2,53 Mio. $ | a330-200 (293 Sitze, 13/13 Umläufe, 86 %) | 3,69 Mio. $ | 2,76 Mio. $ | Widebody |
| 2000 | LHR–SFO | 8 616 | 6 414 | – | – | – | a330-300 (318 Sitze, 7/7 Umläufe, 98 %) | 5,63 Mio. $ | 4,63 Mio. $ | Widebody |
| 2000 | CDG–BOS | 5 534 | 6 393 | 757-300 (213 Sitze, 10/10 Umläufe, 98 %) | 3,19 Mio. $ | 2,56 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 92 %) | 3,93 Mio. $ | 3,01 Mio. $ | Widebody |
| 2000 | ATL–LHR | 6 761 | 6 384 | 757-200 (173 Sitze, 9/9 Umläufe, 99 %) | 2,84 Mio. $ | 2,32 Mio. $ | a330-200 (293 Sitze, 8/8 Umläufe, 95 %) | 4,08 Mio. $ | 3,16 Mio. $ | Widebody |
| 2000 | HND–ORD | 10 124 | 6 361 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,12 Mio. $ | 5,71 Mio. $ | Widebody |
| 2000 | CDG–ICN | 8 927 | 6 316 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 95 %) | 6,43 Mio. $ | 5,02 Mio. $ | Widebody |
| 2000 | ATL–CDG | 7 055 | 6 201 | 757-200 (173 Sitze, 8/8 Umläufe, 100 %) | 2,67 Mio. $ | 2,15 Mio. $ | a330-200 (293 Sitze, 8/8 Umläufe, 95 %) | 4,27 Mio. $ | 3,35 Mio. $ | Widebody |
| 2000 | CDG–SFO | 8 962 | 6 172 | – | – | – | a330-300 (318 Sitze, 7/7 Umläufe, 99 %) | 5,87 Mio. $ | 4,87 Mio. $ | Widebody |
| 2010 | CDG–PEK | 8 190 | 7 715 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,19 Mio. $ | 0,70 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 96 %) | 3,80 Mio. $ | 2,75 Mio. $ | Widebody |
| 2010 | LHR–PEK | 8 154 | 7 447 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,18 Mio. $ | 0,69 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 93 %) | 3,12 Mio. $ | 2,08 Mio. $ | Widebody |
| 2010 | PEK–CGK | 5 237 | 6 625 | 737-900er (160 Sitze, 11/11 Umläufe, 98 %) | 2,40 Mio. $ | 1,86 Mio. $ | il-96-300 (217 Sitze, 10/10 Umläufe, 93 %) | 1,94 Mio. $ | 1,26 Mio. $ | Narrowbody |
| 2010 | HND–CDG | 9 707 | 6 510 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,09 Mio. $ | 0,60 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 95 %) | 3,37 Mio. $ | 2,33 Mio. $ | Widebody |
| 2010 | LHR–HND | 9 592 | 6 368 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 94 %) | 3,08 Mio. $ | 2,04 Mio. $ | Widebody |
| 2010 | CDG–JFK | 5 833 | 6 266 | a320ceo (134 Sitze, 10/10 Umläufe, 97 %) | 1,54 Mio. $ | 1,05 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 98 %) | 1,13 Mio. $ | 0,46 Mio. $ | Narrowbody |
| 2010 | PEK–SVO | 5 796 | 6 265 | a320ceo (134 Sitze, 10/10 Umläufe, 98 %) | 1,57 Mio. $ | 1,08 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 98 %) | 1,15 Mio. $ | 0,47 Mio. $ | Narrowbody |
| 2010 | HND–BKK | 4 588 | 6 262 | 737-800 (137 Sitze, 12/12 Umläufe, 97 %) | 2,04 Mio. $ | 1,55 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 96 %) | 1,59 Mio. $ | 0,92 Mio. $ | Narrowbody |
| 2010 | ICN–BKK | 3 666 | 6 180 | tu-204-300 (117 Sitze, 15/15 Umläufe, 96 %) | 1,91 Mio. $ | 1,54 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 93 %) | 1,53 Mio. $ | 0,85 Mio. $ | Narrowbody |
| 2010 | LHR–JFK | 5 540 | 6 152 | 737-800 (137 Sitze, 10/10 Umläufe, 97 %) | 1,55 Mio. $ | 1,06 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 95 %) | 1,10 Mio. $ | 0,42 Mio. $ | Narrowbody |
| 2010 | CDG–ICN | 8 927 | 6 083 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 99 %) | 2,29 Mio. $ | 1,62 Mio. $ | Widebody |
| 2010 | LHR–ICN | 8 861 | 5 920 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 98 %) | 2,13 Mio. $ | 1,46 Mio. $ | Widebody |
| 2010 | SIN–PEK | 4 489 | 5 821 | 737-800 (137 Sitze, 12/12 Umläufe, 97 %) | 1,98 Mio. $ | 1,49 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 95 %) | 1,51 Mio. $ | 0,83 Mio. $ | Narrowbody |
| 2010 | ORD–CDG | 6 665 | 5 811 | a319ceo (114 Sitze, 8/8 Umläufe, 100 %) | 1,24 Mio. $ | 0,81 Mio. $ | il-96-300 (217 Sitze, 5/8 Umläufe, 97 %) | 1,23 Mio. $ | 0,55 Mio. $ | Narrowbody |
| 2010 | HND–CGK | 5 784 | 5 798 | 737-900er (160 Sitze, 10/10 Umläufe, 98 %) | 2,05 Mio. $ | 1,51 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 98 %) | 1,51 Mio. $ | 0,83 Mio. $ | Narrowbody |
| 2010 | LHR–ORD | 6 345 | 5 692 | a319ceo (114 Sitze, 9/9 Umläufe, 99 %) | 1,27 Mio. $ | 0,84 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 97 %) | 1,07 Mio. $ | 0,39 Mio. $ | Narrowbody |
| 2010 | LAX–PEK | 10 037 | 5 687 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,10 Mio. $ | 0,61 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 95 %) | 3,31 Mio. $ | 2,27 Mio. $ | Widebody |
| 2010 | LAX–JFK | 3 974 | 5 648 | tu-204-300 (117 Sitze, 14/14 Umläufe, 96 %) | 1,75 Mio. $ | 1,37 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 91 %) | 1,34 Mio. $ | 0,66 Mio. $ | Narrowbody |
| 2010 | DEL–PEK | 3 811 | 5 637 | tu-204-300 (117 Sitze, 14/14 Umläufe, 96 %) | 1,71 Mio. $ | 1,34 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 91 %) | 1,31 Mio. $ | 0,63 Mio. $ | Narrowbody |
| 2010 | LAX–CDG | 9 103 | 5 594 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,04 Mio. $ | 0,55 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 96 %) | 1,75 Mio. $ | 1,08 Mio. $ | Widebody |

Je Typ: neues Flugzeug mit Kabine nach 7.5, Strecke nach dem Anlauf, Preisniveau einer neuen KI-Strecke (7.6), beste Flugzahl aus `planFrequencies` (100 / 60 / 30 % der höchsten Umläufe), Planer-Hauptzahl je Monat (4.12); „nach Zins“ = `profitAfterCapital` (8 % je Jahr auf den Kaufpreis, E81). Bester Typ je Bauart nach „nach Zins“. Marktgröße = Fluggäste je Woche, beide Richtungen. Die Gesellschaft fliegt das Paar allein.

### Die 10 größten Paare über 7 500 km je Jahr

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | ORD–SVO | 7 974 | 8 540 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,65 Mio. $ | 1,50 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 95 %) | 8,30 Mio. $ | 7,00 Mio. $ | Widebody |
| 1990 | LHR–HND | 9 592 | 7 930 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,59 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,36 Mio. $ | 7,06 Mio. $ | Widebody |
| 1990 | LAX–SVO | 9 758 | 7 901 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,61 Mio. $ | 1,47 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 98 %) | 8,03 Mio. $ | 6,74 Mio. $ | Widebody |
| 1990 | HND–CDG | 9 707 | 7 577 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,60 Mio. $ | 1,45 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,45 Mio. $ | 7,15 Mio. $ | Widebody |
| 1990 | LHR–LAX | 8 760 | 7 512 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,76 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 94 %) | 7,34 Mio. $ | 6,04 Mio. $ | Widebody |
| 1990 | LAX–CDG | 9 103 | 7 160 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,53 Mio. $ | 1,39 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 94 %) | 7,58 Mio. $ | 6,28 Mio. $ | Widebody |
| 1990 | HND–LAX | 8 813 | 7 090 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,77 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 93 %) | 7,22 Mio. $ | 5,92 Mio. $ | Widebody |
| 1990 | HND–ORD | 10 124 | 7 003 | – | – | – | 747-400 (476 Sitze, 6/6 Umläufe, 98 %) | 8,31 Mio. $ | 7,01 Mio. $ | Widebody |
| 1990 | SFO–SVO | 9 434 | 6 677 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,58 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 92 %) | 7,27 Mio. $ | 5,97 Mio. $ | Widebody |
| 1990 | DFW–LHR | 7 628 | 6 560 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,84 Mio. $ | 1,69 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 88 %) | 5,43 Mio. $ | 4,13 Mio. $ | Widebody |
| 2000 | LHR–HND | 9 592 | 8 013 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,39 Mio. $ | 5,98 Mio. $ | Widebody |
| 2000 | LHR–LAX | 8 760 | 7 786 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 98 %) | 7,40 Mio. $ | 5,99 Mio. $ | Widebody |
| 2000 | HND–CDG | 9 707 | 7 749 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,49 Mio. $ | 6,08 Mio. $ | Widebody |
| 2000 | LAX–CDG | 9 103 | 7 516 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 98 %) | 7,75 Mio. $ | 6,34 Mio. $ | Widebody |
| 2000 | HND–LAX | 8 813 | 7 148 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 98 %) | 7,27 Mio. $ | 5,86 Mio. $ | Widebody |
| 2000 | LHR–ICN | 8 861 | 6 488 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 95 %) | 6,36 Mio. $ | 4,95 Mio. $ | Widebody |
| 2000 | LHR–SFO | 8 616 | 6 414 | – | – | – | a330-300 (318 Sitze, 7/7 Umläufe, 98 %) | 5,63 Mio. $ | 4,63 Mio. $ | Widebody |
| 2000 | HND–ORD | 10 124 | 6 361 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,12 Mio. $ | 5,71 Mio. $ | Widebody |
| 2000 | CDG–ICN | 8 927 | 6 316 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 95 %) | 6,43 Mio. $ | 5,02 Mio. $ | Widebody |
| 2000 | CDG–SFO | 8 962 | 6 172 | – | – | – | a330-300 (318 Sitze, 7/7 Umläufe, 99 %) | 5,87 Mio. $ | 4,87 Mio. $ | Widebody |
| 2010 | CDG–PEK | 8 190 | 7 715 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,19 Mio. $ | 0,70 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 96 %) | 3,80 Mio. $ | 2,75 Mio. $ | Widebody |
| 2010 | LHR–PEK | 8 154 | 7 447 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,18 Mio. $ | 0,69 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 93 %) | 3,12 Mio. $ | 2,08 Mio. $ | Widebody |
| 2010 | HND–CDG | 9 707 | 6 510 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,09 Mio. $ | 0,60 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 95 %) | 3,37 Mio. $ | 2,33 Mio. $ | Widebody |
| 2010 | LHR–HND | 9 592 | 6 368 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 94 %) | 3,08 Mio. $ | 2,04 Mio. $ | Widebody |
| 2010 | CDG–ICN | 8 927 | 6 083 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 99 %) | 2,29 Mio. $ | 1,62 Mio. $ | Widebody |
| 2010 | LHR–ICN | 8 861 | 5 920 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 98 %) | 2,13 Mio. $ | 1,46 Mio. $ | Widebody |
| 2010 | LAX–PEK | 10 037 | 5 687 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,10 Mio. $ | 0,61 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 95 %) | 3,31 Mio. $ | 2,27 Mio. $ | Widebody |
| 2010 | LAX–CDG | 9 103 | 5 594 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,04 Mio. $ | 0,55 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 96 %) | 1,75 Mio. $ | 1,08 Mio. $ | Widebody |
| 2010 | CDG–BKK | 9 448 | 5 463 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 95 %) | 1,71 Mio. $ | 1,03 Mio. $ | Widebody |
| 2010 | LHR–LAX | 8 760 | 5 421 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,25 Mio. $ | 0,76 Mio. $ | il-96-300 (217 Sitze, 4/7 Umläufe, 99 %) | 1,36 Mio. $ | 0,68 Mio. $ | Narrowbody |

Wie oben. „–“ = kein lieferbarer Typ der Bauart mit dieser Reichweite.

### Kosten je Sitz und Woche: LHR–JFK 2000, ein Flugzeug allein, Marktpreis

| Typ | Bauart | Umläufe | Sitze je Woche | Fluggäste | Treibstoff je Sitz | Besatzung + Landung je Sitz | Flugzeug-Anteil je Sitz | feste Kosten je Sitz | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|---|---|
| 737-700 | Narrowbody | 5/10 | 1 080 | 1 080 | 159 | 78 | 71 | 311 | 0,13 Mio. $ |
| 737-700 | Narrowbody | 10/10 | 2 160 | 2 160 | 159 | 78 | 35 | 275 | 0,34 Mio. $ |
| a321ceo | Narrowbody | 5/10 | 1 600 | 1 600 | 153 | 71 | 69 | 295 | 0,22 Mio. $ |
| a321ceo | Narrowbody | 10/10 | 3 200 | 3 200 | 153 | 71 | 34 | 261 | 0,54 Mio. $ |
| 767-300er | Widebody | 5/10 | 2 530 | 2 530 | 170 | 45 | 69 | 286 | 0,37 Mio. $ |
| 767-300er | Widebody | 10/10 | 5 060 | 4 962 | 170 | 45 | 34 | 251 | 0,79 Mio. $ |
| a330-300 | Widebody | 5/10 | 3 180 | 3 169 | 159 | 43 | 61 | 265 | 0,52 Mio. $ |
| a330-300 | Widebody | 10/10 | 6 360 | 6 019 | 159 | 43 | 31 | 234 | 0,90 Mio. $ |
| 777-200er | Widebody | 5/10 | 3 180 | 3 172 | 154 | 43 | 73 | 271 | 0,50 Mio. $ |
| 777-200er | Widebody | 10/10 | 6 360 | 6 044 | 154 | 43 | 37 | 234 | 0,92 Mio. $ |

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
| Aviation Downturn | × 1,00 | 0,65 / 0,40 / 12 | 1,175 | 13,48 Mio. $ | 29 % | 1,45 Mio. $ | 2,69 |
| Aviation Downturn | × 0,25 | 0,65 / 0,40 / 12 | 1,098 | 6,11 Mio. $ | 16 % | 0,68 Mio. $ | 1,45 |
| Global Financial Crisis | × 1,00 | 0,75 / 0,33 / 24 | 1,090 | 24,97 Mio. $ | 19 % | 1,81 Mio. $ | 2,57 |
| Global Financial Crisis | × 0,25 | 0,75 / 0,33 / 24 | 1,050 | 11,83 Mio. $ | 10 % | 0,83 Mio. $ | 1,38 |
| Global Pandemic | × 1,00 | 0,20 / 0,35 / 24 | 1,856 | 59,15 Mio. $ | 23 % | 6,30 Mio. $ | 2,12 |
| Global Pandemic | × 0,25 | 0,20 / 0,35 / 24 | 1,284 | 21,85 Mio. $ | 9 % | 2,64 Mio. $ | 0,72 |

Ergebnis = Strecken-Ergebnis (5.9) × `WEEKS_PER_MONTH`, Summe über die Dauer. „× 0,25“ verkleinert die Marktgröße wie ein kleineres `DEMAND_SCALE` (Richtung E67). Volle Flugzeuge verlieren bei kleinerer Nachfrage zuerst nur „Knappheit“; die Antwort holt dann wenig Fluggäste zurück.

### Charter oder streichen je betroffenem Flug (Strecken beim besten Preis)

| Strecke | Erlös je Flug | Kosten je Fluggast (Summe) | eigene Flugkosten | Charter-Gebühr | Vorteil Charter | Strecke mit Gewinn |
|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 10 362 $ | 1 379 $ | 2 604 $ | 3 907 $ | 5 077 $ | ja |
| 707-320B FRA–JFK 1965 | 69 986 $ | 5 863 $ | 36 518 $ | 54 777 $ | 9 345 $ | ja |
| 727-200 FRA–MAD 1975 | 35 688 $ | 5 256 $ | 15 595 $ | 23 392 $ | 7 040 $ | ja |
| ATR 72-200 HAM–NUE 1990 | 7 405 $ | 1 574 $ | 2 441 $ | 3 661 $ | 2 170 $ | ja |
| A320ceo FRA–MAD 1990 | 43 282 $ | 6 258 $ | 9 643 $ | 14 464 $ | 22 560 $ | ja |
| A320ceo FRA–MAD 1990 (LCC) | 32 474 $ | 3 191 $ | 9 652 $ | 14 478 $ | 14 805 $ | ja |
| A320ceo ATL–ORD 1990 | 44 298 $ | 6 390 $ | 8 343 $ | 12 515 $ | 25 394 $ | ja |
| A330-300 FRA–JFK 1995 | 155 954 $ | 17 614 $ | 48 208 $ | 72 312 $ | 66 028 $ | ja |
| A320ceo FRA–MAD 2019 | 62 071 $ | 8 849 $ | 15 961 $ | 23 942 $ | 29 280 $ | ja |
| A330-300 FRA–JFK 2019 | 225 030 $ | 25 163 $ | 93 392 $ | 140 088 $ | 59 779 $ | ja |
| 787-9 FRA–SIN 2019 | 309 735 $ | 27 995 $ | 122 393 $ | 183 589 $ | 98 151 $ | ja |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 2 264 $ | 627 $ | 2 441 $ | 3 661 $ | −2 024 $ | nein |
| A320ceo FRA–MAD 1990 × 0,25 | 18 595 $ | 3 838 $ | 9 643 $ | 14 464 $ | 292 $ | nein |
| A330-300 FRA–JFK 1995 × 0,25 | 42 293 $ | 5 369 $ | 48 208 $ | 72 312 $ | −35 388 $ | nein |

Vorteil = Erlös − Kosten je Fluggast − Charter-Gebühr (`charterAdvantage`, 8.9); die eigenen Flugkosten entfallen in beiden Fällen. Dazu kein Ruf-Abzug mit Charter (6.2).

### Beträge der Störungs-Frage gegen die Rechnung (Flughafen-Streik am Start-Flughafen, Monat, Strecken beim besten Preis)

| Strecke | Auslastung | Erlös im Mittel × Anteil | Erlösverlust (Frage) | Erlösverlust (Rechnung) | Vorteil Charter (Frage) | Vorteil Charter (Rechnung) | Gebühr Frage / gebucht |
|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 100 % | 378 473 $ | 378 420 $ | 378 420 $ (100 %) | 185 382 $ | 185 382 $ | 142 686 $ / 142 686 $ |
| 707-320B FRA–JFK 1965 | 100 % | 2 556 223 $ | 2 555 437 $ | 2 555 437 $ (100 %) | 340 613 $ | 340 613 $ | 2 000 739 $ / 2 000 739 $ |
| 727-200 FRA–MAD 1975 | 97 % | 1 303 519 $ | 1 236 750 $ | 1 236 750 $ (95 %) | 217 367 $ | 217 367 $ | 854 408 $ / 854 408 $ |
| ATR 72-200 HAM–NUE 1990 | 100 % | 270 469 $ | 270 469 $ | 270 469 $ (100 %) | 79 246 $ | 79 246 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 | 97 % | 1 580 868 $ | 1 505 300 $ | 1 505 300 $ (95 %) | 779 424 $ | 779 424 $ | 528 307 $ / 528 307 $ |
| A320ceo FRA–MAD 1990 (LCC) | 100 % | 1 186 116 $ | 1 186 116 $ | 1 186 116 $ (100 %) | 540 750 $ | 540 750 $ | 528 826 $ / 528 826 $ |
| A320ceo ATL–ORD 1990 | 97 % | 1 617 990 $ | 1 557 348 $ | 1 557 348 $ (96 %) | 894 631 $ | 894 631 $ | 457 107 $ / 457 107 $ |
| A330-300 FRA–JFK 1995 | 96 % | 5 696 224 $ | 5 270 376 $ | 5 270 376 $ (93 %) | 2 070 330 $ | 2 070 330 $ | 2 641 213 $ / 2 641 213 $ |
| A320ceo FRA–MAD 2019 | 97 % | 2 267 137 $ | 2 160 569 $ | 2 160 569 $ (95 %) | 1 006 566 $ | 1 006 566 $ | 874 473 $ / 874 473 $ |
| A330-300 FRA–JFK 2019 | 98 % | 4 696 691 $ | 4 523 938 $ | 4 523 938 $ (96 %) | 1 115 400 $ | 1 115 400 $ | 2 923 834 $ / 2 923 834 $ |
| 787-9 FRA–SIN 2019 | 99 % | 6 464 621 $ | 6 352 719 $ | 6 352 719 $ (98 %) | 1 955 161 $ | 1 955 161 $ | 3 831 772 $ / 3 831 772 $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 40 % | 207 714 $ | 207 714 $ | 207 714 $ (100 %) | 16 491 $ | 16 491 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 × 0,25 | 80 % | 989 274 $ | 913 768 $ | 913 768 $ (92 %) | 187 865 $ | 187 865 $ | 528 307 $ / 528 307 $ |
| A330-300 FRA–JFK 1995 × 0,25 | 34 % | 4 964 667 $ | 4 541 058 $ | 4 541 058 $ (91 %) | 1 340 494 $ | 1 340 494 $ | 2 641 213 $ / 2 641 213 $ |

Frage: `charterQuestionFigures` auf dem Monat mit der Störung (E76). Rechnung: derselbe Monat ohne Störung, gestrichen und gechartert (`monthOperations`), Vorteil = Monatsergebnis mit Charter − mit Streichen. „Erlös im Mittel × Anteil“ ist die alte Schätzung aus 5.2e: Beim Streichen verteilt das Modell die Fluggäste auf die übrigen Sitze (8.9), der echte Verlust ist darum kleiner, je mehr Sitze frei sind.

### Händler-Spanne: A320ceo (Flag-Kabine), gebaut Mai 1990

| Alter | Zelle / Kabine | Wert | Gebrauchtpreis | Verkaufserlös | mit größter Forschung | zurück nach Kauf und Verkauf | Verlust in Monatsergebnissen |
|---|---|---|---|---|---|---|---|
| 0 Jahre | 100 / 100 | 57,64 Mio. $ | 60,52 Mio. $ | 48,99 Mio. $ | 50,22 Mio. $ | 83,0 % | 8,74 |
| 5 Jahre | 87 / 78 | 43,98 Mio. $ | 46,18 Mio. $ | 37,39 Mio. $ | 38,32 Mio. $ | 83,0 % | 6,28 |
| 10 Jahre | 76 / 64 | 32,84 Mio. $ | 34,49 Mio. $ | 27,92 Mio. $ | 28,61 Mio. $ | 83,0 % | 4,42 |
| 20 Jahre | 54 / 36 | 14,46 Mio. $ | 15,19 Mio. $ | 12,29 Mio. $ | 12,60 Mio. $ | 83,0 % | 1,73 |

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
| A320ceo FRA–MAD 1990 | 134 | 0,20 Mio. $ | 0,19 Mio. $ | 0,39 Mio. $ | 1,32 Mio. $ | 0,3 |
| A320ceo FRA–MAD 2019 | 134 | 1,02 Mio. $ | 0,27 Mio. $ | 1,29 Mio. $ | 1,77 Mio. $ | 0,7 |
| A330-300 FRA–JFK 2019 | 318 | 1,71 Mio. $ | 0,65 Mio. $ | 2,36 Mio. $ | 2,62 Mio. $ | 0,9 |
| ATR 72-200 HAM–NUE 1990 | 69 | 0,04 Mio. $ | 0,10 Mio. $ | 0,14 Mio. $ | 0,11 Mio. $ | 1,4 |

`refitPrice` (8.13): `atCost(cabinListPrice)` + `refitLabour`. Der Lohn war früher Typ-Kapazität × 1 000 $ ohne Kostenindex. Wie oft umgebaut wird, zeigt der Verschleiß (B8.7, Kabine 50 nach etwa 6–7 Jahren auf Langstrecke).

### Verschleiß je Strecke (Flugplan der typischen Strecken, nichts gestrichen)

| Strecke | Blockstunden je Monat | Kabine je Jahr | Zelle je Jahr | Jahre bis Kabine 50 | Jahre bis Zelle 50 |
|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 45 | 1,8 | 1,6 | 27,1 | 31,0 |
| 707-320B FRA–JFK 1965 | 443 | 7,6 | 5,2 | 6,6 | 9,5 |
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
| Caravelle III FRA–CDG 1962 | 4,89 Mio. $ | 0,23 Mio. $ | 21,3 | 0,31 Mio. $ | 0,32 Mio. $ | 0,033 Mio. $ |
| 707-320B FRA–JFK 1965 | 10,67 Mio. $ | 2,36 Mio. $ | 4,5 | 2,72 Mio. $ | 1,54 Mio. $ | 0,071 Mio. $ |
| 727-200 FRA–MAD 1975 | 9,62 Mio. $ | 1,08 Mio. $ | 8,9 | 1,40 Mio. $ | 0,78 Mio. $ | 0,064 Mio. $ |
| ATR 72-200 HAM–NUE 1990 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,34 Mio. $ | 0,11 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,32 Mio. $ | 1,32 Mio. $ | 0,192 Mio. $ |
| A320ceo FRA–MAD 1990 (LCC) | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,13 Mio. $ | 0,85 Mio. $ | 0,192 Mio. $ |
| A320ceo ATL–ORD 1990 | 28,82 Mio. $ | 0,86 Mio. $ | 33,7 | 1,24 Mio. $ | 1,45 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 | 70,44 Mio. $ | 3,75 Mio. $ | 18,8 | 4,83 Mio. $ | 4,67 Mio. $ | 0,470 Mio. $ |
| A320ceo FRA–MAD 2019 | 41,10 Mio. $ | 1,47 Mio. $ | 28,0 | 2,00 Mio. $ | 1,77 Mio. $ | 0,274 Mio. $ |
| A330-300 FRA–JFK 2019 | 94,21 Mio. $ | 4,33 Mio. $ | 21,8 | 5,20 Mio. $ | 2,62 Mio. $ | 0,628 Mio. $ |
| 787-9 FRA–SIN 2019 | 132,74 Mio. $ | 5,77 Mio. $ | 23,0 | 6,75 Mio. $ | 4,03 Mio. $ | 0,885 Mio. $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,29 Mio. $ | −0,15 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 × 0,25 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,17 Mio. $ | −0,04 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 × 0,25 | 70,44 Mio. $ | 3,75 Mio. $ | 18,8 | 4,08 Mio. $ | −1,51 Mio. $ | 0,470 Mio. $ |

Feste Kosten = Treibstoff, Besatzung, Landung, Slot- und Flugzeug-Anteil (5.9); ohne Kosten der Gesellschaft. Kauf nur aus Guthaben; die Kreditlinie deckt laufende Verluste (8.14).

### Szenario „Oil Shock“ (LHR, Okt. 1973 bis Dez. 1976): Ruf am Stichtag je Ausstattung (Start 50)

| Ausstattung | Airline satisfaction | Ruf am Stichtag | Ziel 55 erreicht |
|---|---|---|---|
| LCC-Kabine, Zustand 60 | 56,0 | 28,0 | nein |
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

## 7 Konkurrenz und 3.13 Umsteiger: Langläufe ohne Spieler (Paket 3.9b)

### Unternehmenswert der Gründer, Zuschuss abgeschafft (Median, Preise von 1960; in Klammern ÷ Median aller)

| Nach Jahren | Median alle | flag | lcc | expansionist | optimizer | boutique | Faktor |
|---|---|---|---|---|---|---|---|
| 10 (1970) | 989 Mio. $ | 1 202 Mio. $ (1,22) | 820 Mio. $ (0,83) | 840 Mio. $ (0,85) | 1 174 Mio. $ (1,19) | 950 Mio. $ (0,96) | 1,22 |
| 20 (1980) | 831 Mio. $ | 1 072 Mio. $ (1,29) | 718 Mio. $ (0,86) | 815 Mio. $ (0,98) | 1 083 Mio. $ (1,30) | 744 Mio. $ (0,89) | 1,30 |
| 30 (1990) | 2 543 Mio. $ | 4 307 Mio. $ (1,69) | 2 287 Mio. $ (0,90) | 3 660 Mio. $ (1,44) | 2 452 Mio. $ (0,96) | 2 292 Mio. $ (0,90) | 1,69 |
| 40 (2000) | 2 864 Mio. $ | 7 269 Mio. $ (2,54) | 2 458 Mio. $ (0,86) | 5 375 Mio. $ (1,88) | 2 773 Mio. $ (0,97) | 2 374 Mio. $ (0,83) | 2,54 |
| 50 (2010) | 2 688 Mio. $ | 7 454 Mio. $ (2,77) | 2 136 Mio. $ (0,79) | 4 590 Mio. $ (1,71) | 2 653 Mio. $ (0,99) | 2 678 Mio. $ (1,00) | 2,77 |
| 60 (2020) | 3 055 Mio. $ | 8 375 Mio. $ (2,74) | 2 477 Mio. $ (0,81) | 4 662 Mio. $ (1,53) | 3 027 Mio. $ (0,99) | 2 764 Mio. $ (0,90) | 2,74 |

„Faktor“ = größtes Verhältnis einer Persönlichkeit zum Median aller, in beide Richtungen. Aufgelöste Gründer zählen mit 0.

### Gründer je Lauf am Ende (Drehkreuz: Unternehmenswert in Preisen von 1960)

| Lauf | flag | lcc | expansionist | optimizer | boutique |
|---|---|---|---|---|---|
| 0 | JFK: 10 316 Mio. $ | FRA: 2 009 Mio. $ | CDG: 5 495 Mio. $ | HND: 231 Mio. $ | ATL: 2 709 Mio. $ |
| 1 | LHR: 9 885 Mio. $ | ORD: 2 647 Mio. $ | LAX: 4 920 Mio. $ | ATL: 2 518 Mio. $ | SYD: 4 635 Mio. $ |
| 2 | FRA: 9 101 Mio. $ | CDG: 1 973 Mio. $ | HND: 3 709 Mio. $ | ATL: 3 865 Mio. $ | JFK: 2 333 Mio. $ |
| 3 | ORD: 5 650 Mio. $ | LAX: 2 409 Mio. $ | ATL: 5 332 Mio. $ | SYD: 61 Mio. $ | LHR: 3 712 Mio. $ |
| 4 | CDG: 9 370 Mio. $ | HND: 2 142 Mio. $ | ATL: 4 730 Mio. $ | JFK: 3 367 Mio. $ | FRA: 1 976 Mio. $ |
| 5 | LAX: 13 854 Mio. $ | ATL: 2 544 Mio. $ | SYD: 1 578 Mio. $ | LHR: 3 166 Mio. $ | ORD: 3 103 Mio. $ |
| 6 | HND: 2 789 Mio. $ | ATL: 2 771 Mio. $ | JFK: 4 255 Mio. $ | FRA: 3 697 Mio. $ | CDG: 4 409 Mio. $ |
| 7 | SIN: 67 Mio. $ | SYD: 200 Mio. $ | LHR: 4 507 Mio. $ | ORD: 2 651 Mio. $ | LAX: 2 819 Mio. $ |
| 8 | ATL: 7 648 Mio. $ | JFK: 3 007 Mio. $ | FRA: 4 594 Mio. $ | CDG: 2 888 Mio. $ | HND: 1 617 Mio. $ |
| 9 | SYD: 72 Mio. $ | LHR: 2 861 Mio. $ | ORD: 5 128 Mio. $ | LAX: 3 216 Mio. $ | SIN: 103 Mio. $ |

Feste Drehkreuze nach `founderHub` (über 10 Läufe jedes einmal je Persönlichkeit); ist von dort keine Strecke mit Gewinn möglich, das nächste freie aus `FOUNDER_HUBS` (E71).

### Preise und Markt im laufenden Spiel (Mittel der Jahre, alle Haupt-Läufe)

| Jahrzehnt | Preis Y p10 | Preis Y Median | Preis Y p90 | Preiskampf | Gesellschaften je Paar | Paare mit ≥ 2 | Auslastung (Median) | Marge (Median) | Strecken mit Verlust |
|---|---|---|---|---|---|---|---|---|---|
| 1960er | 0,88 | 1,05 | 1,39 | 0,5 % | 1,02 | 2 % | 100 % | 24 % | 5 % |
| 1970er | 0,91 | 1,06 | 1,50 | 0,5 % | 1,03 | 3 % | 100 % | 11 % | 20 % |
| 1980er | 0,87 | 1,04 | 1,52 | 0,8 % | 1,04 | 4 % | 100 % | 33 % | 2 % |
| 1990er | 0,81 | 1,00 | 1,34 | 0,7 % | 1,04 | 4 % | 100 % | 37 % | 1 % |
| 2000er | 0,85 | 1,00 | 1,32 | 0,4 % | 1,03 | 3 % | 100 % | 19 % | 6 % |
| 2010er | 0,87 | 1,02 | 1,31 | 0,5 % | 1,03 | 3 % | 100 % | 30 % | 1 % |

Preis Y = Preisniveau Economy (`fareRatio`) je Strecke und Monat. Auslastung und Marge je Strecke und Monat aus dem Bericht des Abschlusses.

### Auslastung / Marge je Streckenlänge (Median je Jahr, Mittel der Jahre, Haupt-Läufe; E67)

| Jahrzehnt | kurz | Strecken | mittel | Strecken | lang | Strecken | mit Widebody |
|---|---|---|---|---|---|---|---|
| 1960er | 100 % / 24 % | 27 | 100 % / 23 % | 49 | 100 % / 24 % | 14 | 0 |
| 1970er | 100 % / 13 % | 55 | 100 % / 11 % | 87 | 100 % / 7 % | 25 | 6 |
| 1980er | 100 % / 29 % | 61 | 100 % / 34 % | 104 | 100 % / 36 % | 55 | 36 |
| 1990er | 100 % / 32 % | 67 | 100 % / 37 % | 163 | 100 % / 38 % | 146 | 74 |
| 2000er | 100 % / 21 % | 72 | 100 % / 20 % | 178 | 100 % / 18 % | 128 | 74 |
| 2010er | 100 % / 28 % | 80 | 100 % / 31 % | 212 | 100 % / 31 % | 132 | 76 |

kurz unter 1 000 km, mittel bis 3 500 km, lang darüber (Großkreis). „Strecken“ = KI-Strecken je Monat und Lauf. „mit Widebody“ = KI-Strecken mit einem Flugzeug der Klasse Widebody im Januar, je Lauf (E81).

### Preisniveau Economy je Persönlichkeit (Median, Mittel der Jahre)

| Jahrzehnt | flag | lcc | expansionist | optimizer | boutique |
|---|---|---|---|---|---|
| 1960er | 1,18 | 0,91 | 0,94 | 1,40 | 1,13 |
| 1970er | 1,17 | 0,94 | 0,96 | 1,55 | 1,12 |
| 1980er | 1,17 | 0,92 | 0,95 | 1,57 | 1,14 |
| 1990er | 1,14 | 0,88 | 0,88 | 1,42 | 1,09 |
| 2000er | 1,15 | 0,91 | 0,92 | 1,40 | 1,10 |
| 2010er | 1,17 | 0,91 | 0,95 | 1,39 | 1,12 |

### Preis-Sprünge von Monat zu Monat (|Δ Preisniveau Economy| je Strecke)

| Jahrzehnt | Optimizer Median | Optimizer p90 | Optimizer ≥ 0,25 | andere p90 | andere ≥ 0,25 |
|---|---|---|---|---|---|
| 1960er | 0,03 | 0,09 | 1,1 % | 0,02 | 0,0 % |
| 1970er | 0,02 | 0,09 | 0,7 % | 0,01 | 0,0 % |
| 1980er | 0,02 | 0,07 | 0,2 % | 0,02 | 0,0 % |
| 1990er | 0,02 | 0,06 | 0,2 % | 0,02 | 0,0 % |
| 2000er | 0,02 | 0,08 | 1,5 % | 0,02 | 0,0 % |
| 2010er | 0,02 | 0,07 | 0,3 % | 0,02 | 0,0 % |

„Sprung“ = Änderung um mindestens 0,25 Preisniveau in einem Monat (z. B. 1,20 → 1,45).

### Umsteiger in Märkten mit Direktangebot (Januar, Mittel der Haupt-Läufe)

| Januar | Paare | Anteil Median | Anteil p90 | Wunsch Median | Paare über 25 % | Anteil gesamt | Umsteiger ohne Direktangebot je Woche |
|---|---|---|---|---|---|---|---|
| 1965 | 16 | 0,0 % | 2,6 % | 26,7 % | 1,7 % | 0,1 % | 11 447 |
| 1970 | 44 | 0,0 % | 3,9 % | 32,2 % | 2,7 % | 0,4 % | 19 590 |
| 1975 | 18 | 0,0 % | 4,3 % | 33,1 % | 4,3 % | 0,1 % | 4 831 |
| 1980 | 29 | 0,0 % | 8,3 % | 31,1 % | 4,5 % | 0,4 % | 14 785 |
| 1985 | 84 | 0,0 % | 5,2 % | 29,2 % | 1,9 % | 0,7 % | 37 050 |
| 1990 | 127 | 0,0 % | 5,2 % | 28,6 % | 2,2 % | 0,7 % | 56 184 |
| 1995 | 151 | 0,0 % | 8,5 % | 28,3 % | 2,5 % | 0,8 % | 70 484 |
| 2000 | 159 | 0,0 % | 9,2 % | 28,0 % | 2,9 % | 0,9 % | 88 028 |
| 2005 | 106 | 0,0 % | 8,4 % | 27,6 % | 3,4 % | 0,7 % | 72 499 |
| 2010 | 114 | 0,4 % | 18,7 % | 23,6 % | 6,6 % | 1,4 % | 160 004 |
| 2015 | 141 | 0,0 % | 14,0 % | 27,3 % | 4,0 % | 1,1 % | 97 806 |
| 2020 | 147 | 0,0 % | 11,9 % | 27,4 % | 3,6 % | 1,0 % | 105 094 |

Anteil = platzierte Umsteiger ÷ (Direktgäste + Umsteiger) je Paar O–D mit Direktangebot und Umsteige-Verbindung. „Wunsch“ = vor der Verteilung auf freie Sitze. `CONNECTION_APPEAL` = 0,50.

### Wachstum der KI (Mittel der Jahre, Haupt-Läufe)

| Jahrzehnt | KI | Flugzeuge je KI | Eröffnungen je KI und Jahr | Käufe je KI und Jahr | Schließungen je KI und Jahr | Verkäufe je KI und Jahr | neue Drehkreuze je Jahr | Nachrücker je Jahr | Auflösungen je Jahr |
|---|---|---|---|---|---|---|---|---|---|
| 1960er | 5,0 | 20 | 3,9 | 3,2 | 0,6 | 0,1 | 0,45 | 0,00 | 0,00 |
| 1970er | 5,0 | 34 | 3,1 | 2,2 | 3,5 | 2,5 | 0,20 | 0,00 | 0,00 |
| 1980er | 5,0 | 46 | 3,8 | 3,6 | 0,5 | 1,7 | 0,03 | 0,00 | 0,00 |
| 1990er | 5,0 | 76 | 2,6 | 2,3 | 0,4 | 2,2 | 0,03 | 0,00 | 0,00 |
| 2000er | 5,0 | 77 | 2,8 | 1,6 | 3,8 | 5,4 | 0,03 | 0,00 | 0,00 |
| 2010er | 5,0 | 86 | 2,1 | 1,7 | 0,5 | 3,8 | 0,03 | 0,00 | 0,00 |

### Geld und Slots der KI je Jahr (Preise von 1960, Mittel je lebender KI, Haupt-Läufe)

| Jahrzehnt | Erlös | Ergebnis | Zuschuss | Dividende | Kasse (Januar) | Slot-Haltungen an der eigenen Grenze | größter KI-Anteil an einem Flughafen |
|---|---|---|---|---|---|---|---|
| 1960er | 470 Mio. $ | 107 Mio. $ | 0 Mio. $ | 21 Mio. $ | 212 Mio. $ | 1,3 % | 24 % |
| 1970er | 798 Mio. $ | 83 Mio. $ | 0 Mio. $ | 69 Mio. $ | 529 Mio. $ | 1,0 % | 25 % |
| 1980er | 1 406 Mio. $ | 486 Mio. $ | 0 Mio. $ | 298 Mio. $ | 881 Mio. $ | 1,2 % | 29 % |
| 1990er | 2 542 Mio. $ | 927 Mio. $ | 0 Mio. $ | 791 Mio. $ | 1 591 Mio. $ | 3,2 % | 31 % |
| 2000er | 2 374 Mio. $ | 435 Mio. $ | 0 Mio. $ | 393 Mio. $ | 1 906 Mio. $ | 1,6 % | 30 % |
| 2010er | 2 494 Mio. $ | 741 Mio. $ | 0 Mio. $ | 648 Mio. $ | 1 731 Mio. $ | 3,2 % | 30 % |

Slot-Haltung = eine KI mit Slots an einem Flughafen; Grenze = `rivalSlotCap` (25 % am Drehkreuz, sonst 10 %, 7.10).

### KI-Stärke: Gründer nach 40 Jahren (mit Zuschuss)

| Stärke | Läufe | Median Unternehmenswert | Flugzeuge je Gründer | aufgelöste Gründer |
|---|---|---|---|---|
| easy | 3 | 1 995 Mio. $ | 38 | 0 |
| normal | 10 | 2 864 Mio. $ | 84 | 0 |
| hard | 3 | 2 812 Mio. $ | 96 | 0 |

### Rechenzeit (ein Prozess, alle Flughäfen der Daten)

| Jahrzehnt | ms je Monat | KI-Strecken |
|---|---|---|
| 1960er | 248 | 96 |
| 1970er | 554 | 155 |
| 1980er | 708 | 216 |
| 1990er | 983 | 353 |
| 2000er | 1 226 | 377 |
| 2010er | 1 130 | 428 |
| ganzer Lauf | 7,9 min |  |

Gemessen während mehrere Läufe gleichzeitig rechneten; ein einzelner Lauf ist etwas schneller.

