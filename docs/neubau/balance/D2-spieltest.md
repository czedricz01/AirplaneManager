# Paket D2: Flacheres Nachfrage-Wachstum (27.11.2026)

Auftrag: Antwort B auf Frage O101 umsetzen (`D1-stadtwerte.md`, Abschnitt 8): Nachfrage-Wachstum flacher,
`DEMAND_SCALE` so, dass 2025 gleich bleibt, Regel E64 lockern; mit verkleinerter Spieltest-Matrix messen.

## Kurz

- **Umgesetzt (E108):** `DEMAND_GROWTH_1960_2019` 1,97 → **1,5**, `DEMAND_SCALE` 6,0 → **8,1**
  (`src/model/constants.ts`). Märkte 2025 gleich (Faktor 0,9999), 1995 × 1,15, 1970 × 1,29, 1960 × 1,35.
- **Regel E64 gelockert:** Die Summe der Marktgrößen aller Paare wächst 1960 → 2019 um × 1,90 statt × 2,50
  (Balance-Skript B3.1, Ziel jetzt × 1,9 ± 10 %, `src/balance/market.ts`).
- **Der vorgeschlagene Wert 1,75 reicht nicht:** Er hebt 1970 nur um 12 %; Hard optimierer +4 Mio. $ statt +1.
  Mit 1,5: Hard optimierer +16, luxus +11 Mio. $ (Mittel zweier Startwerte).
- **1995** liegt zwischen D1 und dem alten Stand, **2025** wie D1.
- **Offen:** 1970 bringt Hard nur 21–23 % des Easy-Ergebnisses (E106: etwa 30–50 %) → Frage O102.

## 1. Rechnung

Die Marktgröße ist `DEMAND_SCALE × g ^ ((Jahr − 1960) / 59) × Rest` (`src/model/demand.ts:358`); der Rest hängt nicht
von `g` ab. Damit 2025 gleich bleibt, gilt `DEMAND_SCALE neu = 6,0 × (1,97 / g) ^ (65 / 59)`.

| `g` (`DEMAND_GROWTH_1960_2019`) | `DEMAND_SCALE` | Faktor 1960 | 1970 | 1995 | 2025 | Summe 1960 → 2019 (B3.1) |
|---|---|---|---|---|---|---|
| 1,97 (D1) | 6,0 | 1 | 1 | 1 | 1 | × 2,50 |
| 1,75 (Vorschlag O101) | 6,85 | 1,14 | 1,12 | 1,06 | 1,00 | × 2,22 |
| **1,5 (gewählt)** | **8,1** | **1,35** | **1,29** | **1,15** | **1,00** | **× 1,90** |

## 2. Spieltest-Matrix

`scripts/playtest-matrix.ts --jobs 4`, verkleinert wie in D1: optimierer, vorsichtig, luxus, standard, Startwert 1,
alle Zeitalter und Stufen; 1970 dazu Startwert 2 (ohne standard). 42 Spiele, kein Fehler. `--only` nimmt jetzt einen
regulären Ausdruck (`scripts/playtest-matrix.ts:78`).

Ergebnis der letzten 12 Monate in Mio. $, Easy / Normal / Hard.

**Normal Mode, DUS, 1970–1979** (Vorauswahl mit 1,75 und 1,5 nur Startwert 1)

| Strategie | 5.4h (alt) | D1 (1,97) | 1,75 | **1,5, Startwert 1** | **1,5, Mittel 2 Startwerte** |
|---|---|---|---|---|---|
| standard | +1,1 / −3,0 / −5,5 | +0,4 / −3,1 / −4,8 | +0,4 / −3,1 / −4,8 | +0,4 / −3,1 / −4,8 | – |
| vorsichtig | +14 / +4,2 / −2,0 | +17 / −8,1 / −8,1 | +18 / −3,0 / −4,5 | +7,6 / +12 / −6,8 | **+15 / +5,8 / −8,9** |
| luxus | +65 / +38 / +21 | +31 / +19 / +5,1 | +37 / +21 / +9,1 | +50 / +25 / +16 | **+49 / +23 / +11** |
| optimierer | +80 / +59 / +34 | +47 / +23 / +1,0 | +66 / +27 / +4,1 | +75 / +37 / +17 | **+77 / +35 / +16** |

Firmenwert nach 10 Jahren (Mittel, Start 50 Mio. $ von 1960): optimierer 860 / 486 / 316, luxus 504 / 293 / 195.

**Free Mode, FRA, 1995–2004** (Startwert 1)

| Strategie | 5.4h (alt) | D1 (1,97) | **1,5** |
|---|---|---|---|
| standard | −1,3 / −3,7 / −5,7 | −0,6 / −3,7 / −4,7 | −0,6 / −3,7 / −4,7 |
| vorsichtig | +106 / +63 / +39 | +131 / +89 / +59 | **+162 / +99 / +61** |
| luxus | +271 / +170 / +115 | +202 / +135 / +89 | **+234 / +162 / +100** |
| optimierer | +527 / +385 / +241 | +343 / +184 / +121 | **+413 / +264 / +149** |

**Free Mode, FRA, 2025–2029** (Startwert 1)

| Strategie | 5.4h (alt) | D1 (1,97) | **1,5** |
|---|---|---|---|
| standard | +17 / +10 / +6,1 | +3,5 / +0,2 / −1,3 | +3,5 / +0,2 / −1,3 |
| luxus | +140 / +104 / +83 | +150 / +114 / +91 | **+143 / +114 / +89** |
| optimierer | +303 / +199 / +115 | +313 / +222 / +164 | **+311 / +217 / +159** |

Hard ÷ Easy mit 1,5: 1970 optimierer 21 %, luxus 23 % (Firmenwert 37 % / 39 %); 1995 optimierer 36 %, luxus 43 %,
vorsichtig 38 %; 2025 optimierer 51 %, luxus 62 %.

„standard“ ist in allen drei Fassungen gleich: Seine Flugzeuge sind auf jeder Strecke voll, mehr Nachfrage ändert
nichts.

## 3. Weitere Prüfungen

- Balance-Skript ohne Langlauf: 16 ok · 0 Abweichung · 25 Info; B3.1 Summe 1,90, Mittel der Verhältnisse 2,50,
  Median 1,71.
- Test-Anpassungen: 3.3 (`demandGrowth` 2019 = 1,5, `src/model/demand.test.ts:225`); Umsteiger-Test 4.7b mit
  Preis 200 statt 150 $ (`src/lib/modelNetwork.test.ts:50`): Mit 15 % größeren Märkten 1995 füllen Direktgäste
  beide A320 ganz, dann findet kein Umsteiger Platz. Der Test prüft die Buchung der Umsteiger, nicht den Preis.
- Langlauf nach F89, D1 und D2: Paket D3, `D3-bericht.md`.

## 4. Funde

- **Fund 82 – 1970 wieder klar gewinnbar, Hard aber nur gut ein Fünftel von Easy → Frage O102.** Easy fast wie
  vor D1 (optimierer +77 gegen +80), Hard halb so viel wie vor D1 (+16 gegen +34). Grund: Kosten-Faktor 0,85 / 1,1
  (E87) auf dünne Margen 1970; mehr Nachfrage hebt Easy stärker als Hard. „vorsichtig“ war auf Hard schon vor D1 im
  Verlust (5.4h: −2,0).

## 5. Frage O102

1970 bringt Hard 21–23 % des Easy-Ergebnisses guter Strategien (E106: etwa 30–50 %), bleibt aber klar im Gewinn
(Firmenwert × 3–6 in 10 Jahren). 1995 und 2025 liegen im Band.

- **A (Empfehlung): so lassen.** Hard ist 1970 klar gewinnbar; das Band aus E106 gilt ab 1990.
- **B: Wachstum noch flacher** (etwa 1,3, `DEMAND_SCALE` 9,5; Summe 1960 → 2019 × 1,65). Entfernt sich weiter von E7.
- **C: Kosten-Faktor Hard vor 1980 kleiner** (neue Regel, greift in E87 ein).
