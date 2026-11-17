# Bestand: Preis und Erlös

Paket 1.3 · Stand 17.11.2026 · Commit 5a41e40

Alle Fundstellen ohne Pfad liegen in `src/lib/financeUtils.ts`.
Planer = `src/components/RoutePlannerView.tsx`.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).
Standard-Beispiel: A320ceo (150 Economy, 12 Business), Juli, Schwierigkeit Normal, keine Rivalen.
Preise gelten **je Fluggast und Strecke (eine Richtung)**, Erlöse **pro Woche**.

## Überblick

Der Preis entscheidet, wie viele der möglichen Fluggäste wirklich buchen, und damit den Erlös.
Das Spiel rechnet für jede Klasse einen „Marktpreis“ (was Fluggäste für fair halten).
Liegt der eigene Preis darunter, kommen mehr Gäste (höchstens 1,5-fach); liegt er darüber,
bleiben schnell viele weg. Rechenweg in einem Bild:

```
Entfernung und Flugzeit
  → Grundpreis Economy = (30 + 0,05 × km) × Kurzstrecken-Zuschlag      :721-726
  → Grundpreis Premium / Business / First = Economy × Klassen-Faktor     :728-730
  → × Schwierigkeit (Easy 1,12 / Hard 0,88)                              :479-483, :1413
  → × SAT-Faktor (SAT 100 = 1; SAT 50 = 0,5; SAT 160 = 1,35)             :740-750, :1414
  → × Knappheits-Zuschlag (bis +10 %, wenn Nachfrage > Sitze)            :1060-1063, :1463
  = Marktpreis
  → Preis-Faktor = wie stark die Nachfrage auf eigenen Preis / Marktpreis reagiert  :1010-1019
  → Fluggäste = min(Sitze, min(Nachfrage, Sitze) × Preis-Faktor)         :1468-1471
  → Erlös = Fluggäste × eigener Preis  (+ Anteil der Umsteiger)          :1475, :1493-1508
  → Monat = Woche × 4                                                    src/lib/monthClose.ts:487
```

## Größen

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Kurzstrecken-Zuschlag | Tabelle je Flugzeitindex: 1,15 (Index 1–2), 1,10 (3–4), 1,05 (5), 1,0 (ab 6); gleitend dazwischen | `:721`, `:266-276` | Flugzeitindex | Grundpreis Economy |
| Grundpreis Economy | (30 + 0,05 × km) × Kurzstrecken-Zuschlag | `:726` | Entfernung, Flugzeitindex | alle Grundpreise |
| Grundpreis Premium | Economy × (1,3 + 0,15 × (Index − 1)) → 1,30 … 2,35 | `:728` | Flugzeitindex | Marktpreis Premium |
| Grundpreis Business | Economy × (2,0 + 0,25 × (Index − 1)) → 2,00 … 3,75 | `:729` | Flugzeitindex | Marktpreis Business |
| Grundpreis First | Economy × (3,0 + 0,5 × (Index − 1)) → 3,00 … 6,50 | `:730` | Flugzeitindex | Marktpreis First |
| Schwierigkeits-Faktor (`difficultyFareFactor`) | Easy 1,12 · Hard 0,88 · sonst 1 | `:479-483` | Schwierigkeit | Marktpreis (Spieler und KI) |
| Ausgangspreis (`marketBase`) | Grundpreis × Schwierigkeits-Faktor | `:1413` | obige | Marktpreis, Preis-Reiz im Marktanteil (`:1427`) |
| SAT-Faktor (`getSatMultiplier`) | SAT ≤ 100: SAT/100; 100–200: 1 + 0,008 × x − 0,000035 × x² (x = SAT − 100); über 200: 1,45 + 0,001 × (SAT − 200) | `:740-750` | SAT der Klasse | SAT-Preis |
| SAT-Preis (`satBase`) | runden(Ausgangspreis × SAT-Faktor) | `:1414` | obige | Marktpreis, Ersatzpreis |
| Knappheits-Zuschlag (`scarcityPremium`) | (Nachfrage / Sitze)^0,25, höchstens 1,10; 1, wenn die Sitze reichen | `:1056-1063` | Markt-Nachfrage der Strecke, eigene Sitze pro Woche | Marktpreis |
| Marktpreis (`marketFare`) | runden(SAT-Preis × Knappheits-Zuschlag) | `:1463-1464` | obige | Preis-Faktor, Anzeige „Market fare“ |
| Eigener Preis | `activeTicketPrices`, sonst `ticketPrices`, sonst Grundpreise (ohne SAT und Schwierigkeit); fehlt nur eine Klasse: SAT-Preis | `:1352-1357`, `:1418` | Spieler-Eingabe | Preis-Faktor, Marktanteil, Erlös |
| Preisänderung wirksam | Neue Preise gelten erst ab dem nächsten Monatsabschluss (`activeTicketPrices` wird dann überschrieben) | `src/lib/monthClose.ts:1451-1454`; Planer `:3843-3846` | Monatswechsel | eigener Preis |
| Preis-Empfindlichkeit (`PRICE_ELASTICITY`) | Economy 1,2 · Premium 1,0 · Business 0,8 · First 0,7 | `:1002-1004` | Klasse | Preis-Faktor |
| Preis-Faktor (`getPriceDemandMultiplier`) | Preis ≤ Marktpreis: min(1,5; (Marktpreis/Preis)^E). Preis > Marktpreis: 0,75 × (Marktpreis/Preis)^(3 × E) + 0,25 × (Marktpreis/Preis) | `:1010-1019`, `:978`, `:990` | Preis, Marktpreis, Klasse | Fluggäste |
| Erreichbare Nachfrage | min(Markt-Nachfrage, Sitze pro Woche × 1,0) | `:1040`, `:1468` | Nachfrage (Paket 1.2), Sitze | Fluggäste |
| Fluggäste (lokal) | min(Sitze, abrunden(erreichbar × Preis-Faktor)); bei „volle Maschine“ (`forceFullLoad`) einfach alle Sitze | `:1469-1471` | obige | Erlös, Kosten je Gast |
| Erlös lokal | Σ Klassen: Fluggäste × eigener Preis | `:1475` | obige | Wochenerlös |
| Umsteiger-Tarif | runden(Grundpreis der direkten O–D-Entfernung × 0,9); ohne Schwierigkeit, SAT, Knappheit | `src/lib/transferUtils.ts:45`, `:362`, `:367` | Entfernung O–D | Umsteiger-Erlös |
| Umsteiger-Erlös je Strecke | Tarif × Gäste, nach Flugkilometern auf beide Teilstrecken verteilt; anteilig gekürzt, wenn weniger Sitze frei sind | `src/lib/transferUtils.ts:470-474`; `:1499-1501` | Netz | Wochenerlös |
| Wochenerlös (`estWeeklyRev`) | Erlös lokal + Umsteiger-Erlös | `:1507-1508`, `:1535` | obige | Monatserlös, Anzeigen |
| Monatserlös | Wochenerlös × 4 | `src/lib/monthClose.ts:470-474`, `:487` | Wochenerlös | Kasse, Bericht |
| Gewichtete Sitze | Sitze × (1 / 1,6 / 3,0 / 5,0) × Flugabschnitte | `:1518-1523` | Bestuhlung | Gewinnschwellen-Preise |
| Gewinnschwellen-Preis (BE75, BE99, BE35) | Wochenkosten / (gewichtete Sitze × 0,75 bzw. 0,99 bzw. 0,35) | `:1525-1527` | Kosten (Paket 1.4) | Planer-Regler |
| KI-Preise (`ticketPricesFor`) | Grundpreis × Faktor je Typ: Easy-KI 2,25 … 2,50; LCC 0,82 … 1; Flag 1,05 … 1,18; Boutique 1,02 … 1,35; Optimizer 1,04 … 1,06; Expansionist 0,92 … 1 | `src/lib/aiSimulation.ts:336-352` | KI-Typ, KI-Schwierigkeit | KI-Erlös |
| KI-Preiskampf | Preise × (1 − 0,12), höchstens −50 %; zählt im Spieler-Marktanteil als Preis-Reiz 1 / (1 − Nachlass) | `src/lib/aiSimulation.ts:72`, `:354-363`, `:896-899`; `src/lib/monthClose.ts:201` | umkämpfte Strecke | KI-Erlös, Spieler-Marktanteil |
| Planer: Startpreis | Marktpreis je Klasse; ohne Marktpreis BE75 × (1 / 1,6 / 3 / 5) | Planer `:1032-1045` | Marktpreis | eigener Preis |
| Planer: Reglerbereich | um BE75, mindestens 0,5- bis 1,5-facher Marktpreis | Planer `:3386-3394`, `:3716-3719` | BE-Preise, Marktpreis | Eingabe |
| Planer: Regler „Adjust All Prices“ | setzt Premium / Business / First fest auf 1,6 / 3,0 / 5,0 × Economy-Preis | Planer `:3657-3667` | Economy-Preis | eigener Preis |

## Konstanten

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| 30 $ + 0,05 $/km | Grundpreis Economy | `:726` |
| 1,15 / 1,10 / 1,05 / 1,0 | Kurzstrecken-Zuschlag je Flugzeitindex | `:721` |
| 1,3 + 0,15 · 2,0 + 0,25 · 3,0 + 0,5 je Index | Klassen-Faktoren Premium · Business · First | `:728-730` |
| 1,12 / 1 / 0,88 | Preis Easy / Normal (und jeder andere Text) / Hard | `:479-483` |
| 0,008 / 0,000035 / 1,45 / 0,001 | Kurve des SAT-Faktors über 100 | `:744`, `:747` |
| 160 | `SAT_MAX`: SAT kann nicht über 160 steigen | `:775` |
| 1,2 / 1,0 / 0,8 / 0,7 | Preis-Empfindlichkeit Economy / Premium / Business / First | `:1002` |
| 1,5 | Höchster Preis-Faktor (bei Preis unter Marktpreis) | `:1014`, `:1016` |
| 3 | `OVERPRICE_ELASTICITY_FACTOR`: über dem Marktpreis 3-mal so empfindlich | `:978` |
| 0,25 | `PRICE_INSENSITIVE_SHARE`: Anteil der Gäste, die über dem Marktpreis nur schwach reagieren | `:990` |
| 1,0 | `MAX_DEMAND_SURPLUS`: Nachfrage zählt nur bis zu den eigenen Sitzen | `:1040` |
| 0,10 / 0,25 | `MAX_SCARCITY_PREMIUM` / Hochzahl des Knappheits-Zuschlags | `:1056-1057` |
| 0,9 | `TRANSFER_FARE_FACTOR`: Umsteiger-Tarif | `src/lib/transferUtils.ts:45` |
| 800 km/h | Geschwindigkeit für Umsteiger-Märkte (Flugzeitindex des Tarifs) | `src/lib/transferUtils.ts:70` |
| 1 / 1,6 / 3,0 / 5,0 | Klassen-Gewichte der Gewinnschwelle, des Startpreises und des Reglers „Adjust All“ | `:1518-1523`; Planer `:1039-1042`, `:3662`, `:3709` |
| 0,75 / 0,99 / 0,35 | Auslastungen der drei Gewinnschwellen | `:1525-1527` |
| 0,12 / 0,5 | KI-Preiskampf / größter Nachlass | `src/lib/aiSimulation.ts:72`, `:356`; `src/lib/monthClose.ts:201` |
| 4 | Wochen je Monat | `src/lib/monthClose.ts:473`, `:487` |
| 1,2 % pro Jahr | Kosten steigen real, Preise nicht (`REAL_COST_GROWTH`) | `src/lib/realCosts.ts:19`, `:25-28` |

## Beispielwerte (nachgerechnet)

Grundpreise (Normal, SAT 100, ohne Knappheit), Reisegeschwindigkeit 850 km/h:

| Paar | km | Index | Economy | Premium | Business | First | Economy $/km |
|---|---|---|---|---|---|---|---|
| Frankfurt–Paris | 449 | 1,22 | 60 | 80 | 124 | 187 | 0,13 |
| Frankfurt–Madrid | 1 420 | 2,38 | 114 | 172 | 268 | 422 | 0,08 |
| Frankfurt–New York | 6 189 | 6,03 | 339 | 698 | 1 106 | 1 873 | 0,05 |
| London–Sydney | 17 020 | 8 | 881 | 2 070 | 3 304 | 5 727 | 0,05 |

Preis-Faktor und Erlös je 100 Gäste Nachfrage (Marktpreis = 100, Sitze reichen):

| Preis | 50 | 70 | 80 | 90 | 100 | 110 | 120 | 150 | 200 |
|---|---|---|---|---|---|---|---|---|---|
| Economy: Faktor / Erlös | 1,50 / 75 | 1,50 / 105 | 1,31 / 105 | 1,13 / 102 | 1 / 100 | 0,76 / 84 | 0,60 / 72 | 0,34 / 51 | 0,19 / 37 |
| First: Faktor / Erlös | 1,50 / 75 | 1,28 / 90 | 1,17 / 94 | 1,08 / 97 | 1 / 100 | 0,84 / 93 | 0,72 / 86 | 0,49 / 73 | 0,30 / 60 |

- SAT-Faktor: SAT 0 / 50 / 80 / 100 / 120 / 140 / 160 → 0 / 0,5 / 0,8 / 1 / 1,146 / 1,264 / 1,354.
- Knappheit: Nachfrage / Sitze 1,1 / 1,2 / 1,3 / ab 1,46 → +2 % / +5 % / +7 % / +10 %.
- Frankfurt–Madrid 1990, 7 Umläufe, SAT Economy 90: Marktpreis Economy 113 $ (= 114 × 0,9 × 1,10).
  Easy 127 $, Hard 99 $.
- Kostenindex 1960 / 1990 / 2020: 1 / 1,43 / 2,05; Preise bleiben gleich.
- 4 Wochen × 12 = 48 Wochen im Jahr statt 52,2 (−8 %).

## Widersprüche und Auffälligkeiten

### W1 · Planer zeigt als Hauptzahl einen Gewinn, der mit jedem Preis steigt
- Befund: Auf Normal und Hard rechnet der Planer die großen Zahlen („Est. Weekly Revenue“, „Max Weekly Profit (full aircraft)“, Gäste-Zeile oben) mit `forceFullLoad`: jede Maschine voll, egal welcher Preis. Der Preis-Faktor wirkt dort nicht. Nur der kleinere Kasten „Expected Weekly Profit (current demand)“ rechnet echt. Auf Easy ist es umgekehrt: dort ist die Hauptzahl die echte Erwartung.
- Fundstelle: Planer `:971-980`, `:3359-3363`, `:3416`, `:3422`, `:3549-3566`; `:1471`
- Folge im Spiel: Frankfurt–Madrid 1990, 7 Umläufe, Economy 1,5 × Marktpreis: „Max Weekly Profit“ +187 779 $, erwartet −25 986 $. Beim Marktpreis sind beide +68 079 $. Wer den Preis nach der großen Zahl einstellt, setzt ihn zu hoch.
- Vorschlag: Hauptzahl immer die Erwartung bei heutiger Nachfrage; „volle Maschine“ höchstens als Nebenzahl, gerechnet beim Marktpreis.
- Braucht Entscheidung: nein

### W2 · Feste Klassen-Faktoren 1,6 / 3 / 5 passen nicht zu den Grundpreisen
- Befund: Grundpreise der Klassen wachsen mit der Flugzeit (Premium 1,3 → 2,35; Business 2,0 → 3,75; First 3,0 → 6,5 × Economy). Der Planer nutzt dagegen feste 1,6 / 3,0 / 5,0 für (a) den Regler „Adjust All Prices“, (b) die Gewinnschwellen-Striche jeder Klasse, (c) die Gewichte der Gewinnschwelle im Rechenkern, (d) den Startpreis ohne Marktpreis.
- Fundstelle: Planer `:3657-3667`, `:3709-3713`, `:1036-1043`; `:1518-1527`; `:728-730`
- Folge im Spiel (gleiche SAT in allen Klassen angenommen): Frankfurt–Paris: „Adjust All“ auf Economy-Marktpreis setzt First auf 5 × statt 3,1 × → 1,6-facher First-Marktpreis, Preis-Faktor ≈ 0,45. Frankfurt–New York: Premium 1,6 × statt 2,06 × → 22 % unter Marktpreis, verschenkter Erlös. Die Gewinnschwelle für First auf Kurzstrecke liegt im Regler deutlich zu hoch, auf Langstrecke zu tief.
- Vorschlag: Klassen-Verhältnisse überall aus den Grundpreisen der Strecke nehmen (eine Funktion). Entspricht O2.
- Braucht Entscheidung: ja (= O2)

### W3 · Unter dem Marktpreis bringt Economy mehr Erlös
- Befund: Economy hat Empfindlichkeit 1,2 (> 1). Unter dem Marktpreis wächst die Gästezahl stärker, als der Preis sinkt; der Erlös steigt bis zur Grenze 1,5 (bei 71 % des Marktpreises). Das gilt nur, solange die Sitze nicht schon voll sind.
- Fundstelle: `:1002`, `:1016`, `:1468-1471`
- Folge im Spiel: Frankfurt–Madrid Januar 1960 (Hard), 35 Umläufe, Nachfrage 2 677 bei 10 500 Sitzen: Economy-Erlös bei Marktpreis 240 930 $, bei 0,7 × Marktpreis 252 945 $ (+5 %). Billiger ist auf halbleeren Strecken immer besser; der Marktpreis ist nicht der beste Preis. Mit Rivalen kommt der Anteilsgewinn dazu (W4 aus 1.2).
- Vorschlag: Festlegen, ob „unter Marktpreis“ den Erlös erhöhen darf. Wenn nein: Empfindlichkeit unter dem Marktpreis höchstens 1.
- Braucht Entscheidung: ja

### W4 · KI-Preise kennen den Marktpreis nicht
- Befund: Die KI setzt ihre Preise als Grundpreis × eigener Faktor, ohne Schwierigkeit und ohne SAT. Der Rechenkern misst sie aber am Marktpreis mit Schwierigkeit (der KI-Stufe) und SAT. Die KI hat kaum Service, SAT ≈ 85.
- Fundstelle: `src/lib/aiSimulation.ts:336-352`, `:407`, `:776`; `:1413-1414`
- Folge im Spiel (Frankfurt–Madrid 1990, 7 Umläufe, A320): Optimizer-KI auf Normal 119 $ gegen Marktpreis 107 $ → 74 % Auslastung; dieselbe KI auf Hard gegen Marktpreis 94 $ → 52 %. Easy-KI mit 2,25 × Grundpreis (257 $ gegen 120 $) → 16 %. Gleichzeitig zählt die teure Easy-KI im Spieler-Marktanteil wie eine KI mit fairem Preis (Preis-Reiz 1), weil nur der Preiskampf-Nachlass weitergegeben wird.
- Vorschlag: KI-Preise als Faktor auf den Marktpreis setzen, mit derselben Funktion wie der Spieler; Preis-Reiz der KI aus ihrem echten Preis. Gehört auch zu Paket 1.6 (Bezug 1.2 W7, W10).
- Braucht Entscheidung: nein

### W5 · Umsteiger zahlen nach eigenen Regeln
- Befund: Umsteiger-Tarif = 0,9 × Grundpreis. Ohne Schwierigkeit, ohne SAT, ohne Knappheit, Flugzeitindex mit 800 km/h. Direktgäste zahlen den Marktpreis mit allen drei.
- Fundstelle: `src/lib/transferUtils.ts:45`, `:354`, `:362`, `:367`; `:1413-1414`, `:1463`
- Folge im Spiel: Auf Easy zahlt ein Umsteiger 80 % des Direktpreises (0,9 / 1,12), auf Hard 102 % (0,9 / 0,88): Umsteigen ist auf Hard teurer als direkt. Gute SAT bringt Direktgästen bis 35 % mehr, Umsteigern nichts.
- Vorschlag: Umsteiger-Tarif = Marktpreis der O–D-Verbindung × fester Abschlag, mit derselben Funktion (Bezug 1.2 W9).
- Braucht Entscheidung: nein

### W6 · Ein Monat hat 4 Wochen
- Befund: Monatserlös und Strecken-Kosten = Woche × 4. Das Jahr hat damit 48 statt 52,2 Wochen. Fixe Monatskosten (Leasing, Personal, Unterhalt) sind davon nicht betroffen.
- Fundstelle: `src/lib/monthClose.ts:470-474`, `:487-499`
- Folge im Spiel: Jede Strecke bringt im Jahr 8 % weniger Erlös und Deckungsbeitrag, als die Wochenzahl im Planer vermuten lässt. Das Verhältnis Strecken-Gewinn zu Fixkosten ist um 8 % verschoben.
- Vorschlag: 365,25 / 12 / 7 ≈ 4,35 Wochen je Monat als eine Konstante, oder die Wochenwerte ausdrücklich als „4-Wochen-Monat“ festlegen. Gehört auch zu Paket 1.7.
- Braucht Entscheidung: ja (welche Monatslänge)

### W7 · Preise bleiben von 1960 bis heute gleich, Kosten nicht
- Befund: Grundpreise hängen nur von Entfernung und Flugzeit ab. Löhne und Flughafengebühren steigen dagegen real um 1,2 % pro Jahr (× 2,05 bis 2020), Treibstoff folgt den echten Preisen. Der Code begründet das bewusst (`realCosts.ts:1-15`).
- Fundstelle: `:726`; `src/lib/realCosts.ts:1-28`
- Folge im Spiel: Gleiche Strecke, gleicher Preis: Die Marge schrumpft mit den Jahren, ohne dass der Spieler etwas ändert. Zusammen mit der Jahresbremse der Nachfrage (1.2 W8) wirken drei Zeitregeln gegeneinander; ob die Summe gewollt ist, prüft niemand.
- Vorschlag: Im Balance-Skript (3.9) Marge je Jahrzehnt zeigen und die Zeitregeln gemeinsam festlegen.
- Braucht Entscheidung: ja (zusammen mit O5)

### W8 · Kommentar sagt 15 %, Code rechnet 10 %
- Befund: Der Kommentar zum Knappheits-Zuschlag nennt „stops at 15 %: 5 % at 1.2, 11 % at 1.5, 15 % from 1.75“. Der Wert ist 0,10; die Grenze ist ab 1,46 erreicht, bei 1,5 gelten 10 %.
- Fundstelle: `:1050-1056`
- Folge im Spiel: Keine Rechenfolge; wer den Kommentar liest, rechnet falsch.
- Vorschlag: Beim Neubau Kommentare aus den Konstanten erzeugen bzw. prüfen (Paket 4.1).
- Braucht Entscheidung: nein

### W9 · Drei verschiedene Ersatzpreise, wenn ein Preis fehlt
- Befund: Fehlen alle Preise, nimmt der Rechenkern die Grundpreise (ohne SAT, ohne Schwierigkeit). Fehlt eine Klasse, nimmt er den SAT-Preis. Die Streckenansicht zeigt dann 0 $. Der Monatsabschluss setzt bei fehlenden Preisen `{ economy: 100 }`.
- Fundstelle: `:1352-1357`, `:1418`; `src/components/RouteDetailView.tsx:488`, `:525`; `src/lib/monthClose.ts:1452`; Planer `:3301-3302`, `:3849`
- Folge im Spiel: Selten (alte Spielstände, Umbau der Bestuhlung). Dann zeigt die Ansicht „@ $0“, gerechnet wird mit einem anderen Preis.
- Vorschlag: Eine Regel „fehlender Preis = Marktpreis“ an einer Stelle.
- Braucht Entscheidung: nein

### W10 · Schwierigkeit wirkt beim Preis anders als bei der Nachfrage
- Befund: Preis Easy 1,12 / Normal 1 / Hard 0,88; unbekannter Text = 1. Nachfrage Easy 1,1 / Normal 0,9 / sonst 0,75. Gegenüber Normal steigen auf Easy also Preis (× 1,12) und Nachfrage (× 1,22) zugleich; auf Hard sinken beide (× 0,88 und × 0,83). Bei vollen Maschinen wirkt nur der Preis.
- Fundstelle: `:479-483`, `:660`
- Folge im Spiel: Siehe 1.2 W6. Hier zusätzlich: Die Debug-Anzeige des Planers rundet den Ausgangspreis vor dem SAT-Faktor, der Rechenkern nicht (Abweichung bis 1 $).
- Vorschlag: In 2.2 festlegen (= O6).
- Braucht Entscheidung: ja (= O6)

### W11 · SAT-Faktor über 200 ist toter Code
- Befund: `getSatMultiplier` hat einen Zweig für SAT über 200. SAT ist aber auf 160 begrenzt. Die Debug-Anzeige zeigt die Formel für „über 200“ trotzdem an.
- Fundstelle: `:746-748`, `:775`; Planer `:3613-3616`
- Folge im Spiel: Keine; unnötiger Code und irreführende Anzeige.
- Vorschlag: SAT-Faktor als eine Kurve 0 … 160 festlegen (Bezug 1.1 W8: SAT wirkt dreifach).
- Braucht Entscheidung: nein

## Doppelte Rechnungen

- Klassen-Faktoren 1,6 / 3 / 5 viermal: Rechenkern `:1518-1523`, Planer-Startpreis `:1039-1042`, Regler „Adjust All“ `:3662`, Regler je Klasse `:3709` (W2).
- Marktpreis-Herleitung im Planer-Debug nachgebaut: Planer `:3591-3605` (Grundpreis × Schwierigkeit × SAT-Faktor, Preis-Faktor). Liest Marktpreis und Gäste aus dem Rechenkern, rechnet Zwischenschritte aber selbst und rundet anders (W10).
- Preis-Formel als Text im Debug: Planer `:3615`, `:3625` (Zahl 3 statt `OVERPRICE_ELASTICITY_FACTOR` fest eingetragen).
- Klassen-Erlös in der Streckenansicht selbst gerechnet: `src/components/RouteDetailView.tsx:494` (`actual × price`); stimmt mit `:1475`, solange ein Preis gesetzt ist (W9).
- Grundpreise ohne Schwierigkeit und SAT an drei weiteren Stellen: KI `src/lib/aiSimulation.ts:338` (W4), Umsteiger `src/lib/transferUtils.ts:362` (W5), Planer-Vorschau Schritt 1 `:951` (Anzeige „BASE“ `:2193-2202`).

## Bezug zu bisherigen offenen Fragen

- O2 (Planer-Preise mit festen Faktoren oder aus der Marktpreisleiter): bestätigt und erweitert, siehe W2.
- O5 (Jahresbremse): zusätzlich W7 (Preise fest, Kosten steigen).
- O6 (Schwierigkeit): siehe W10.
- 1.1 W8 (SAT wirkt dreifach): Preis-Teil hier bestätigt (`:1414`).
- 1.2 W4 (Preis wirkt doppelt): bestätigt; dazu W3 (Erlös unter Marktpreis höher).

## Offene Fragen an den Menschen

1. Klassen-Preise im Planer: Sollen „Adjust All“, Startpreis und Gewinnschwelle die echten Klassen-Verhältnisse der Strecke nutzen statt fester 1,6 / 3 / 5? (W2, O2)
2. Darf ein Preis unter dem Marktpreis mehr Erlös bringen als der Marktpreis (heute bis +5 % in Economy, wenn Sitze frei sind)? (W3)
3. Monatslänge: 4 Wochen (heute) oder 4,35 Wochen? (W6)
4. Zeit: Sollen Preise über die Jahre fest bleiben, während Kosten real steigen und die Nachfrage gebremst wird? Welche Marge soll eine typische Strecke 1960, 1990 und 2020 haben? (W7, O5)
5. Schwierigkeit: Soll sie auf den Preis wirken, auf die Nachfrage, oder nur an einer Stelle? (W10, O6)
6. Planer: Soll die Hauptzahl immer der erwartete Gewinn sein (nicht „volle Maschine“), auch auf Normal und Hard? (W1; Vorschlag ja, nur zur Bestätigung)
7. Umsteiger: Sollen sie einen festen Abschlag auf den echten Marktpreis zahlen (heute 0,9 × Grundpreis ohne SAT und Schwierigkeit)? (W5)
