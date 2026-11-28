# Balance-Bericht

Erzeugt mit `npm run balance` aus `src/balance/` (Pakete 3.9a–3.9c; Langläufe mit `--long`). Alle Zahlen kommen aus den Funktionen in `src/model/`
mit den Startwerten aus `src/model/constants.ts`; das Skript ändert keine Konstante. Bewertung und Empfehlungen:
`docs/neubau/BALANCE.md`.

Urteile: **ok** = Regel der Spezifikation gilt; **Abweichung** = Regel gilt nicht (Entscheidung nötig);
**Info** = keine feste Grenze in der Spezifikation, Wert zur Bewertung.

Prüfregeln: 21 ok · 0 Abweichung · 33 Info.

## Auswertung Paket D4 (von Hand ergänzt, 28.11.2026)

Auftrag: Antworten auf O102 (B), O103 (B) und O104 (A) umsetzen (`D2-spieltest.md`, Abschnitt 5; `D3-bericht.md`,
Auswertung). Funde 87–89 in `BALANCE.md`, Frage O105.

### Kurz

- **O102 = B (E109):** `DEMAND_GROWTH_1960_2019` 1,5 → **1,3**, `DEMAND_SCALE` 8,1 → **9,5**
  (`src/model/constants.ts`). Märkte 2025 gleich (Faktor 1,002), 1995 × 1,08, 1970 × 1,14, 1960 × 1,17 gegen D2.
  Regel B3.1 jetzt Summe × **1,65** (gemessen 1,65; `src/balance/market.ts:239`).
- **O103 = B (E110):** Kaufneigung von Flag 1 → **0,5** (`src/model/constants.ts`, Persönlichkeit `flag`), gewählt
  mit vier Hilfsläufen. B7.1 nach 20 / 40 Jahren **1,45 / 1,96** (D3: 1,30 / 2,54).
- **O104 = A (E111):** Band der KI-Marge (B7.10) 10–**30 %** (`src/balance/competition.ts:19`); gemessen 26 %.
- **Langlauf: 21 ok · 0 Abweichung · 33 Info** (D3: 19 · 2 · 33).
- **Offen:** 1970 bringt Hard mit 1,3 nur 23–28 % des Easy-Ergebnisses (D2: 21–23 %; E106: etwa 30–50 %) → O105.

### 1. Hilfsläufe zu O103

Je 10 Läufe × 40 Jahre Normal (`npm run balance -- --long --runs 10 --years 40 --strength-runs 0`), alle mit
Wachstum 1,3 und `DEMAND_SCALE` 9,5. Unternehmenswert ÷ Median aller.

| Lauf | Flag-Kaufneigung | B7.1 nach 20 / 40 Jahren | Flag nach 20 / 40 Jahren | stärkste nach 40 Jahren |
|---|---|---|---|---|
| H0 | 1 (wie D3) | 1,30 / **2,60** | 1,24 / 2,60 | flag |
| H1 | 0,7 | 1,26 / **2,26** | 0,93 / 2,26 | flag |
| **H2** | **0,5 (gewählt)** | **1,45 / 1,96** | **0,77 / 1,82** | expansionist 1,96 |
| H3 | 0,4 | **2,87** / **2,14** | **0,35** / 1,44 | expansionist 2,14 |

- O102 allein (H0) hebt Flag weiter: 2,60 statt 2,54 in D3.
- Die Kaufneigung wirkt schwach: 0,7 senkt Flag nach 40 Jahren nur um 16 %. Mit 0,4 bleibt Flag früh zu klein
  (nach 20 Jahren 0,35 × Median, B7.1 verletzt). 0,5 ist der einzige gemessene Wert mit B7.1 ok, knapp unter der
  Grenze (expansionist 1,96).
- Die „Flugzeuggröße“ ist keine Zahl der Persönlichkeit; sie hätte neuen Code gebraucht. Die Kaufneigung reichte.
- Der volle Langlauf (60 Jahre) trifft H2 nach 20 und 40 Jahren genau (gleiche Startwerte).

### 2. Spieltest-Matrix

`scripts/playtest-matrix.ts --jobs 2`, verkleinert wie in D2 (optimierer, vorsichtig, luxus, standard, Startwert 1,
alle Zeitalter und Stufen; 1970 dazu Startwert 2 ohne standard). 42 Spiele, kein Fehler, keine Pleite. Mit allen drei
Änderungen (auch Flag 0,5). Ergebnis der letzten 12 Monate in Mio. $, Easy / Normal / Hard.

**Normal Mode, DUS, 1970–1979** (Mittel zweier Startwerte; standard nur Startwert 1)

| Strategie | 5.4h (vor D1) | D2 (1,5) | **D4 (1,3)** | Hard ÷ Easy D2 → D4 |
|---|---|---|---|---|
| standard | +1,1 / −3,0 / −5,5 | +0,4 / −3,1 / −4,8 | +0,4 / −3,1 / −4,8 | – |
| vorsichtig | +14 / +4,2 / −2,0 | +15 / +5,8 / −8,9 | **+22 / +9,8 / −9,1** | Verlust |
| luxus | +65 / +38 / +21 | +49 / +23 / +11 | **+59 / +28 / +14** | 23 % → **23 %** |
| optimierer | +80 / +59 / +34 | +77 / +35 / +16 | **+92 / +53 / +25** | 21 % → **28 %** |

Firmenwert nach 10 Jahren Hard ÷ Easy: optimierer 39 %, luxus 40 % (D2: 37 / 39 %). Tiefste Kasse guter Strategien auf
Hard 1,1–2,8 Mio. $.

**Free Mode, FRA, 1995–2004** (Startwert 1)

| Strategie | D2 (1,5) | **D4 (1,3)** | Hard ÷ Easy |
|---|---|---|---|
| standard | −0,6 / −3,7 / −4,7 | −0,6 / −3,7 / −4,7 | – |
| vorsichtig | +162 / +99 / +61 | **+175 / +110 / +74** | 42 % |
| luxus | +234 / +162 / +100 | **+258 / +167 / +115** | 45 % |
| optimierer | +413 / +264 / +149 | **+443 / +280 / +170** | 38 % |

**Free Mode, FRA, 2025–2029** (Startwert 1)

| Strategie | D2 (1,5) | **D4 (1,3)** | Hard ÷ Easy |
|---|---|---|---|
| standard | +3,5 / +0,2 / −1,3 | +3,5 / +0,2 / −1,3 | – |
| luxus | +143 / +114 / +89 | **+145 / +111 / +87** | 60 % |
| optimierer | +311 / +217 / +159 | **+312 / +213 / +156** | 50 % |

- Mehr Nachfrage hebt Easy stärker als Hard: optimierer 1970 Easy +15, Hard +9 Mio. $ gegen D2. Das Verhältnis
  steigt darum nur langsam (optimierer 21 → 28 %, luxus 23 → 23 %).
- 2025 bleibt wie D2 (Märkte gleich). 2025 liegt luxus mit 60 % über dem Band, wie schon in D2 (62 %).

### 3. Frage O105

1970 (Normal Mode, DUS) bringt Hard mit Wachstum 1,3 nur 23–28 % des Easy-Ergebnisses guter Strategien (optimierer
+25 von +92, luxus +14 von +59 Mio. $; Firmenwert 39–40 %). E106 nennt etwa 30–50 %. 1995 (38–45 %) passt, 2025
(50–60 %) wie in D2. Ein flacheres Wachstum hebt Easy mehr als Hard; von 1,5 auf 1,3 stieg das Verhältnis nur um 0–7
Prozentpunkte.

- **A: so lassen.** Hard ist 1970 klar gewinnbar, der Firmenwert liegt im Band; das Band für das Ergebnis gilt ab 1990.
- **B (Empfehlung): Kosten-Faktor Hard vor 1980 kleiner** (etwa 1,05 statt 1,1 bis 1979, neue Regel zu E87), Wert mit
  der Spieltest-Matrix im nächsten Paket. Wirkt direkt auf Hard; Easy, Normal und die KI bleiben gleich.
- **C: Wachstum noch flacher** (etwa 1,1, `DEMAND_SCALE` ≈ 11,3). Wirkt schwach, entfernt sich weiter von E7 und
  verschiebt den Langlauf erneut (Flag, E110).

### 4. Langlauf (Vergleich)

| Prüfregel | 5.4g | D3 (nach D2) | **D4** |
|---|---|---|---|
| B7.1 Faktor nach 20 / 40 Jahren | 1,82 / 1,82 | 1,30 / 2,54 | **1,45 / 1,96** (ok) |
| B7.10 KI-Marge | 23 % (Band 10–25 %) | 26 % (Abweichung) | **26 %** (Band 10–30 %, ok) |
| B7.3 Preisniveau Y Median · Preiskampf · Gesellschaften je Paar | 1,05 · 0,1 % · 1,00 | 1,03 · 0,6 % · 1,03 | 1,01 · 0,7 % · 1,03 |
| B7.11 Strecken mit Widebody je Jahr (Januar) | 0,3 | 44,5 | 45,4 |
| B7.12 Langstrecke der KI | 12,5 % | 34,0 % | 34,5 % |
| B3.13 Umsteiger p90 · Paare über 25 % | 1,1 % · 0,3 % | 8,4 % · 3,4 % | 7,9 % · 3,2 % |
| B7.6 Dividende je KI und Jahr (Mio. $ von 1960) | 122 | 370 | 367 |
| B7.8 KI-Stärke Easy / Normal / Hard (Median nach 40 Jahren) | 731 / 1 487 / 1 556 | 1 995 / 2 864 / 2 812 | 1 626 / 2 992 / 2 483 |
| B7.9 Rechenzeit 2010er (ms je Monat) | 1 095 | 1 130¹ | 753 |

¹ Zwei Langläufe gleichzeitig; nicht vergleichbar. D4: die ersten 4 Läufe mit 2 Prozessen neben der Spieltest-Matrix, der Rest mit 4 Prozessen allein.

Unternehmenswert je Persönlichkeit ÷ Median aller (10 Läufe Normal):

| nach Jahren | Median aller | flag | lcc | expansionist | optimizer | boutique |
|---|---|---|---|---|---|---|
| 10 | 1 048 | 0,94 | 0,93 | 1,03 | 1,22 | 0,90 |
| 20 | 959 | 0,77 | 1,02 | 1,15 | 1,22 | 0,69 |
| 40 | 2 992 | 1,82 | 0,73 | **1,96** | 1,01 | 1,05 |
| 60 | 3 276 | 2,67 | 0,82 | 1,46 | 0,93 | 1,01 |

Median aller in Mio. $ von 1960. B7.1 prüft nur 20 und 40 Jahre; nach 60 Jahren liegt Flag wieder bei 2,67 (Fund 88).


## Übersicht der Prüfregeln

| Nr. | Spez. | Regel | Wert | Urteil |
|---|---|---|---|---|
| B1.1 | 1.3, 5.2 | Treibstoff (Tabelle) gegenüber Kostenindex: wie stark verschiebt sich das Verhältnis 1960 → 2020 (Grundlage der Langstrecken-Marge, 5.18) | Treibstoff ÷ Kostenindex 2020 = 1,24 (1960 = 1) | Info |
| B2.1 | 2.10 | `satisfactionFactor(50)` liegt bei 0,75 (± 0,05) | 0,750 | ok |
| B2.2 | 2.6.2, 7.4 | Stärke der Service-Abzüge: Satisfaction der LCC (kein Service, dichte Kabine) auf Kurzstrecke; Ausgleich über Preis-Lage 0,95 (7.4) | LCC Economy FRA–CDG: 89 → Faktor 0,95 | Info |
| B3.1 | 3.3 | Die Summe der Marktgrößen aller Paare wächst 1960 → 2019 um × 1,65 (± 10 %, E64, E108, E109) | Summe 1,65, Mittel der Verhältnisse 2,17, Median 1,49 (115 440 Paare) | ok |
| B3.2 | 3.7 | Premium-Anteil schwankt über alle Paare: 5 %- bis 95 %-Wert mindestens 3 Prozentpunkte auseinander (1990) | 6,9 % … 11,1 % (4,1 Pp.) | ok |
| B3.3 | 3.4 | Entfernungs-Faktor kurz : lang (45 min : 20 h); Startwert 5,2 | 2,68 | Info |
| B3.4 | 3.9.3 | Stärke von `FLIGHT_TIME_EXP`: Anziehung Turboprop ÷ Jet bei sonst gleichem Angebot | FRA–CDG 0,72, FRA–MAD 0,65 | Info |
| B3.5 | 1.8 | Stärke der Schwierigkeit: Fluggäste des Spielers auf Hard gegenüber Normal (gegen einen gleichen Rivalen) | −5,7 % | Info |
| B4.1 | 3.6, 4.10 | Marktgröße gegenüber einem Flugzeug: Strecken, die selbst beim höchsten Preisniveau voll bleiben (Hinweis aus 3.8b) | keine | Info |
| B4.2 | 4.10, 7.6, E103 | Wechselseitige beste Antworten zweier gleicher Gesellschaften laufen nicht gegen 0: tiefster Preis ≥ 90 % der Gewinnschwelle voller Maschine; mit einem Flugzeug je Gesellschaft (erster Fall) auch Ergebnis > 0. Ein Verlust mit mehr Sitzen, als der Markt füllt, kommt aus der Überkapazität, nicht aus dem Unterbieten (Paket 3.9d, E103) | 14 Abflüge: tiefster Preis Y 1,95, Schwelle 0,87 (225 %), Ergebnis 262 183 $; 28 Abflüge: tiefster Preis Y 1,51, Schwelle 0,76 (197 %), Ergebnis 252 454 $ | ok |
| B4.3 | 7.6 | Enden die besten Antworten in einem festen Punkt? Nicht verlangt (7.6, E65); verlangt ist B4.2 | 14 Abflüge: fest; 28 Abflüge: Zyklus | Info |
| B4.4 | 4.10 | Bester Preis gegen einen gleichen Rivalen beim Marktpreis (Hinweis 4.10: 70 % des Marktpreises) | 14 Abflüge: 1,95; 28 Abflüge: 1,51 | Info |
| B4.5 | 3.6, 4.10 | Empfindlichkeit: bester Preis Y eines A320ceo allein auf FRA–MAD 1990 bei kleinerer Marktgröße | × 1,00: 2,06; × 0,50: 1,59; × 0,25: 1,11; × 0,10: 1,03 | Info |
| B5.1 | 5.5 | Landegebühr auf Kurzstrecke 26–40 % der Kosten (Hinweis 5.5 / 5.18) | Caravelle III FRA–CDG 1962: 31 %; ATR 72-200 HAM–NUE 1990: 28 % | ok |
| B5.2 | 5.18 | Marge beim besten Preis: Langstrecke gegenüber Kurz- und Mittelstrecke (Hinweis 5.18: Langstrecke sehr einträglich) | Lang Ø 40 %, kurz/mittel Ø 45 % | Info |
| B5.3 | 5.6 | Check-in und Abfertigung ohne Bodenpersonal-Aufschlag: Anteil an den Kosten (heute mit Bodenpersonal 2–4 % mehr) | 3 % … 17 % | Info |
| B5.4 | 5.13, E54 | Listenpreise und Abschreibung: Jahre, bis eine Strecke den Kaufpreis eines neuen Flugzeugs einspielt | 1,0 … 10,7 Jahre | Info |
| B5.5 | E7 | Eine gut geführte Strecke jeder Länge bringt in jedem Jahrzehnt Gewinn (alle Fälle beim besten Preis) | 11 von 11 mit Gewinn | ok |
| B5.6 | 7.4, E45 | Vorschau „ähnlicher Erfolg“: Ergebnis LCC ÷ Flag mit demselben Flugzeug allein auf derselben Strecke | A320ceo FRA–MAD 1990: 0,65 (Marge 45 % gegen 52 %) | Info |
| B6.1 | 6.1, E36 | Ruf-Ziel bei üblicher Satisfaction um 50: Median der Ruf-Ziele aller Ausstattungen (5 Persönlichkeiten × 2 Strecken, ohne Forschung) in 40 … 60 | Median 47,0; Flag: A320ceo FRA–MAD 1990 Satisfaction 124 → 69,6, A330-300 FRA–JFK 1995 Satisfaction 105 → 54,6 | ok |
| B6.2 | 6.1 | Steigungen 0,5 (unter 100) und 0,83 (über 100): Spanne der Ruf-Ziele aller Ausstattungen, mit und ohne Forschung | 24,1 … 76,3 (Satisfaction 48 … 132) | Info |
| B6.3 | 6.2, 8.6 | `CANCELLED_REPUTATION_WEIGHT` = 100: erwarteter Abzug im Ruf-Ziel und Wirkung eines Defekts (ohne Charter) | erwartet Alter 0: 0,70, Alter 10: 1,16, Alter 20: 1,62 Punkte; ein Defekt bei 1 Flugzeug: Ruf −7,5 im Monat, 13 Monate bis < 1 Punkt; bei 10 Flugzeugen −0,75 | Info |
| B6.4 | 6.3, E37 | Werbung hebt den Ruf im Gleichgewicht um höchstens 3 Punkte und klingt nach dem Ende ab | größter Anstieg 3,00 (alle drei Kampagnen); Nachfrage-Wirkung über den Ruf 0,6 % | ok |
| B6.9 | 3.9.5, 5.14 | Werbung: Kosten je Monat ÷ Mehr-Ergebnis je Strecke (Strecken, ab denen eine Kampagne sich trägt) | 1990 local 20,3; 1990 national 30,0; 1990 global 44,4; 2019 local 24,8; 2019 national 34,5; 2019 global 49,6 | Info |
| B6.5 | 6.7, E36 | Ruf-Schwellen der Ränge: Rang 9 (Ruf 65) ist mit der besten Ausstattung und Forschung erreichbar; Rang 5 (Ruf 50) mit üblicher (Flag) Ausstattung | bestes Ziel 76,3 (ohne Forschung 69,6); Flag ohne Forschung ≥ 54,6 | ok |
| B6.6 | 6.10 | Ruf-Meilensteine 60 / 70 / 80: Satisfaction, die sie brauchen, und ob eine Ausstattung sie erreicht | 60 → Satisfaction 112, 70 → Satisfaction 124, 80 → Satisfaction 136; Gold mit keiner KI-Ausstattung erreichbar; beste Spieler-Ausstattung: Flag FRA–MAD 81,9 (mit Werbung 84,9), Boutique FRA–MAD 78,8 (mit Werbung 81,8), Flag FRA–JFK 66,4 (mit Werbung 69,4), Boutique FRA–JFK 62,6 (mit Werbung 65,6) | Info |
| B6.7 | 6.8 | Eine Gesellschaft, die die Bedingungen eines Rangs gerade erfüllt, bezahlt die Klassen-Forschung dieses Rangs aus höchstens 12 Monatsergebnissen | Rang 1: 4,5 (bei Marge 10 %: 21,6); Rang 2: 4,3 (bei Marge 10 %: 22,6); Rang 4: 1,2 (bei Marge 10 %: 6,3); Rang 5: 2,6 (bei Marge 10 %: 11,8) | ok |
| B6.8 | 6.11, E58 | Ziel-, Prämien- und Straf-Anteile: Prämie in Monatsergebnissen und nötige Chance, damit das hohe Ziel mehr bringt als das sichere | Prämie sicher / hoch = 0,24 / 0,60 Monatsergebnisse (ohne Mindestbetrag); hohes Ziel lohnt ab Chance 60 % … 60 %; Mindestprämie bindet bei 1 von 6 Beispielen (gestaffelt nach Art, E83: auch dann zahlt das hohe Ziel mehr) | Info |
| B7.13 | 7.11, E81, E84, E85 | Größte Langstrecken-Paare (über 3 500 km, beide Flughäfen ab Größe 3): bringt der beste Widebody der KI mehr als der beste Narrowbody? | 38 von 49 Paaren vor Kapitalkosten (Planer-Zahl), 37 von 49 nach Kapitalkosten (1990, 2000, 2010, je 20 Paare) | Info |
| B7.14 | 7.11, E81, E84, E85 | Paare über 7 500 km (fast nur Widebodies haben die Reichweite): Widebody vorn und nach Kapitalkosten mit Gewinn | Widebody vorn auf 30 von 30 Paaren, davon mit Gewinn nach Kapitalkosten 30 | Info |
| B8.1 | 8.5 | Preis-Absicherung (`HEDGE_PRICE_SHARE` = 0,35): Ersparnis ÷ Preis je Ölkrise | 1973 Oil Crisis: 2,64; 1979 Energy Crisis: 1,42; Gulf War Oil Shock: 1,05 | Info |
| B8.2 | 8.5 | Rückgewinnung (`RECOVERY_PRICE_SHARE` = 0,25): Mehr-Ergebnis ÷ Preis (A320ceo FRA–MAD allein, Preis vor der Krise fest) | Downturn × 1,00: 2,72; Downturn × 0,25: 1,52; Financial × 1,00: 2,59; Financial × 0,25: 1,43; Pandemic × 1,00: 2,13; Pandemic × 0,25: 0,71 | Info |
| B8.3 | 8.9, E32 | `CHARTER_MARKUP`: Charter lohnt gegenüber Streichen auf jeder Strecke mit Gewinn (Vorteil je Flug > 0) | 12 von 12 Strecken mit Gewinn; kleinster Vorteil 1 524 $ je Flug (Gebühr ÷ Erlös je Flug 27 % … 159 %) | ok |
| B8.10 | 8.9, E76, R2 | Beträge der Störungs-Frage (`charterQuestionFigures`, Flughafen-Streik 60 %) = Rechnung des Monats mit und ohne Charter (Erlösverlust, Gebühr, Vorteil) | 14 von 14 Fällen gleich; echter Erlösverlust ÷ Erlös im Mittel 93 % … 100 % (so weit lag die Schätzung bis 5.3a daneben) | ok |
| B8.4 | 8.11, E30 | Händler-Spanne −15 % / +5 %: Gebraucht kaufen und sofort verkaufen bringt höchstens 83,0 % zurück; Verlust in Monatsergebnissen einer Strecke | höchstens 83,0 %; Verlust Kauf→Verkauf Alter 0: 8,14, Alter 5: 5,85, Alter 10: 4,12, Alter 20: 1,61 Monatsergebnisse (A320ceo FRA–MAD) | ok |
| B8.5 | 8.12, E30 | Vorbestell-Rabatt höchstens 12 % < 12,9 % (Vorbestellen und sofort verkaufen bringt nie Gewinn); Rabatt als Ertrag der Anzahlung | Rabatt 5 … 12 %; sofort verkauft −0,9 % des Werts; Rabatt ÷ Anzahlung je Jahr 23 % … 42 % (Kreditzins 8 %) | ok |
| B8.6 | 8.13, E31 | Überholung (`OVERHAUL_PRICE_SHARE` = 0,04): Preis ≥ Wertgewinn; wo bindet der Mindestpreis? | Preis ≥ Wertgewinn in 5 von 5 Fällen; Mindestpreis bindet in 0; Defekt-Chance sinkt um 1,33 % / 0,40 % / 1,33 % / 1,33 % / 0,80 % je Monat | ok |
| B8.11 | 8.13 | Kabinen-Umbau (Kabine + `REFIT_PER_SEAT_1960` × Sitze, mit Kostenindex): Preis in Monatsergebnissen der Strecke | A320ceo FRA–MAD 1990: 0,3 (Lohn 0,14); A320ceo FRA–MAD 2019: 0,7 (Lohn 0,15); A330-300 FRA–JFK 2019: 0,9 (Lohn 0,24); ATR 72-200 HAM–NUE 1990: 1,2 (Lohn 0,80) | Info |
| B8.7 | 8.10 | Verschleiß mit `WEEKS_PER_MONTH`: Punkte je Jahr und Jahre bis Zustand 50 (Kabine / Zelle) bei typischem Flugplan | 45 … 452 Stunden je Monat; Kabine 1,8 … 7,7, Zelle 1,6 … 5,3 Punkte je Jahr | Info |
| B8.8 | 8.14, E34 | Kreditlinie (8 % Zins, Grenze `CREDIT_LIMIT_SHARE` × Flottenwert): Grenze in Monaten fester Strecken-Kosten; Zins bei voller Nutzung gegen das Monatsergebnis | Grenze = 4,5 … 33,7 Monate fester Kosten; Zins = 4 % … 500 % des Monatsergebnisses | Info |
| B8.9 | 8.15, 6.15 | Szenario „Oil Shock“: Ruf 55 bis zum Stichtag ist mit einer besseren Kabine erreichbar, aber nicht ohne Zutun | nach 39 Monaten: LCC-Kabine, Zustand 60 28,0; Flag-Kabine, Zustand 60 (ohne Umbau) 52,3; Flag-Kabine nach Umbau (Zustand 90) 58,2; Boutique-Kabine nach Umbau (Zustand 90) 57,5 | ok |
| B7.1 | 7.4 | Ähnlicher Erfolg (Zuschuss abgeschafft): Median des Unternehmenswerts je Persönlichkeit nach 20 und 40 Jahren innerhalb Faktor 2 des Medians aller | Faktor 1,45 nach 20, 1,96 nach 40 Jahren (schwächste: lcc, stärkste: expansionist; 10 Läufe) | ok |
| B7.2 | 7.14 | Abschaffung des Zuschusses | abgeschafft (E68, `RIVAL_SUBSIDY_ENABLED = false`); die Haupt-Läufe sind Läufe ohne Zuschuss | Info |
| B7.3 | 7.6 | Preise und Preiskampf im laufenden Spiel (Nachweis zu O60) | Preisniveau Y Median 1,01, p10 0,86; Preiskampf 0,7 % der Strecken; 1,03 Gesellschaften je Paar; Auslastung 100 %; Marge 26 % | Info |
| B7.4 | 7.6, E65 | Störende Sprünge der Optimizer-Preise (Schritte ≥ 0,25 je Monat) | Optimizer 0,7 % der Strecken-Monate (p90 0,08), andere 0,0 % | Info |
| B7.10 | 3.6, E67 | Marktgröße: typische KI-Strecke mit Marge 10 %–30 % (Median, Mittel der Jahre). Auslastung nur Info (E71): Ziel 75 %–90 % gilt für den Spieler beim besten Preis; die KI fliegt ihre Paare meist allein und wählt eine volle Maschine | Marge 26 %; Auslastung 100 % (Info) | ok |
| B3.13 | 3.13 | Umsteiger in Märkten mit Direktangebot typisch unter 25 % | Median je Paar 0,0 %, p90 7,9 %; Paare über 25 %: 3,2 % | ok |
| B7.5 | 7.10 | Slot-Anteile der KI | Haltungen an der eigenen Grenze 1,8 %; größter KI-Anteil an einem Flughafen 35 % | Info |
| B7.11 | 5.10, 7.10, E78 | Widebody-Slots erst ab Flughafengröße 3: keine KI-Strecke mit Widebody an einem kleineren Flughafen | Strecken mit Widebody je Jahr (Januar) im Mittel 45,4; davon an Flughäfen unter Größe 3: 0 (alle Jahre und Läufe) | ok |
| B7.12 | 7.11, E81 | Langstrecke der KI: Anteil der KI-Strecken über 3 500 km ab 1990 deutlich über 5 % (Ziel aus O76) | 34,5 % der Strecken-Monate; Strecken mit Widebody (Januar) ab 1990 im Mittel 76,6 je Lauf | ok |
| B7.6 | 7.13 | Dividende und neue Drehkreuze (`NEW_HUB_MIN_SEATS`) | Dividende je KI und Jahr 367 Mio. $ (1960); neue Drehkreuze 7,4 je Lauf | Info |
| B7.7 | 7.9, 7.11 | Eröffnungen und Käufe je Jahr | je KI und Jahr: 2,9 Eröffnungen, 2,3 Käufe, 1,4 Schließungen | Info |
| B7.9 | 7.9 | Rechenzeit der KI-Planung mit allen Flughäfen | 753 ms je Monat in den 2010ern; 5,9 min je Lauf | Info |
| B7.8 | 7.3 | KI-Stärke-Werte: Easy < Normal < Hard im Erfolg | easy 1 626 Mio. $, normal 2 992 Mio. $, hard 2 483 Mio. $ | Info |

## Abschnitt 1: Zeit und Geld

### Kostenindex, Nachfrage-Wachstum, Treibstoff, Marktpreis (Januar)

| Jahr | costIndex | demandGrowth | Treibstoff je Gallone | Treibstoff ÷ Index (1960 = 1) | Marktpreis Y FRA–MAD |
|---|---|---|---|---|---|
| 1960 | 1,00 | 1,00 | 1,05 $ | 1,00 | 98 $ |
| 1970 | 1,13 | 1,05 | 1,55 $ | 1,31 | 111 $ |
| 1980 | 1,27 | 1,09 | 2,92 $ | 2,19 | 125 $ |
| 1990 | 1,43 | 1,14 | 1,20 $ | 0,80 | 141 $ |
| 2000 | 1,61 | 1,19 | 1,72 $ | 1,02 | 158 $ |
| 2010 | 1,82 | 1,25 | 2,64 $ | 1,39 | 178 $ |
| 2020 | 2,05 | 1,31 | 2,66 $ | 1,24 | 201 $ |
| 2030 | 2,30 | 1,37 | 2,39 $ | 0,99 | 227 $ |

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
| HAM–NUE (klein, kurz) | 465 | 1 495 | 1 753 | 1 787 | 1 799 | 1 398 | 86,3 % / 7,2 % / 5,3 % / 1,3 % |
| FRA–CDG (groß, kurz) | 449 | 8 558 | 10 428 | 12 058 | 11 950 | 8 736 | 86,0 % / 7,2 % / 5,4 % / 1,3 % |
| FRA–MAD (Mittelstrecke) | 1 420 | 4 145 | 5 457 | 5 697 | 6 789 | 5 170 | 84,9 % / 7,7 % / 5,9 % / 1,5 % |
| ATL–ORD (US-Inland) | 976 | 6 351 | 11 545 | 10 039 | 8 456 | 5 779 | 86,8 % / 7,0 % / 4,9 % / 1,2 % |
| FRA–JFK (Langstrecke) | 6 189 | 5 257 | 5 503 | 5 241 | 4 730 | 3 658 | 80,2 % / 9,6 % / 7,6 % / 2,6 % |
| FRA–SIN (sehr lang) | 10 278 | 1 149 | 2 028 | 3 144 | 3 566 | 3 013 | 76,7 % / 11,0 % / 8,9 % / 3,4 % |

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
| Easy | 1,10 | 1,4 % | 5,2 % | 16 % |
| Normal | 1,00 | 0,0 % | 0,0 % | 15 % |
| Hard | 0,90 | −1,6 % | −5,7 % | 14 % |

Viele Abflüge, damit die Sitze nicht begrenzen. Allein wirkt der Faktor nur gegen „Nicht fliegen“ (1.8).

## Abschnitt 4: Preis und Erlös

### Preis und Auslastung typischer Strecken (eine Gesellschaft, Mai)

| Strecke | Marktgröße | Abflüge je Woche | Sitze je Woche | Auslastung bei Marktpreis | Auslastung bei Preisniveau 4 | Bester Preis (Niveau je Klasse) | Auslastung beim besten Preis | Gewinnschwelle voll | Gewinnschwelle bei dieser Auslastung |
|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 8 950 | 14 | 994 | 100 % | 29 % | 2,73 | 100 % | 1,29 | 1,29 |
| 707-320B FRA–JFK 1965 | 5 540 | 14 | 1 918 | 100 % | 7 % | 1,65 / 1,72 / 1,49 / 1,26 | 100 % | 0,92 | 0,92 |
| 727-200 FRA–MAD 1975 | 5 457 | 14 | 1 918 | 100 % | 11 % | 1,99 / 1,70 / 1,56 / 1,52 | 97 % | 1,07 | 1,09 |
| ATR 72-200 HAM–NUE 1990 | 1 787 | 14 | 966 | 100 % | 4 % | 1,40 | 100 % | 1,03 | 1,03 |
| A320ceo FRA–MAD 1990 | 5 697 | 14 | 1 876 | 100 % | 11 % | 2,06 / 1,70 / 1,54 / 1,50 | 97 % | 0,87 | 0,88 |
| A320ceo FRA–MAD 1990 (LCC) | 5 697 | 14 | 2 828 | 100 % | 2 % | 1,18 | 100 % | 0,65 | 0,65 |
| A320ceo ATL–ORD 1990 | 10 039 | 14 | 1 876 | 100 % | 22 % | 2,59 / 2,12 / 1,90 / 1,74 | 98 % | 1,01 | 1,03 |
| A330-300 FRA–JFK 1995 | 5 287 | 14 | 4 452 | 97 % | 4 % | 1,24 / 1,06 / 0,92 / 1,07 | 98 % | 0,51 | 0,52 |
| A320ceo FRA–MAD 2019 | 5 197 | 14 | 1 876 | 100 % | 11 % | 2,06 / 1,63 / 1,48 / 1,50 | 97 % | 0,93 | 0,95 |
| A330-300 FRA–JFK 2019 | 3 692 | 10 | 3 180 | 95 % | 3 % | 1,18 / 0,98 / 0,87 / 1,01 | 97 % | 0,68 | 0,70 |
| 787-9 FRA–SIN 2019 | 3 047 | 8 | 2 432 | 98 % | 3 % | 1,14 / 1,09 / 0,96 / 0,91 | 99 % | 0,63 | 0,64 |

Bester Preis nach 4.10 (gewinnbest, Kosten je Fluggast abgezogen). Abflüge: gewinnbeste gerade Zahl bis 14 (787-9: 8) beim besten Preis (`bestDeparturesCase`). Gewinnschwelle als Preisniveau für alle Klassen (4.11).

### Empfindlichkeit: Marktgröße × Faktor (wie ein kleineres `DEMAND_SCALE`), ein Flugzeug allein

| Strecke | × 1,00: Preis Y / Auslastung / Marge | × 0,50: Preis Y / Auslastung / Marge | × 0,25: Preis Y / Auslastung / Marge | × 0,10: Preis Y / Auslastung / Marge |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 1,40 / 100 % / 26 % | 1,04 / 87 % / −11 % | 1,04 / 43 % / −94 % | 1,04 / 17 % / −342 % |
| A320ceo FRA–MAD 1990 | 2,06 / 97 % / 52 % | 1,59 / 93 % / 34 % | 1,11 / 81 % / 3 % | 1,03 / 35 % / −110 % |
| A330-300 FRA–JFK 1995 | 1,24 / 98 % / 51 % | 0,89 / 73 % / 20 % | 0,89 / 36 % / −48 % | 0,89 / 15 % / −251 % |

Der Faktor wirkt als weltweites Ereignis im Beispiel-Spielstand (3.5), also genau wie eine andere Marktgröße; keine Konstante wird geändert.

### Preiskampf: zwei gleiche Gesellschaften (A320ceo, Flag-Ausstattung) auf FRA–MAD 1990, abwechselnd bester Preis

| Abflüge je Gesellschaft | Erste Antwort Y | Verlauf Y (Gesellschaft a) | fest | Endpreis (Niveau je Klasse) | Gewinnschwelle voll | Auslastung | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|
| 14 | 1,95 | 1,95 → 1,95 → 1,95 | ja | 1,95 / 1,43 / 1,25 / 1,39 | 0,87 | 97 % | 262 183 $ |
| 28 | 1,51 | 1,51 → 1,51 → 1,51 → 1,51 | nein, Zyklus | 1,51 / 0,84 / 0,78 / 1,46 | 0,76 | 89 % | 252 454 $ |

Jede Runde: a antwortet auf b, dann b auf a (`bestFareRatios`). 14 Abflüge = ein Flugzeug, 28 = zwei Flugzeuge je Gesellschaft (eine Strecke, mehr Sitze als der Markt füllt; bis Paket 3.9d 56 = vier Flugzeuge, bei der kleineren Marktgröße nur noch Überkapazität).

## Abschnitt 5: Kosten

### Erlös, Kosten und Ergebnis je Woche beim besten Preis

| Strecke | Erlös | Kosten | Ergebnis | Marge | Treibstoff | Landung | Gebühren je Fluggast | Verpflegung | Besatzung | Flugzeug-Anteil | Slots | Jahre bis Kaufpreis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 152 348 $ | 72 100 $ | 80 249 $ | 53 % | 16 % | 31 % | 16 % | 11 % | 4 % | 18 % | 5 % | 2,3 |
| 707-320B FRA–JFK 1965 | 1 047 413 $ | 624 869 $ | 422 544 $ | 40 % | 67 % | 9 % | 4 % | 10 % | 6 % | 4 % | 1 % | 1,0 |
| 727-200 FRA–MAD 1975 | 528 608 $ | 323 099 $ | 205 509 $ | 39 % | 45 % | 19 % | 8 % | 16 % | 3 % | 8 % | 1 % | 1,8 |
| ATR 72-200 HAM–NUE 1990 | 107 820 $ | 79 336 $ | 28 484 $ | 26 % | 8 % | 28 % | 14 % | 14 % | 7 % | 26 % | 3 % | 10,7 |
| A320ceo FRA–MAD 1990 | 629 954 $ | 304 249 $ | 325 705 $ | 52 % | 16 % | 24 % | 9 % | 20 % | 5 % | 25 % | 2 % | 3,4 |
| A320ceo FRA–MAD 1990 (LCC) | 472 200 $ | 259 617 $ | 212 584 $ | 45 % | 19 % | 28 % | 17 % | 0 % | 5 % | 29 % | 2 % | 5,2 |
| A320ceo ATL–ORD 1990 | 642 467 $ | 288 093 $ | 354 374 $ | 55 % | 12 % | 25 % | 10 % | 22 % | 3 % | 26 % | 2 % | 3,1 |
| A330-300 FRA–JFK 1995 | 2 302 806 $ | 1 118 495 $ | 1 184 311 $ | 51 % | 43 % | 9 % | 7 % | 16 % | 8 % | 16 % | 0 % | 2,3 |
| A320ceo FRA–MAD 2019 | 875 139 $ | 461 275 $ | 413 864 $ | 47 % | 22 % | 22 % | 9 % | 18 % | 4 % | 23 % | 2 % | 3,8 |
| A330-300 FRA–JFK 2019 | 2 040 411 $ | 1 420 289 $ | 620 122 $ | 30 % | 53 % | 7 % | 5 % | 12 % | 6 % | 17 % | 0 % | 5,8 |
| 787-9 FRA–SIN 2019 | 2 503 476 $ | 1 553 065 $ | 950 411 $ | 38 % | 52 % | 5 % | 3 % | 11 % | 7 % | 22 % | 0 % | 5,4 |

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
| A320ceo FRA–MAD 1990 | Boutique | 119,0 | 65,8 | 9 | 127,0 | 72,5 | 9 |
| A330-300 FRA–JFK 1995 | LCC | 48,1 | 24,1 | 0 | 56,1 | 28,1 | 0 |
| A330-300 FRA–JFK 1995 | Expansionist | 65,1 | 32,6 | 1 | 73,1 | 36,5 | 2 |
| A330-300 FRA–JFK 1995 | Optimizer | 86,9 | 43,5 | 3 | 95,0 | 47,5 | 4 |
| A330-300 FRA–JFK 1995 | Flag | 105,5 | 54,6 | 6 | 113,5 | 61,3 | 8 |
| A330-300 FRA–JFK 1995 | Boutique | 100,1 | 50,1 | 5 | 108,3 | 56,9 | 7 |

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
| A320ceo FRA–MAD 1990 | local | 107 697 $ | 1,002 | 5 318 $ | 20,3 |
| A320ceo FRA–MAD 1990 | national | 287 192 $ | 1,003 | 9 587 $ | 30,0 |
| A320ceo FRA–MAD 1990 | global | 717 980 $ | 1,005 | 16 169 $ | 44,4 |
| A320ceo FRA–MAD 2019 | local | 152 208 $ | 1,001 | 6 133 $ | 24,8 |
| A320ceo FRA–MAD 2019 | national | 405 889 $ | 1,002 | 11 773 $ | 34,5 |
| A320ceo FRA–MAD 2019 | global | 1 014 722 $ | 1,004 | 20 471 $ | 49,6 |

Preis fest (bester Preis ohne Werbung). Mehr-Ergebnis = (Strecken-Ergebnis mit − ohne Kampagne) × `WEEKS_PER_MONTH`. Eine regionale Kampagne wirkt auf alle Strecken mit einem Ende in der Region (3.9.5); „Strecken bis zur Deckung“ zählt gleich große Strecken.

### Beste Spieler-Ausstattung: Ruf-Ziel gegen die Ruf-Meilensteine (allein auf der Strecke, Mai)

| Strecke | Kabine und Service | Airline satisfaction | Ruf-Ziel | mit allen Kampagnen | Gold (80) |
|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990 | Flag | 138,3 | 81,9 | 84,9 | ja |
| A320ceo FRA–MAD 1990 | Boutique | 134,6 | 78,8 | 81,8 | mit Werbung |
| A330-300 FRA–JFK 1995 | Flag | 119,7 | 66,4 | 69,4 | nein |
| A330-300 FRA–JFK 1995 | Boutique | 115,1 | 62,6 | 65,6 | nein |

Alle Satisfaction-Forschung (sat-1 … sat-6, cabin), Moral 100, VIP-Lounge, Bordküche und Hangar an beiden Enden, Verwaltungsstufe 3; Kabine und Service nach der Persönlichkeit (7.5). Die Airline satisfaction ist das Mittel über alle Fluggäste der Gesellschaft: Gold braucht ein Netz, das überwiegend aus solchen Strecken besteht.

### Ruf-Schwellen: nötige Satisfaction und Ausstattungen, die sie erreichen

| Stufe | Ruf | Satisfaction nötig | erreicht ohne Forschung | erreicht erst mit Forschung |
|---|---|---|---|---|
| Rang 1 Local Airline | 30 | 60 | LCC (FRA–MAD), Expansionist (FRA–MAD), Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Expansionist (FRA–JFK), Optimizer (FRA–JFK), Flag (FRA–JFK), Boutique (FRA–JFK) | – |
| Rang 2 Regional Airline | 35 | 70 | LCC (FRA–MAD), Expansionist (FRA–MAD), Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Optimizer (FRA–JFK), Flag (FRA–JFK), Boutique (FRA–JFK) | Expansionist (FRA–JFK) |
| Rang 3 Domestic Airline | 40 | 80 | Expansionist (FRA–MAD), Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Optimizer (FRA–JFK), Flag (FRA–JFK), Boutique (FRA–JFK) | LCC (FRA–MAD) |
| Rang 4 National Airline | 45 | 90 | Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Flag (FRA–JFK), Boutique (FRA–JFK) | Expansionist (FRA–MAD), Optimizer (FRA–JFK) |
| Rang 5 Continental Airline | 50 | 100 | Optimizer (FRA–MAD), Flag (FRA–MAD), Boutique (FRA–MAD), Flag (FRA–JFK), Boutique (FRA–JFK) | – |
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
| 1 (April 1960) | F27-200 HAM–FRA 1960 (Commuter) | 8 000 | 59,0 $ | 48 % | 0,47 Mio. $ | Regional aircraft class | 2,11 Mio. $ | 4,5 | 21,6 |
| 2 (Jan. 1961) | Caravelle III FRA–CDG 1961 (Regional) | 25 000 | 79,1 $ | 53 % | 1,98 Mio. $ | Narrowbody aircraft class | 8,50 Mio. $ | 4,3 | 22,6 |
| 4 (Jan. 1966) | 727-100 FRA–MAD 1966 (Narrowbody) | 170 000 | 141,8 $ | 50 % | 24,11 Mio. $ | Wide-body aircraft class | 30,08 Mio. $ | 1,2 | 6,3 |
| 5 (Jan. 1970) | 727-200 FRA–MAD 1970 (Narrowbody) | 350 000 | 121,2 $ | 45 % | 42,42 Mio. $ | Jumbo aircraft class + Supersonic aircraft class | 110,42 Mio. $ | 2,6 | 11,8 |

Monatsergebnis = Fluggäste der Rang-Schwelle × Ergebnis je Fluggast der typischen Strecke beim besten Preis (Strecken-Ergebnis 5.9, ohne Kosten der Gesellschaft wie Flughäfen und Verwaltung). Preis im Monat des Rangs (`atCost`). Die letzte Spalte rechnet mit 10 % Marge auf denselben Erlös (Ziel nach E67: 10–25 %).

### Jahresziel der Rang-Beispiele (Angebot im Monat des Rangs)

| Beispiel | Vorjahr: Ergebnis | Vorjahr: Erlös | Bezugsgröße | sicher (× 1,10) | hoch (× 1,35) | Prämie sicher / andere Art / hoch | Strafe hoch | hohes Ziel lohnt ab Chance |
|---|---|---|---|---|---|---|---|---|
| Rang 1, 1960 | 5,67 Mio. $ | 11,73 Mio. $ | 5,67 Mio. $ | 6,23 Mio. $ | 7,65 Mio. $ | 0,25 Mio. $* / 0,38 Mio. $* / 0,63 Mio. $* | 0,31 Mio. $ | 60 % |
| Rang 2, 1961 | 23,74 Mio. $ | 45,14 Mio. $ | 23,74 Mio. $ | 26,11 Mio. $ | 32,04 Mio. $ | 0,47 Mio. $ / 0,71 Mio. $ / 1,19 Mio. $ | 0,59 Mio. $ | 60 % |
| Rang 4, 1966 | 289,29 Mio. $ | 574,44 Mio. $ | 289,29 Mio. $ | 318,22 Mio. $ | 390,55 Mio. $ | 5,79 Mio. $ / 8,68 Mio. $ / 14,46 Mio. $ | 7,23 Mio. $ | 60 % |
| Rang 5, 1970 | 509,01 Mio. $ | 1 120,84 Mio. $ | 509,01 Mio. $ | 559,91 Mio. $ | 687,16 Mio. $ | 10,18 Mio. $ / 15,27 Mio. $ / 25,45 Mio. $ | 12,73 Mio. $ | 60 % |
| Rang 5, 1970, Marge 10 % | 112,08 Mio. $ | 1 120,84 Mio. $ | 112,08 Mio. $ | 123,29 Mio. $ | 151,31 Mio. $ | 2,24 Mio. $ / 3,36 Mio. $ / 5,60 Mio. $ | 2,80 Mio. $ | 60 % |
| Rang 5, 1970, Verlustjahr (−5 %) | −56,04 Mio. $ | 1 120,84 Mio. $ | 56,04 Mio. $ | 61,65 Mio. $ | 75,66 Mio. $ | 1,12 Mio. $ / 1,68 Mio. $ / 2,80 Mio. $ | 1,40 Mio. $ | 60 % |

* = Mindestprämie (sicher 0,25 Mio. $ von 1960 über `atCost`, andere Art und hoch im Verhältnis der Anteile, E83). „Lohnt ab Chance“: Das hohe Ziel bringt im Mittel mehr als ein sicher erreichtes sicheres Ziel, wenn es mit dieser Wahrscheinlichkeit erreicht wird (Strafe = 50 % der Prämie, E58). Das sichere Ziel selbst lohnt ab einer Chance von 33 %.

## Abschnitt 7: Flugzeugwahl der KI auf Langstrecke (O79)

### Die 20 größten Langstrecken-Paare je Jahr: bester Narrowbody gegen besten Widebody (Flag-Ausstattung)

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | HND–SVO | 7 494 | 9 930 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,82 Mio. $ | 1,68 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 98 %) | 8,92 Mio. $ | 7,62 Mio. $ | Widebody |
| 1990 | ORD–SVO | 7 974 | 9 306 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,65 Mio. $ | 1,50 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 97 %) | 9,04 Mio. $ | 7,74 Mio. $ | Widebody |
| 1990 | LHR–ORD | 6 345 | 9 293 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 3,06 Mio. $ | 2,60 Mio. $ | 747-400 (476 Sitze, 9/9 Umläufe, 93 %) | 6,96 Mio. $ | 5,66 Mio. $ | Widebody |
| 1990 | ORD–CDG | 6 665 | 8 790 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 3,20 Mio. $ | 2,74 Mio. $ | 747-400 (476 Sitze, 9/9 Umläufe, 93 %) | 7,27 Mio. $ | 5,97 Mio. $ | Widebody |
| 1990 | LHR–HND | 9 592 | 8 641 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,59 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,61 Mio. $ | 7,31 Mio. $ | Widebody |
| 1990 | LAX–SVO | 9 758 | 8 609 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,61 Mio. $ | 1,47 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,49 Mio. $ | 7,19 Mio. $ | Widebody |
| 1990 | LHR–JFK | 5 540 | 8 441 | 757-200 (173 Sitze, 10/10 Umläufe, 100 %) | 3,13 Mio. $ | 2,67 Mio. $ | 747-400 (476 Sitze, 10/10 Umläufe, 87 %) | 5,44 Mio. $ | 4,15 Mio. $ | Widebody |
| 1990 | LAX–JFK | 3 974 | 8 310 | 757-200 (173 Sitze, 14/14 Umläufe, 99 %) | 3,70 Mio. $ | 3,24 Mio. $ | 767-300 (253 Sitze, 13/13 Umläufe, 95 %) | 4,71 Mio. $ | 3,99 Mio. $ | Widebody |
| 1990 | JFK–SVO | 7 481 | 8 288 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,82 Mio. $ | 1,68 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 93 %) | 7,15 Mio. $ | 5,85 Mio. $ | Widebody |
| 1990 | HND–CDG | 9 707 | 8 256 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,60 Mio. $ | 1,45 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,70 Mio. $ | 7,40 Mio. $ | Widebody |
| 1990 | LHR–LAX | 8 760 | 8 185 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,76 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 96 %) | 8,09 Mio. $ | 6,79 Mio. $ | Widebody |
| 1990 | CDG–JFK | 5 833 | 7 999 | 757-200 (173 Sitze, 10/10 Umläufe, 100 %) | 3,18 Mio. $ | 2,72 Mio. $ | 747-400 (476 Sitze, 10/10 Umläufe, 87 %) | 5,47 Mio. $ | 4,17 Mio. $ | Widebody |
| 1990 | LHR–BOS | 5 240 | 7 964 | 757-200 (173 Sitze, 11/11 Umläufe, 100 %) | 3,40 Mio. $ | 2,94 Mio. $ | 747-400 (476 Sitze, 11/11 Umläufe, 85 %) | 5,15 Mio. $ | 3,85 Mio. $ | Widebody |
| 1990 | LAX–CDG | 9 103 | 7 802 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,53 Mio. $ | 1,39 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 96 %) | 8,38 Mio. $ | 7,09 Mio. $ | Widebody |
| 1990 | HND–LAX | 8 813 | 7 725 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,77 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 96 %) | 7,98 Mio. $ | 6,68 Mio. $ | Widebody |
| 1990 | BOS–SVO | 7 191 | 7 634 | 757-200 (173 Sitze, 8/8 Umläufe, 100 %) | 3,03 Mio. $ | 2,57 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 91 %) | 6,20 Mio. $ | 4,91 Mio. $ | Widebody |
| 1990 | HND–ORD | 10 124 | 7 631 | – | – | – | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,75 Mio. $ | 7,45 Mio. $ | Widebody |
| 1990 | LAX–BOS | 4 193 | 7 573 | 757-200 (173 Sitze, 13/13 Umläufe, 99 %) | 3,50 Mio. $ | 3,04 Mio. $ | 767-300 (253 Sitze, 12/12 Umläufe, 94 %) | 4,30 Mio. $ | 3,58 Mio. $ | Widebody |
| 1990 | CDG–BOS | 5 534 | 7 551 | 757-200 (173 Sitze, 10/10 Umläufe, 100 %) | 3,15 Mio. $ | 2,69 Mio. $ | 767-300 (253 Sitze, 10/10 Umläufe, 98 %) | 4,58 Mio. $ | 3,86 Mio. $ | Widebody |
| 1990 | SFO–SVO | 9 434 | 7 276 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,58 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 94 %) | 8,04 Mio. $ | 6,75 Mio. $ | Widebody |
| 2000 | LHR–HND | 9 592 | 8 522 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,58 Mio. $ | 6,17 Mio. $ | Widebody |
| 2000 | LHR–ORD | 6 345 | 8 449 | 757-300 (213 Sitze, 9/9 Umläufe, 100 %) | 3,55 Mio. $ | 2,92 Mio. $ | 777-300 (397 Sitze, 9/9 Umläufe, 95 %) | 6,13 Mio. $ | 4,72 Mio. $ | Widebody |
| 2000 | LHR–LAX | 8 760 | 8 280 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 99 %) | 7,60 Mio. $ | 6,19 Mio. $ | Widebody |
| 2000 | HND–CDG | 9 707 | 8 241 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,65 Mio. $ | 6,24 Mio. $ | Widebody |
| 2000 | ORD–CDG | 6 665 | 8 105 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 2,92 Mio. $ | 2,40 Mio. $ | 777-300 (397 Sitze, 9/9 Umläufe, 95 %) | 6,47 Mio. $ | 5,06 Mio. $ | Widebody |
| 2000 | LAX–CDG | 9 103 | 7 994 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 99 %) | 7,92 Mio. $ | 6,51 Mio. $ | Widebody |
| 2000 | HND–LAX | 8 813 | 7 602 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 99 %) | 7,57 Mio. $ | 6,16 Mio. $ | Widebody |
| 2000 | LHR–JFK | 5 540 | 7 361 | 757-300 (213 Sitze, 10/10 Umläufe, 98 %) | 3,28 Mio. $ | 2,65 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 95 %) | 4,51 Mio. $ | 3,59 Mio. $ | Widebody |
| 2000 | LAX–JFK | 3 974 | 7 235 | 757-300 (213 Sitze, 14/14 Umläufe, 94 %) | 3,52 Mio. $ | 2,89 Mio. $ | a330-200 (293 Sitze, 13/13 Umläufe, 88 %) | 4,11 Mio. $ | 3,19 Mio. $ | Widebody |
| 2000 | LHR–BOS | 5 240 | 7 100 | 757-300 (213 Sitze, 11/11 Umläufe, 98 %) | 3,54 Mio. $ | 2,91 Mio. $ | a330-200 (293 Sitze, 11/11 Umläufe, 92 %) | 4,34 Mio. $ | 3,42 Mio. $ | Widebody |
| 2000 | CDG–JFK | 5 833 | 7 055 | 757-300 (213 Sitze, 10/10 Umläufe, 98 %) | 3,32 Mio. $ | 2,69 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 95 %) | 4,57 Mio. $ | 3,65 Mio. $ | Widebody |
| 2000 | LHR–ICN | 8 861 | 6 900 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 6,81 Mio. $ | 5,41 Mio. $ | Widebody |
| 2000 | LAX–BOS | 4 193 | 6 832 | 757-300 (213 Sitze, 13/13 Umläufe, 94 %) | 3,35 Mio. $ | 2,72 Mio. $ | a330-200 (293 Sitze, 13/13 Umläufe, 87 %) | 3,95 Mio. $ | 3,02 Mio. $ | Widebody |
| 2000 | LHR–SFO | 8 616 | 6 822 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 96 %) | 6,47 Mio. $ | 5,06 Mio. $ | Widebody |
| 2000 | CDG–BOS | 5 534 | 6 799 | 757-300 (213 Sitze, 10/10 Umläufe, 98 %) | 3,26 Mio. $ | 2,63 Mio. $ | a330-200 (293 Sitze, 10/10 Umläufe, 93 %) | 4,25 Mio. $ | 3,33 Mio. $ | Widebody |
| 2000 | ATL–LHR | 6 761 | 6 790 | 757-200 (173 Sitze, 9/9 Umläufe, 100 %) | 2,91 Mio. $ | 2,39 Mio. $ | 777-200er (318 Sitze, 9/9 Umläufe, 93 %) | 4,57 Mio. $ | 3,38 Mio. $ | Widebody |
| 2000 | HND–ORD | 10 124 | 6 766 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,29 Mio. $ | 5,88 Mio. $ | Widebody |
| 2000 | CDG–ICN | 8 927 | 6 717 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 6,92 Mio. $ | 5,51 Mio. $ | Widebody |
| 2000 | ATL–CDG | 7 055 | 6 595 | 757-200 (173 Sitze, 8/8 Umläufe, 100 %) | 2,67 Mio. $ | 2,15 Mio. $ | a330-200 (293 Sitze, 8/8 Umläufe, 96 %) | 4,50 Mio. $ | 3,58 Mio. $ | Widebody |
| 2000 | CDG–SFO | 8 962 | 6 564 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 96 %) | 6,78 Mio. $ | 5,38 Mio. $ | Widebody |
| 2010 | CDG–PEK | 8 190 | 8 008 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,19 Mio. $ | 0,70 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 97 %) | 4,05 Mio. $ | 3,01 Mio. $ | Widebody |
| 2010 | LHR–PEK | 8 154 | 7 730 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,18 Mio. $ | 0,69 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 94 %) | 3,35 Mio. $ | 2,31 Mio. $ | Widebody |
| 2010 | PEK–CGK | 5 237 | 6 877 | 737-900er (160 Sitze, 11/11 Umläufe, 98 %) | 2,48 Mio. $ | 1,94 Mio. $ | il-96-300 (217 Sitze, 10/10 Umläufe, 94 %) | 2,10 Mio. $ | 1,42 Mio. $ | Narrowbody |
| 2010 | HND–CDG | 9 707 | 6 757 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,09 Mio. $ | 0,60 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 96 %) | 3,62 Mio. $ | 2,58 Mio. $ | Widebody |
| 2010 | LHR–HND | 9 592 | 6 610 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 95 %) | 3,32 Mio. $ | 2,28 Mio. $ | Widebody |
| 2010 | CDG–JFK | 5 833 | 6 504 | 737-900er (160 Sitze, 10/10 Umläufe, 95 %) | 1,69 Mio. $ | 1,15 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 98 %) | 1,16 Mio. $ | 0,49 Mio. $ | Narrowbody |
| 2010 | PEK–SVO | 5 796 | 6 504 | 737-900er (160 Sitze, 10/10 Umläufe, 95 %) | 1,72 Mio. $ | 1,18 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 98 %) | 1,17 Mio. $ | 0,50 Mio. $ | Narrowbody |
| 2010 | HND–BKK | 4 588 | 6 500 | 737-800 (137 Sitze, 12/12 Umläufe, 97 %) | 2,12 Mio. $ | 1,63 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 96 %) | 1,66 Mio. $ | 0,99 Mio. $ | Narrowbody |
| 2010 | ICN–BKK | 3 666 | 6 416 | tu-204-300 (117 Sitze, 15/15 Umläufe, 96 %) | 1,98 Mio. $ | 1,61 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 93 %) | 1,63 Mio. $ | 0,95 Mio. $ | Narrowbody |
| 2010 | LHR–JFK | 5 540 | 6 386 | 737-800 (137 Sitze, 10/10 Umläufe, 97 %) | 1,62 Mio. $ | 1,13 Mio. $ | il-96-300 (217 Sitze, 6/10 Umläufe, 96 %) | 1,20 Mio. $ | 0,52 Mio. $ | Narrowbody |
| 2010 | CDG–ICN | 8 927 | 6 314 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 99 %) | 2,34 Mio. $ | 1,67 Mio. $ | Widebody |
| 2010 | LHR–ICN | 8 861 | 6 145 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 98 %) | 2,26 Mio. $ | 1,58 Mio. $ | Widebody |
| 2010 | SIN–PEK | 4 489 | 6 042 | 737-800 (137 Sitze, 12/12 Umläufe, 97 %) | 2,05 Mio. $ | 1,56 Mio. $ | il-96-300 (217 Sitze, 7/12 Umläufe, 96 %) | 1,61 Mio. $ | 0,93 Mio. $ | Narrowbody |
| 2010 | ORD–CDG | 6 665 | 6 032 | a319ceo (114 Sitze, 8/8 Umläufe, 100 %) | 1,24 Mio. $ | 0,81 Mio. $ | il-96-300 (217 Sitze, 5/8 Umläufe, 98 %) | 1,31 Mio. $ | 0,63 Mio. $ | Narrowbody |
| 2010 | HND–CGK | 5 784 | 6 019 | 737-900er (160 Sitze, 10/10 Umläufe, 98 %) | 2,14 Mio. $ | 1,60 Mio. $ | il-96-300 (217 Sitze, 10/10 Umläufe, 92 %) | 1,57 Mio. $ | 0,89 Mio. $ | Narrowbody |
| 2010 | LHR–ORD | 6 345 | 5 909 | a319ceo (114 Sitze, 9/9 Umläufe, 99 %) | 1,30 Mio. $ | 0,87 Mio. $ | il-96-300 (217 Sitze, 5/9 Umläufe, 97 %) | 1,14 Mio. $ | 0,47 Mio. $ | Narrowbody |
| 2010 | LAX–PEK | 10 037 | 5 903 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,10 Mio. $ | 0,61 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 96 %) | 3,56 Mio. $ | 2,52 Mio. $ | Widebody |
| 2010 | LAX–JFK | 3 974 | 5 863 | tu-204-300 (117 Sitze, 14/14 Umläufe, 97 %) | 1,82 Mio. $ | 1,45 Mio. $ | il-96-300 (217 Sitze, 8/13 Umläufe, 92 %) | 1,44 Mio. $ | 0,76 Mio. $ | Narrowbody |
| 2010 | DEL–PEK | 3 811 | 5 851 | tu-204-300 (117 Sitze, 14/14 Umläufe, 96 %) | 1,78 Mio. $ | 1,41 Mio. $ | il-96-300 (217 Sitze, 8/14 Umläufe, 92 %) | 1,40 Mio. $ | 0,72 Mio. $ | Narrowbody |
| 2010 | LAX–CDG | 9 103 | 5 807 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,04 Mio. $ | 0,55 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 96 %) | 1,87 Mio. $ | 1,20 Mio. $ | Widebody |

Je Typ: neues Flugzeug mit Kabine nach 7.5, Strecke nach dem Anlauf, Preisniveau einer neuen KI-Strecke (7.6), beste Flugzahl aus `planFrequencies` (100 / 60 / 30 % der höchsten Umläufe), Planer-Hauptzahl je Monat (4.12); „nach Zins“ = `profitAfterCapital` (8 % je Jahr auf den Kaufpreis, E81). Bester Typ je Bauart nach „nach Zins“. Marktgröße = Fluggäste je Woche, beide Richtungen. Die Gesellschaft fliegt das Paar allein.

### Die 10 größten Paare über 7 500 km je Jahr

| Jahr | Paar | km | Marktgröße | Narrowbody | Planer-Zahl | nach Zins | Widebody | Planer-Zahl | nach Zins | besser |
|---|---|---|---|---|---|---|---|---|---|---|
| 1990 | ORD–SVO | 7 974 | 9 306 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,65 Mio. $ | 1,50 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 97 %) | 9,04 Mio. $ | 7,74 Mio. $ | Widebody |
| 1990 | LHR–HND | 9 592 | 8 641 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,59 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,61 Mio. $ | 7,31 Mio. $ | Widebody |
| 1990 | LAX–SVO | 9 758 | 8 609 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,61 Mio. $ | 1,47 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,49 Mio. $ | 7,19 Mio. $ | Widebody |
| 1990 | HND–CDG | 9 707 | 8 256 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,60 Mio. $ | 1,45 Mio. $ | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,70 Mio. $ | 7,40 Mio. $ | Widebody |
| 1990 | LHR–LAX | 8 760 | 8 185 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,76 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 96 %) | 8,09 Mio. $ | 6,79 Mio. $ | Widebody |
| 1990 | LAX–CDG | 9 103 | 7 802 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,53 Mio. $ | 1,39 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 96 %) | 8,38 Mio. $ | 7,09 Mio. $ | Widebody |
| 1990 | HND–LAX | 8 813 | 7 725 | il-62m (134 Sitze, 7/7 Umläufe, 100 %) | 1,77 Mio. $ | 1,62 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 96 %) | 7,98 Mio. $ | 6,68 Mio. $ | Widebody |
| 1990 | HND–ORD | 10 124 | 7 631 | – | – | – | 747-400 (476 Sitze, 6/6 Umläufe, 99 %) | 8,75 Mio. $ | 7,45 Mio. $ | Widebody |
| 1990 | SFO–SVO | 9 434 | 7 276 | il-62m (134 Sitze, 6/6 Umläufe, 100 %) | 1,58 Mio. $ | 1,44 Mio. $ | 747-400 (476 Sitze, 7/7 Umläufe, 94 %) | 8,04 Mio. $ | 6,75 Mio. $ | Widebody |
| 1990 | DFW–LHR | 7 628 | 7 148 | il-62m (134 Sitze, 8/8 Umläufe, 100 %) | 1,84 Mio. $ | 1,69 Mio. $ | 747-400 (476 Sitze, 8/8 Umläufe, 89 %) | 6,01 Mio. $ | 4,72 Mio. $ | Widebody |
| 2000 | LHR–HND | 9 592 | 8 522 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,58 Mio. $ | 6,17 Mio. $ | Widebody |
| 2000 | LHR–LAX | 8 760 | 8 280 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 99 %) | 7,60 Mio. $ | 6,19 Mio. $ | Widebody |
| 2000 | HND–CDG | 9 707 | 8 241 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 100 %) | 7,65 Mio. $ | 6,24 Mio. $ | Widebody |
| 2000 | LAX–CDG | 9 103 | 7 994 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 99 %) | 7,92 Mio. $ | 6,51 Mio. $ | Widebody |
| 2000 | HND–LAX | 8 813 | 7 602 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 99 %) | 7,57 Mio. $ | 6,16 Mio. $ | Widebody |
| 2000 | LHR–ICN | 8 861 | 6 900 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 6,81 Mio. $ | 5,41 Mio. $ | Widebody |
| 2000 | LHR–SFO | 8 616 | 6 822 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 96 %) | 6,47 Mio. $ | 5,06 Mio. $ | Widebody |
| 2000 | HND–ORD | 10 124 | 6 766 | – | – | – | 777-300 (397 Sitze, 6/6 Umläufe, 99 %) | 7,29 Mio. $ | 5,88 Mio. $ | Widebody |
| 2000 | CDG–ICN | 8 927 | 6 717 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 97 %) | 6,92 Mio. $ | 5,51 Mio. $ | Widebody |
| 2000 | CDG–SFO | 8 962 | 6 564 | – | – | – | 777-300 (397 Sitze, 7/7 Umläufe, 96 %) | 6,78 Mio. $ | 5,38 Mio. $ | Widebody |
| 2010 | CDG–PEK | 8 190 | 8 008 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,19 Mio. $ | 0,70 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 97 %) | 4,05 Mio. $ | 3,01 Mio. $ | Widebody |
| 2010 | LHR–PEK | 8 154 | 7 730 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,18 Mio. $ | 0,69 Mio. $ | a330-200 (293 Sitze, 7/7 Umläufe, 94 %) | 3,35 Mio. $ | 2,31 Mio. $ | Widebody |
| 2010 | HND–CDG | 9 707 | 6 757 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,09 Mio. $ | 0,60 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 96 %) | 3,62 Mio. $ | 2,58 Mio. $ | Widebody |
| 2010 | LHR–HND | 9 592 | 6 610 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 95 %) | 3,32 Mio. $ | 2,28 Mio. $ | Widebody |
| 2010 | CDG–ICN | 8 927 | 6 314 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 99 %) | 2,34 Mio. $ | 1,67 Mio. $ | Widebody |
| 2010 | LHR–ICN | 8 861 | 6 145 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,03 Mio. $ | 0,54 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 98 %) | 2,26 Mio. $ | 1,58 Mio. $ | Widebody |
| 2010 | LAX–PEK | 10 037 | 5 903 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,10 Mio. $ | 0,61 Mio. $ | a330-200 (293 Sitze, 6/6 Umläufe, 96 %) | 3,56 Mio. $ | 2,52 Mio. $ | Widebody |
| 2010 | LAX–CDG | 9 103 | 5 807 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,04 Mio. $ | 0,55 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 96 %) | 1,87 Mio. $ | 1,20 Mio. $ | Widebody |
| 2010 | CDG–BKK | 9 448 | 5 671 | 737-700er (108 Sitze, 6/6 Umläufe, 100 %) | 1,08 Mio. $ | 0,59 Mio. $ | il-96-300 (217 Sitze, 6/6 Umläufe, 96 %) | 1,86 Mio. $ | 1,19 Mio. $ | Widebody |
| 2010 | LHR–LAX | 8 760 | 5 628 | 737-700er (108 Sitze, 7/7 Umläufe, 100 %) | 1,25 Mio. $ | 0,76 Mio. $ | a330-200 (293 Sitze, 4/7 Umläufe, 96 %) | 1,85 Mio. $ | 0,81 Mio. $ | Widebody |

Wie oben. „–“ = kein lieferbarer Typ der Bauart mit dieser Reichweite.

### Kosten je Sitz und Woche: LHR–JFK 2000, ein Flugzeug allein, Marktpreis

| Typ | Bauart | Umläufe | Sitze je Woche | Fluggäste | Treibstoff je Sitz | Besatzung + Landung je Sitz | Flugzeug-Anteil je Sitz | feste Kosten je Sitz | Ergebnis je Woche |
|---|---|---|---|---|---|---|---|---|---|
| 737-700 | Narrowbody | 5/10 | 1 080 | 1 080 | 159 | 78 | 71 | 311 | 0,13 Mio. $ |
| 737-700 | Narrowbody | 10/10 | 2 160 | 2 160 | 159 | 78 | 35 | 275 | 0,34 Mio. $ |
| a321ceo | Narrowbody | 5/10 | 1 600 | 1 600 | 153 | 71 | 69 | 295 | 0,22 Mio. $ |
| a321ceo | Narrowbody | 10/10 | 3 200 | 3 200 | 153 | 71 | 34 | 261 | 0,54 Mio. $ |
| 767-300er | Widebody | 5/10 | 2 530 | 2 530 | 170 | 45 | 69 | 286 | 0,37 Mio. $ |
| 767-300er | Widebody | 10/10 | 5 060 | 4 983 | 170 | 45 | 34 | 251 | 0,81 Mio. $ |
| a330-300 | Widebody | 5/10 | 3 180 | 3 180 | 159 | 43 | 61 | 265 | 0,53 Mio. $ |
| a330-300 | Widebody | 10/10 | 6 360 | 6 082 | 159 | 43 | 31 | 234 | 0,96 Mio. $ |
| 777-200er | Widebody | 5/10 | 3 180 | 3 180 | 154 | 43 | 73 | 271 | 0,51 Mio. $ |
| 777-200er | Widebody | 10/10 | 6 360 | 6 097 | 154 | 43 | 37 | 234 | 0,97 Mio. $ |

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
| Aviation Downturn | × 1,00 | 0,65 / 0,40 / 12 | 1,177 | 13,88 Mio. $ | 29 % | 1,49 Mio. $ | 2,72 |
| Aviation Downturn | × 0,25 | 0,65 / 0,40 / 12 | 1,103 | 6,38 Mio. $ | 17 % | 0,70 Mio. $ | 1,52 |
| Global Financial Crisis | × 1,00 | 0,75 / 0,33 / 24 | 1,090 | 25,56 Mio. $ | 19 % | 1,84 Mio. $ | 2,59 |
| Global Financial Crisis | × 0,25 | 0,75 / 0,33 / 24 | 1,052 | 12,22 Mio. $ | 10 % | 0,86 Mio. $ | 1,43 |
| Global Pandemic | × 1,00 | 0,20 / 0,35 / 24 | 1,862 | 59,62 Mio. $ | 23 % | 6,34 Mio. $ | 2,13 |
| Global Pandemic | × 0,25 | 0,20 / 0,35 / 24 | 1,284 | 22,19 Mio. $ | 9 % | 2,67 Mio. $ | 0,71 |

Ergebnis = Strecken-Ergebnis (5.9) × `WEEKS_PER_MONTH`, Summe über die Dauer. „× 0,25“ verkleinert die Marktgröße wie ein kleineres `DEMAND_SCALE` (Richtung E67). Volle Flugzeuge verlieren bei kleinerer Nachfrage zuerst nur „Knappheit“; die Antwort holt dann wenig Fluggäste zurück.

### Charter oder streichen je betroffenem Flug (Strecken beim besten Preis)

| Strecke | Erlös je Flug | Kosten je Fluggast (Summe) | eigene Flugkosten | Charter-Gebühr | Vorteil Charter | Strecke mit Gewinn |
|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 10 882 $ | 1 379 $ | 2 604 $ | 3 907 $ | 5 596 $ | ja |
| 707-320B FRA–JFK 1965 | 74 815 $ | 5 864 $ | 36 518 $ | 54 777 $ | 14 174 $ | ja |
| 727-200 FRA–MAD 1975 | 37 758 $ | 5 393 $ | 15 595 $ | 23 392 $ | 8 972 $ | ja |
| ATR 72-200 HAM–NUE 1990 | 7 701 $ | 1 574 $ | 2 441 $ | 3 661 $ | 2 466 $ | ja |
| A320ceo FRA–MAD 1990 | 44 997 $ | 6 375 $ | 9 643 $ | 14 464 $ | 24 158 $ | ja |
| A320ceo FRA–MAD 1990 (LCC) | 33 729 $ | 3 191 $ | 9 652 $ | 14 478 $ | 16 059 $ | ja |
| A320ceo ATL–ORD 1990 | 45 890 $ | 6 520 $ | 8 343 $ | 12 515 $ | 26 855 $ | ja |
| A330-300 FRA–JFK 1995 | 164 486 $ | 18 222 $ | 48 208 $ | 72 312 $ | 73 952 $ | ja |
| A320ceo FRA–MAD 2019 | 62 510 $ | 8 879 $ | 15 961 $ | 23 942 $ | 29 690 $ | ja |
| A330-300 FRA–JFK 2019 | 204 041 $ | 23 692 $ | 93 392 $ | 140 088 $ | 40 261 $ | ja |
| 787-9 FRA–SIN 2019 | 312 935 $ | 28 128 $ | 122 393 $ | 183 589 $ | 101 217 $ | ja |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 2 467 $ | 683 $ | 2 441 $ | 3 661 $ | −1 877 $ | nein |
| A320ceo FRA–MAD 1990 × 0,25 | 19 947 $ | 3 959 $ | 9 643 $ | 14 464 $ | 1 524 $ | ja |
| A330-300 FRA–JFK 1995 × 0,25 | 45 529 $ | 5 780 $ | 48 208 $ | 72 312 $ | −32 563 $ | nein |

Vorteil = Erlös − Kosten je Fluggast − Charter-Gebühr (`charterAdvantage`, 8.9); die eigenen Flugkosten entfallen in beiden Fällen. Dazu kein Ruf-Abzug mit Charter (6.2).

### Beträge der Störungs-Frage gegen die Rechnung (Flughafen-Streik am Start-Flughafen, Monat, Strecken beim besten Preis)

| Strecke | Auslastung | Erlös im Mittel × Anteil | Erlösverlust (Frage) | Erlösverlust (Rechnung) | Vorteil Charter (Frage) | Vorteil Charter (Rechnung) | Gebühr Frage / gebucht |
|---|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 100 % | 397 466 $ | 397 466 $ | 397 466 $ (100 %) | 204 411 $ | 204 411 $ | 142 686 $ / 142 686 $ |
| 707-320B FRA–JFK 1965 | 100 % | 2 732 626 $ | 2 732 076 $ | 2 732 076 $ (100 %) | 517 222 $ | 517 222 $ | 2 000 739 $ / 2 000 739 $ |
| 727-200 FRA–MAD 1975 | 97 % | 1 379 099 $ | 1 320 554 $ | 1 320 554 $ (96 %) | 292 795 $ | 292 795 $ | 854 408 $ / 854 408 $ |
| ATR 72-200 HAM–NUE 1990 | 100 % | 281 296 $ | 281 296 $ | 281 296 $ (100 %) | 90 073 $ | 90 073 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 | 97 % | 1 643 506 $ | 1 574 629 $ | 1 574 629 $ (96 %) | 841 615 $ | 841 615 $ | 528 307 $ / 528 307 $ |
| A320ceo FRA–MAD 1990 (LCC) | 100 % | 1 231 937 $ | 1 231 937 $ | 1 231 937 $ (100 %) | 586 570 $ | 586 570 $ | 528 826 $ / 528 826 $ |
| A320ceo ATL–ORD 1990 | 98 % | 1 676 150 $ | 1 622 462 $ | 1 622 462 $ (97 %) | 951 789 $ | 951 789 $ | 457 107 $ / 457 107 $ |
| A330-300 FRA–JFK 1995 | 98 % | 6 007 855 $ | 5 679 675 $ | 5 679 675 $ (95 %) | 2 442 624 $ | 2 442 624 $ | 2 641 213 $ / 2 641 213 $ |
| A320ceo FRA–MAD 2019 | 97 % | 2 283 176 $ | 2 178 395 $ | 2 178 395 $ (95 %) | 1 022 583 $ | 1 022 583 $ | 874 473 $ / 874 473 $ |
| A330-300 FRA–JFK 2019 | 97 % | 5 323 287 $ | 4 968 348 $ | 4 968 348 $ (93 %) | 771 636 $ | 771 636 $ | 3 654 793 $ / 3 654 793 $ |
| 787-9 FRA–SIN 2019 | 99 % | 6 531 391 $ | 6 430 757 $ | 6 430 757 $ (98 %) | 2 028 567 $ | 2 028 567 $ | 3 831 772 $ / 3 831 772 $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 43 % | 207 714 $ | 207 714 $ | 207 714 $ (100 %) | 16 491 $ | 16 491 $ | 133 718 $ / 133 718 $ |
| A320ceo FRA–MAD 1990 × 0,25 | 81 % | 1 032 566 $ | 964 105 $ | 964 105 $ (93 %) | 230 976 $ | 230 976 $ | 528 307 $ / 528 307 $ |
| A330-300 FRA–JFK 1995 × 0,25 | 36 % | 5 108 138 $ | 4 780 176 $ | 4 780 176 $ (94 %) | 1 543 066 $ | 1 543 066 $ | 2 641 213 $ / 2 641 213 $ |

Frage: `charterQuestionFigures` auf dem Monat mit der Störung (E76). Rechnung: derselbe Monat ohne Störung, gestrichen und gechartert (`monthOperations`), Vorteil = Monatsergebnis mit Charter − mit Streichen. „Erlös im Mittel × Anteil“ ist die alte Schätzung aus 5.2e: Beim Streichen verteilt das Modell die Fluggäste auf die übrigen Sitze (8.9), der echte Verlust ist darum kleiner, je mehr Sitze frei sind.

### Händler-Spanne: A320ceo (Flag-Kabine), gebaut Mai 1990

| Alter | Zelle / Kabine | Wert | Gebrauchtpreis | Verkaufserlös | mit größter Forschung | zurück nach Kauf und Verkauf | Verlust in Monatsergebnissen |
|---|---|---|---|---|---|---|---|
| 0 Jahre | 100 / 100 | 57,64 Mio. $ | 60,52 Mio. $ | 48,99 Mio. $ | 50,22 Mio. $ | 83,0 % | 8,14 |
| 5 Jahre | 87 / 78 | 43,98 Mio. $ | 46,18 Mio. $ | 37,39 Mio. $ | 38,32 Mio. $ | 83,0 % | 5,85 |
| 10 Jahre | 76 / 64 | 32,84 Mio. $ | 34,49 Mio. $ | 27,92 Mio. $ | 28,61 Mio. $ | 83,0 % | 4,12 |
| 20 Jahre | 54 / 36 | 14,46 Mio. $ | 15,19 Mio. $ | 12,29 Mio. $ | 12,60 Mio. $ | 83,0 % | 1,61 |

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
| A320ceo FRA–MAD 1990 | 134 | 0,20 Mio. $ | 0,19 Mio. $ | 0,39 Mio. $ | 1,42 Mio. $ | 0,3 |
| A320ceo FRA–MAD 2019 | 134 | 1,02 Mio. $ | 0,27 Mio. $ | 1,29 Mio. $ | 1,80 Mio. $ | 0,7 |
| A330-300 FRA–JFK 2019 | 318 | 1,71 Mio. $ | 0,65 Mio. $ | 2,36 Mio. $ | 2,70 Mio. $ | 0,9 |
| ATR 72-200 HAM–NUE 1990 | 69 | 0,04 Mio. $ | 0,10 Mio. $ | 0,14 Mio. $ | 0,12 Mio. $ | 1,2 |

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
| A330-300 FRA–JFK 2019 | 323 | 5,9 | 4,1 | 8,5 | 12,1 |
| 787-9 FRA–SIN 2019 | 410 | 7,1 | 4,9 | 7,0 | 10,1 |

Gebrauchtmarkt zum Vergleich: Zelle −2,2, Kabine −2,8 Punkte je Jahr (8.11).

### Kreditlinie für ein neues Flugzeug je Strecke

| Strecke | Kreditgrenze | feste Kosten je Monat | Grenze in Monaten fester Kosten | Kosten je Monat | Monatsergebnis | Zins bei voller Nutzung |
|---|---|---|---|---|---|---|
| Caravelle III FRA–CDG 1962 | 4,89 Mio. $ | 0,23 Mio. $ | 21,3 | 0,31 Mio. $ | 0,35 Mio. $ | 0,033 Mio. $ |
| 707-320B FRA–JFK 1965 | 10,67 Mio. $ | 2,36 Mio. $ | 4,5 | 2,72 Mio. $ | 1,84 Mio. $ | 0,071 Mio. $ |
| 727-200 FRA–MAD 1975 | 9,62 Mio. $ | 1,08 Mio. $ | 8,9 | 1,40 Mio. $ | 0,89 Mio. $ | 0,064 Mio. $ |
| ATR 72-200 HAM–NUE 1990 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,34 Mio. $ | 0,12 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,32 Mio. $ | 1,42 Mio. $ | 0,192 Mio. $ |
| A320ceo FRA–MAD 1990 (LCC) | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,13 Mio. $ | 0,92 Mio. $ | 0,192 Mio. $ |
| A320ceo ATL–ORD 1990 | 28,82 Mio. $ | 0,86 Mio. $ | 33,7 | 1,25 Mio. $ | 1,54 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 | 70,44 Mio. $ | 3,75 Mio. $ | 18,8 | 4,86 Mio. $ | 5,15 Mio. $ | 0,470 Mio. $ |
| A320ceo FRA–MAD 2019 | 41,10 Mio. $ | 1,47 Mio. $ | 28,0 | 2,01 Mio. $ | 1,80 Mio. $ | 0,274 Mio. $ |
| A330-300 FRA–JFK 2019 | 94,21 Mio. $ | 5,15 Mio. $ | 18,3 | 6,18 Mio. $ | 2,70 Mio. $ | 0,628 Mio. $ |
| 787-9 FRA–SIN 2019 | 132,74 Mio. $ | 5,77 Mio. $ | 23,0 | 6,75 Mio. $ | 4,13 Mio. $ | 0,885 Mio. $ |
| ATR 72-200 HAM–NUE 1990 × 0,25 | 7,92 Mio. $ | 0,25 Mio. $ | 31,8 | 0,29 Mio. $ | −0,14 Mio. $ | 0,053 Mio. $ |
| A320ceo FRA–MAD 1990 × 0,25 | 28,82 Mio. $ | 0,93 Mio. $ | 30,8 | 1,18 Mio. $ | 0,04 Mio. $ | 0,192 Mio. $ |
| A330-300 FRA–JFK 1995 × 0,25 | 70,44 Mio. $ | 3,75 Mio. $ | 18,8 | 4,11 Mio. $ | −1,33 Mio. $ | 0,470 Mio. $ |

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
| 10 (1970) | 1 048 Mio. $ | 985 Mio. $ (0,94) | 977 Mio. $ (0,93) | 1 084 Mio. $ (1,03) | 1 283 Mio. $ (1,22) | 940 Mio. $ (0,90) | 1,22 |
| 20 (1980) | 959 Mio. $ | 734 Mio. $ (0,77) | 978 Mio. $ (1,02) | 1 106 Mio. $ (1,15) | 1 166 Mio. $ (1,22) | 664 Mio. $ (0,69) | 1,45 |
| 30 (1990) | 2 575 Mio. $ | 2 772 Mio. $ (1,08) | 2 112 Mio. $ (0,82) | 4 421 Mio. $ (1,72) | 2 788 Mio. $ (1,08) | 2 139 Mio. $ (0,83) | 1,72 |
| 40 (2000) | 2 992 Mio. $ | 5 439 Mio. $ (1,82) | 2 183 Mio. $ (0,73) | 5 861 Mio. $ (1,96) | 3 036 Mio. $ (1,01) | 3 141 Mio. $ (1,05) | 1,96 |
| 50 (2010) | 2 929 Mio. $ | 6 086 Mio. $ (2,08) | 2 294 Mio. $ (0,78) | 4 893 Mio. $ (1,67) | 2 723 Mio. $ (0,93) | 2 901 Mio. $ (0,99) | 2,08 |
| 60 (2020) | 3 276 Mio. $ | 8 758 Mio. $ (2,67) | 2 682 Mio. $ (0,82) | 4 798 Mio. $ (1,46) | 3 054 Mio. $ (0,93) | 3 303 Mio. $ (1,01) | 2,67 |

„Faktor“ = größtes Verhältnis einer Persönlichkeit zum Median aller, in beide Richtungen. Aufgelöste Gründer zählen mit 0.

### Gründer je Lauf am Ende (Drehkreuz: Unternehmenswert in Preisen von 1960)

| Lauf | flag | lcc | expansionist | optimizer | boutique |
|---|---|---|---|---|---|
| 0 | JFK: 3 195 Mio. $ | FRA: 2 396 Mio. $ | CDG: 6 128 Mio. $ | HND: 5 247 Mio. $ | ATL: 3 849 Mio. $ |
| 1 | LHR: 11 475 Mio. $ | ORD: 3 022 Mio. $ | LAX: 4 756 Mio. $ | SIN: 133 Mio. $ | SYD: 3 930 Mio. $ |
| 2 | FRA: 9 097 Mio. $ | CDG: 2 252 Mio. $ | HND: 5 387 Mio. $ | ATL: 2 628 Mio. $ | JFK: 3 039 Mio. $ |
| 3 | ORD: 9 536 Mio. $ | LAX: 2 909 Mio. $ | SIN: 2 048 Mio. $ | SYD: 104 Mio. $ | LHR: 3 061 Mio. $ |
| 4 | CDG: 10 051 Mio. $ | HND: 2 696 Mio. $ | ATL: 4 716 Mio. $ | JFK: 3 914 Mio. $ | FRA: 3 545 Mio. $ |
| 5 | LAX: 11 142 Mio. $ | ATL: 2 669 Mio. $ | SYD: 4 603 Mio. $ | LHR: 2 726 Mio. $ | ORD: 1 869 Mio. $ |
| 6 | HND: 107 Mio. $ | ATL: 2 530 Mio. $ | JFK: 5 309 Mio. $ | FRA: 5 384 Mio. $ | CDG: 6 352 Mio. $ |
| 7 | SIN: 27 Mio. $ | SYD: 194 Mio. $ | LHR: 4 764 Mio. $ | ORD: 3 178 Mio. $ | LAX: 4 364 Mio. $ |
| 8 | ATL: 8 419 Mio. $ | JFK: 2 783 Mio. $ | FRA: 4 831 Mio. $ | CDG: 5 862 Mio. $ | HND: 1 703 Mio. $ |
| 9 | SYD: 69 Mio. $ | LHR: 3 356 Mio. $ | ORD: 5 655 Mio. $ | LAX: 2 930 Mio. $ | SIN: 1 943 Mio. $ |

Feste Drehkreuze nach `founderHub` (über 10 Läufe jedes einmal je Persönlichkeit); ist von dort keine Strecke mit Gewinn möglich, das nächste freie aus `FOUNDER_HUBS` (E71).

### Preise und Markt im laufenden Spiel (Mittel der Jahre, alle Haupt-Läufe)

| Jahrzehnt | Preis Y p10 | Preis Y Median | Preis Y p90 | Preiskampf | Gesellschaften je Paar | Paare mit ≥ 2 | Auslastung (Median) | Marge (Median) | Strecken mit Verlust |
|---|---|---|---|---|---|---|---|---|---|
| 1960er | 0,87 | 1,05 | 1,42 | 0,5 % | 1,02 | 2 % | 100 % | 24 % | 5 % |
| 1970er | 0,91 | 1,04 | 1,48 | 0,6 % | 1,02 | 2 % | 100 % | 11 % | 20 % |
| 1980er | 0,87 | 1,02 | 1,50 | 0,9 % | 1,04 | 4 % | 100 % | 34 % | 2 % |
| 1990er | 0,81 | 0,98 | 1,35 | 0,8 % | 1,04 | 4 % | 100 % | 37 % | 1 % |
| 2000er | 0,84 | 0,99 | 1,30 | 0,6 % | 1,03 | 3 % | 100 % | 20 % | 6 % |
| 2010er | 0,85 | 0,99 | 1,28 | 0,6 % | 1,03 | 3 % | 100 % | 30 % | 1 % |

Preis Y = Preisniveau Economy (`fareRatio`) je Strecke und Monat. Auslastung und Marge je Strecke und Monat aus dem Bericht des Abschlusses.

### Auslastung / Marge je Streckenlänge (Median je Jahr, Mittel der Jahre, Haupt-Läufe; E67)

| Jahrzehnt | kurz | Strecken | mittel | Strecken | lang | Strecken | mit Widebody |
|---|---|---|---|---|---|---|---|
| 1960er | 100 % / 25 % | 25 | 100 % / 24 % | 48 | 100 % / 26 % | 11 | 0 |
| 1970er | 100 % / 13 % | 50 | 100 % / 10 % | 85 | 100 % / 9 % | 21 | 6 |
| 1980er | 100 % / 29 % | 57 | 100 % / 35 % | 96 | 99 % / 37 % | 47 | 36 |
| 1990er | 100 % / 32 % | 59 | 100 % / 38 % | 137 | 100 % / 38 % | 124 | 76 |
| 2000er | 100 % / 20 % | 62 | 100 % / 21 % | 161 | 100 % / 19 % | 113 | 73 |
| 2010er | 100 % / 27 % | 66 | 100 % / 31 % | 207 | 100 % / 32 % | 131 | 81 |

kurz unter 1 000 km, mittel bis 3 500 km, lang darüber (Großkreis). „Strecken“ = KI-Strecken je Monat und Lauf. „mit Widebody“ = KI-Strecken mit einem Flugzeug der Klasse Widebody im Januar, je Lauf (E81).

### Preisniveau Economy je Persönlichkeit (Median, Mittel der Jahre)

| Jahrzehnt | flag | lcc | expansionist | optimizer | boutique |
|---|---|---|---|---|---|
| 1960er | 1,19 | 0,91 | 0,94 | 1,40 | 1,14 |
| 1970er | 1,17 | 0,93 | 0,96 | 1,54 | 1,12 |
| 1980er | 1,19 | 0,93 | 0,94 | 1,55 | 1,13 |
| 1990er | 1,16 | 0,90 | 0,87 | 1,38 | 1,08 |
| 2000er | 1,18 | 0,91 | 0,91 | 1,36 | 1,10 |
| 2010er | 1,18 | 0,91 | 0,92 | 1,36 | 1,11 |

### Preis-Sprünge von Monat zu Monat (|Δ Preisniveau Economy| je Strecke)

| Jahrzehnt | Optimizer Median | Optimizer p90 | Optimizer ≥ 0,25 | andere p90 | andere ≥ 0,25 |
|---|---|---|---|---|---|
| 1960er | 0,03 | 0,09 | 1,3 % | 0,02 | 0,0 % |
| 1970er | 0,03 | 0,09 | 0,5 % | 0,01 | 0,0 % |
| 1980er | 0,03 | 0,07 | 0,2 % | 0,02 | 0,0 % |
| 1990er | 0,03 | 0,06 | 0,2 % | 0,02 | 0,0 % |
| 2000er | 0,03 | 0,08 | 1,4 % | 0,02 | 0,0 % |
| 2010er | 0,02 | 0,07 | 0,3 % | 0,02 | 0,0 % |

„Sprung“ = Änderung um mindestens 0,25 Preisniveau in einem Monat (z. B. 1,20 → 1,45).

### Umsteiger in Märkten mit Direktangebot (Januar, Mittel der Haupt-Läufe)

| Januar | Paare | Anteil Median | Anteil p90 | Wunsch Median | Paare über 25 % | Anteil gesamt | Umsteiger ohne Direktangebot je Woche |
|---|---|---|---|---|---|---|---|
| 1965 | 11 | 0,0 % | 2,7 % | 32,5 % | 1,7 % | 0,1 % | 11 650 |
| 1970 | 28 | 0,4 % | 3,4 % | 30,9 % | 1,8 % | 0,3 % | 23 261 |
| 1975 | 11 | 0,2 % | 3,6 % | 36,4 % | 3,9 % | 0,1 % | 4 390 |
| 1980 | 19 | 0,0 % | 5,5 % | 30,0 % | 4,2 % | 0,2 % | 16 565 |
| 1985 | 65 | 0,0 % | 7,9 % | 28,5 % | 2,3 % | 0,7 % | 36 506 |
| 1990 | 99 | 0,0 % | 5,2 % | 28,0 % | 2,3 % | 0,6 % | 55 115 |
| 1995 | 119 | 0,0 % | 7,9 % | 26,9 % | 2,5 % | 0,8 % | 70 781 |
| 2000 | 131 | 0,0 % | 10,0 % | 25,2 % | 2,8 % | 0,9 % | 90 091 |
| 2005 | 87 | 0,0 % | 8,4 % | 25,8 % | 3,6 % | 0,7 % | 79 210 |
| 2010 | 94 | 0,6 % | 17,5 % | 21,2 % | 6,3 % | 1,3 % | 168 748 |
| 2015 | 121 | 0,0 % | 10,5 % | 23,4 % | 3,4 % | 0,8 % | 110 801 |
| 2020 | 129 | 0,0 % | 11,7 % | 23,8 % | 3,4 % | 0,9 % | 117 462 |

Anteil = platzierte Umsteiger ÷ (Direktgäste + Umsteiger) je Paar O–D mit Direktangebot und Umsteige-Verbindung. „Wunsch“ = vor der Verteilung auf freie Sitze. `CONNECTION_APPEAL` = 0,50.

### Wachstum der KI (Mittel der Jahre, Haupt-Läufe)

| Jahrzehnt | KI | Flugzeuge je KI | Eröffnungen je KI und Jahr | Käufe je KI und Jahr | Schließungen je KI und Jahr | Verkäufe je KI und Jahr | neue Drehkreuze je Jahr | Nachrücker je Jahr | Auflösungen je Jahr |
|---|---|---|---|---|---|---|---|---|---|
| 1960er | 5,0 | 18 | 3,7 | 2,9 | 0,5 | 0,1 | 0,41 | 0,00 | 0,00 |
| 1970er | 5,0 | 32 | 2,9 | 2,0 | 3,4 | 2,4 | 0,21 | 0,00 | 0,00 |
| 1980er | 5,0 | 41 | 3,3 | 3,0 | 0,5 | 1,5 | 0,02 | 0,00 | 0,00 |
| 1990er | 5,0 | 65 | 2,1 | 1,9 | 0,4 | 2,1 | 0,03 | 0,00 | 0,00 |
| 2000er | 5,0 | 68 | 3,1 | 1,7 | 3,4 | 4,6 | 0,04 | 0,00 | 0,00 |
| 2010er | 5,0 | 82 | 2,3 | 1,9 | 0,5 | 3,4 | 0,03 | 0,00 | 0,00 |

### Geld und Slots der KI je Jahr (Preise von 1960, Mittel je lebender KI, Haupt-Läufe)

| Jahrzehnt | Erlös | Ergebnis | Zuschuss | Dividende | Kasse (Januar) | Slot-Haltungen an der eigenen Grenze | größter KI-Anteil an einem Flughafen |
|---|---|---|---|---|---|---|---|
| 1960er | 469 Mio. $ | 112 Mio. $ | 0 Mio. $ | 27 Mio. $ | 229 Mio. $ | 1,2 % | 24 % |
| 1970er | 792 Mio. $ | 90 Mio. $ | 0 Mio. $ | 78 Mio. $ | 541 Mio. $ | 1,1 % | 26 % |
| 1980er | 1 380 Mio. $ | 486 Mio. $ | 0 Mio. $ | 312 Mio. $ | 857 Mio. $ | 1,5 % | 28 % |
| 1990er | 2 411 Mio. $ | 879 Mio. $ | 0 Mio. $ | 733 Mio. $ | 1 490 Mio. $ | 3,0 % | 30 % |
| 2000er | 2 319 Mio. $ | 448 Mio. $ | 0 Mio. $ | 408 Mio. $ | 1 838 Mio. $ | 1,5 % | 29 % |
| 2010er | 2 552 Mio. $ | 765 Mio. $ | 0 Mio. $ | 641 Mio. $ | 1 764 Mio. $ | 2,7 % | 29 % |

Slot-Haltung = eine KI mit Slots an einem Flughafen; Grenze = `rivalSlotCap` (25 % am Drehkreuz, sonst 10 %, 7.10).

### KI-Stärke: Gründer nach 40 Jahren (mit Zuschuss)

| Stärke | Läufe | Median Unternehmenswert | Flugzeuge je Gründer | aufgelöste Gründer |
|---|---|---|---|---|
| easy | 3 | 1 626 Mio. $ | 30 | 0 |
| normal | 10 | 2 992 Mio. $ | 73 | 0 |
| hard | 3 | 2 483 Mio. $ | 85 | 0 |

### Rechenzeit (ein Prozess, alle Flughäfen der Daten)

| Jahrzehnt | ms je Monat | KI-Strecken |
|---|---|---|
| 1960er | 137 | 88 |
| 1970er | 285 | 142 |
| 1980er | 373 | 190 |
| 1990er | 524 | 299 |
| 2000er | 688 | 336 |
| 2010er | 753 | 410 |
| ganzer Lauf | 4,4 min |  |

Gemessen während mehrere Läufe gleichzeitig rechneten; ein einzelner Lauf ist etwas schneller.

