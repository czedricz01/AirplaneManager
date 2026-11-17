# Bestand: Kosten

Paket 1.4 · Stand 17.11.2026 · Commit a32dfc4

Alle Fundstellen ohne Pfad liegen in `src/lib/financeUtils.ts`.
Planer = `src/components/RoutePlannerView.tsx`. Monat = `src/lib/monthClose.ts`.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).
Beispiele: Preis = Marktpreis, Schwierigkeit Normal, keine Rivalen, 7 Umläufe pro Woche,
Flughäfen mit Verwaltungsstufe 1, Erdnüsse als Bordverpflegung.
Strecken-Kosten gelten **pro Woche**, Flugzeug-Kosten **pro Monat**.

## Überblick

Das Spiel kennt drei Arten von Kosten:

1. **Strecken-Kosten** (je Woche, in `calculateRouteFinancials`): Treibstoff, Besatzung,
   Bodenpersonal, Landegebühren, Gebühren je Fluggast, Bordverpflegung.
2. **Feste Kosten** (je Monat, im Monatsabschluss): Unterhalt der Flughäfen (Slots,
   Abstellplätze, Schalter, Einrichtungen), Unterhalt der Flugzeuge (Versicherung, Wartung),
   Werbung, Ersatzflugzeuge.
3. **Einmalige Ausgaben**: Flugzeugkauf, Slotkauf, Verwaltungsstufe. Sie zählen nicht als
   Kosten im Monatsgewinn, nur in der Kasse.

Rechenweg in einem Bild:

```
Strecke (je Woche)
  Treibstoff  = Liter × Preis je Liter                                     :1247, :1256-1257
     Liter    = 7,5 × Höchstsitze × km/100 / (0,75 + Effizienz/70) × Flüge
     Preis    = Tabelle (Jahr, Monat) × Ereignis × Hard 1,15 × Forschung   :1616-1626; App.tsx:652-655
  Besatzung   = (2 × 100 + 40 × aufrunden(Höchstsitze/50)) $/h × Flugstunden
                × Kostenindex × Lohn-Faktor                                :1259-1269
  Bodenpersonal = Besatzung × 0,3                                          :1272
  Landegebühr = je Abflug an beiden Flughäfen, nach Sitzen und Flughafengröße  :1284-1292
  Fluggast-Gebühren = je Fluggast an beiden Flughäfen (Check-in + Abfertigung)  :1294-1296, :1510-1513
  Verpflegung = je Fluggast (Essen + Extras + Service)                     :1394-1402
  → Monat: × 4                                                            Monat:487-503

Fest (je Monat)
  Flughafen-Unterhalt = Wochenwert × 4                                     :11-135; Monat:539-554
  Flugzeug-Unterhalt  = Listenpreis × (0,6 % + Wartung 3–8 %) / 12         src/lib/fleetCosts.ts:47-56
  → Monatsgewinn = Strecken-Gewinn − Unterhalt − Werbung − Ersatzflüge
                   − Flugzeug-Unterhalt + Einnahmen eigener Flughäfen      Monat:580
```

Kostenindex (`realCostIndex`): 1,2 % pro Jahr ab 1960, also 1960 = 1, 1990 = 1,43,
2020 = 2,05. Er gilt für Löhne und Flughafen-Gebühren, nicht für Treibstoff
(`src/lib/realCosts.ts:19-28`).

## Größen

### Strecken-Kosten (je Woche)

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Flugabschnitte (`flightLegs`) | Σ Fahrplan: Hin- und Rückflug 2, Einweg 1; × geflogener Anteil (Streik, Störung) | `:1252-1253` | Fahrplan, Ausfälle | Treibstoff, Besatzung, Sitze |
| Abflüge (`weeklyFlights`) | Zahl der Fahrplan-Einträge | `:1248` | Fahrplan | Landegebühren |
| Treibstoffpreis je Liter | runden(Preis je Gallone / 3,785; 3 Stellen) | `:1247`; `src/lib/format.ts:87` | Treibstoffpreis | Treibstoff-Kosten |
| Treibstoff in Litern | 7,5 × Höchstsitze × km / 100 / (0,75 + Effizienz / 70) × Flugabschnitte | `:1256` | Höchstsitze (`capacity`), Großkreis-km, Effizienz 10–97 | Treibstoff-Kosten |
| Treibstoff-Kosten | Liter × Preis je Liter | `:1257` | obige | Wochenkosten |
| Flugstunden | Flugdauer (min) × Flugabschnitte / 60 | `:1260-1261` | Flugdauer | Besatzung |
| Flugbegleiter | aufrunden(Höchstsitze / 50) | `:1262` | Höchstsitze | Stundensatz |
| Stundensatz Besatzung | 2 × 100 + Flugbegleiter × 40 (in Dollar von 1960) | `:1263` | obige | Besatzung |
| Lohn-Faktor (`crewCostFactor`) | Lohn % / 100 (80–130 %) × Forschung (bis 0,97) | `src/lib/staff.ts:61-64`; `src/lib/gameState.ts:477-478`, `:493` | Lohn-Einstellung, Forschung | Besatzung |
| Besatzung | Stundensatz × Flugstunden × Lohn-Faktor × Kostenindex | `:1269` | obige | Wochenkosten |
| Bodenpersonal | Besatzung × 0,3 | `:1272` | Besatzung | Wochenkosten (im Bericht mit Besatzung zusammen als „crew“, `:1562`) |
| Größen-Faktor Landegebühr (`landingFeeSizeFactor`) | Höchstsitze / Bezugssitze (180 Regional und Narrowbody, 420 Widebody); Propeller-Regionalflugzeuge (< 700 km/h) × 0,85 | `:1171`, `:1179`, `:1182`, `:1195-1201` | Höchstsitze, Klasse, Geschwindigkeit | Landegebühr |
| Grund-Landegebühr (`baseLandingFee`) | Regional und Narrowbody (2 500 + 100 × Flughafengröße) × 1,1 × Größen-Faktor; Widebody (3 000 + 150 × Größe) × 1,1 × Größen-Faktor; andere Klasse fest 2 200 | `:1208-1217` | Flughafengröße (1–7), Klasse | Landegebühr |
| Nachlass Drehkreuz (`hubFeeFactor`) | Stufe 2: 0,95; Stufe 3: 0,85; sonst 1 | `src/lib/hubOwnership.ts:20-24`; `:1281-1282` | Verwaltungsstufe | Landegebühr, Schalter |
| Landegebühr je Abflug | abrunden(Grund × Drehkreuz × Kostenindex × Forschung) | `:1284-1285` | obige | Landegebühren |
| Landegebühren | je Flughafen: Gebühr × Abflüge × geflogener Anteil; Start- **und** Zielflughafen | `:1291-1292` | obige | Wochenkosten |
| Check-in je Fluggast | 0,5 $ (Stufe ≥ 2: 0,475 $) × Kostenindex × Forschung | `:1294-1295` | Verwaltungsstufe | Fluggast-Gebühren |
| Abfertigung je Fluggast | 3 $ (Größe 1–2), 4 $ (3–4), 5 $ (5 und mehr) × Kostenindex × Forschung | `:1296` | Flughafengröße | Fluggast-Gebühren |
| Fluggast-Gebühren | alle Fluggäste (mit Umsteigern) × (Check-in + Abfertigung) am Start **und** am Ziel | `:1510-1513` | Fluggäste | Wochenkosten |
| Mahlzeiten je Flug | 1 (Zeitklasse 1–5), 2 (6–7), 3 (8) | `:1396` | Zeitklasse (Stufen) | Verpflegung |
| Verpflegung je Fluggast | (Σ Mahlzeiten + Extras + Service) × Forschung (bis 0,96) | `:1394-1402` | Kabinen-Einstellung (Paket 1.1) | Verpflegung |
| Verpflegung | Σ Klassen: je Fluggast × Fluggäste (auch Umsteiger) | `:1478`, `:1505` | obige | Wochenkosten |
| Wochenkosten (`estWeeklyCosts`) | Treibstoff + Besatzung + Boden + Landegebühren + Fluggast-Gebühren + Verpflegung | `:1515-1516` | obige | Gewinn, Gewinnschwellen-Preise (Paket 1.3) |
| Wochengewinn | Wochenerlös − Wochenkosten | `:1533` | Erlös (Paket 1.3) | Monatsgewinn |

### Treibstoffpreis

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Tabellenpreis | `jetFuelPrices["JJJJ-MM"]` in $ je Gallone, 1960-01 bis 2030-12; fehlt der Monat: 1,05 | `src/data/fuelPrices.ts`; `:1617-1618` | Jahr, Monat | Treibstoffpreis |
| Ereignis-Faktor | Produkt der `fuelMultiplier` aller laufenden Ereignisse (z. B. Ölkrise 1973 × 2,0, 1979 × 1,8, Golfkrieg 1990 × 1,5, Pandemie 2020 × 0,7) | `:1620-1622`; `src/lib/eventSystem.ts:326-334`, `:90`, `:113`, `:136`, `:205` | Ereignisse | Treibstoffpreis |
| Hard-Zuschlag | × 1,15 nur auf Hard (Easy kein Nachlass) | `:1624` | Schwierigkeit | Treibstoffpreis (Spieler **und** KI) |
| Preissicherung (Hedge) | Bei gewählter Sicherung gilt der Preis des Monats vor dem Ereignis | `src/App.tsx:639-650` | Ereignis-Wahl | Treibstoffpreis Spieler |
| Forschung Treibstoff | Preis × `fuelFactor` (bis 0,4) | `src/App.tsx:652-655`; `src/lib/research.ts:253` | Forschung | Treibstoffpreis Spieler (auch Anzeige oben) |

### Flughafen-Unterhalt (je Woche, im Monat × 4)

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Faktor `idx` | Kostenindex × Forschung (`getFeeFactor`, globaler Wert) | `:21`; `src/lib/economyContext.ts:28-36`; `src/App.tsx:266` | Jahr, Forschung | alle Unterhaltswerte |
| Slot | Regional 125 · Narrowbody 250 · Widebody 250 × idx | `:25-29`, `:138` | Zahl der Slots | Unterhalt |
| Abstellplatz (Stand) | Regional 150 · Narrowbody 300 · Widebody 600 × idx; **0 ab Verwaltungsstufe 2** | `:31-35`, `:102-106` | Zahl, Stufe | Unterhalt |
| Schalter voll genutzt | normal 2 500 · Selbst-Check-in 1 500 × Drehkreuz-Nachlass × idx | `:38-41` | Stufe | Schalter-Kosten |
| Schalter-Auslastung | Sitze aller Abflüge der Woche / (normal × 5 000 + selbst × 10 000) | `:56-60`, `:141`, `:153-156`, `:162-178` | Fahrplan, Sitze (Bestuhlung) | Schalter-Kosten, SAT (Paket 1.1) |
| Schalter-Kosten | voll × (0,2 + 0,8 × Auslastung bis 1) | `:61-64`, `:144-150` | obige | Unterhalt |
| Einrichtungen | Hangar 10 000 · VIP-Lounge 12 500 · Küche 10 000 × idx | `:111-113` | gebaute Einrichtungen | Unterhalt |
| Monat Flughäfen | (Slots + Stände + Einrichtungen) × 4 und Schalter × 4 | Monat:539-554 | obige | Monatsgewinn |

### Flugzeug-Unterhalt (je Monat)

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Alter | (Monat jetzt − Kaufmonat) / 12; ohne Kaufmonat 0 | `src/lib/fleetCosts.ts:31-35` | Kaufdatum | Wartung, Wiederverkauf, Beliebtheit |
| Wartungssatz | 3 % (neu) bis 8 % (ab 25 Jahren) des Listenpreises pro Jahr, gerade Linie | `src/lib/fleetCosts.ts:16-18`, `:38-41` | Alter | Unterhalt |
| Flotten-Faktor (`fleetCommonality`) | 1 + Zuschlag (3 % je Familie über 3, höchstens 30 %) − Nachlass je Familiengröße (ab 3: 4 %, 6: 8 %, 12: 12 %, 25: 15 %) | `src/lib/fleetCosts.ts:67-121` | Flottenmischung | Wartung |
| Forschung Wartung | × `maintenanceFactor` (bis 0,96) | Monat:558; `src/lib/research.ts:276` | Forschung | Wartung |
| Unterhalt je Flugzeug | Listenpreis × (0,6 % + Wartungssatz × Faktoren) / 12; geparkt × 0,5 | `src/lib/fleetCosts.ts:14`, `:20`, `:47-56` | obige, fliegt ja/nein | Monatsgewinn |
| Flotten-Unterhalt | Σ Flugzeuge; „fliegt“ = auf einer Strecke eingesetzt | `src/lib/fleetCosts.ts:124-145`; Monat:517, :558 | obige | Monatsgewinn |

### Einmalige Ausgaben und Einnahmen

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Slot kaufen | Regional 25 000 · Narrowbody 50 000 · Widebody 100 000 × Meilenstein- und Forschungs-Faktor (0,5–1); **ohne** Kostenindex | `:1715-1719`; `src/App.tsx:265` | Slottyp | Kasse |
| Slot verkaufen | 50 % des Kaufpreises zurück | `:1806-1808` | – | Kasse |
| Verwaltungsstufe | Flughafengröße × 30 000 (Stufe 1) · 750 000 (Stufe 2) · 25 000 000 (Stufe 3); **ohne** Kostenindex | `:1656-1660` | Größe, Stufe | Kasse |
| Einnahme eigener Flughafen (Stufe 3) | KI-Landungen je Woche × 4 × (2 500 + 100 × Größe) × 1,1 × 0,5; **ohne** Kostenindex, ohne Flugzeuggröße | `src/lib/hubOwnership.ts:30-35`, `:59-73`; Monat:561 | KI-Strecken | Monatsgewinn |
| Monatsgewinn | Strecken-Gewinn − Flughafen-Unterhalt − Werbung − Ersatzflüge − Flugzeug-Unterhalt + Flughafen-Einnahmen | Monat:580 | alles oben | Kasse, Gewinnserie, Moral (`src/lib/staff.ts:72-75`), Ziele |

Nicht Teil dieses Pakets, nur genannt: Werbung und Vielflieger (`marketing.ts`, Paket 1.2),
Ersatzflugzeuge und Vogelschlag (`disruptions.ts`, Paket 1.7). `src/lib/malus.ts` enthält
keine Kostenformel; es begrenzt nur, wie oft Pech-Ereignisse kommen (höchstens jeder zweite Monat).

## Konstanten

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| 7,5 / 0,75 / 70 | Treibstoff-Formel (Liter je Sitz und 100 km bei Effizienz 0: 10; bei 50: 5,1; bei 97: 3,5) | `:1256` |
| 3,78541 | Liter je Gallone | `src/lib/format.ts:87` |
| 1,05 $ | Treibstoff 1960 und Ersatzwert ab 2031 | `src/data/fuelPrices.ts:2`; `:1618` |
| 1,15 | Treibstoff-Zuschlag Hard | `:1624` |
| 100 $/h · 40 $/h · 50 | Pilot (× 2), Flugbegleiter, Sitze je Flugbegleiter | `:1262-1263` |
| 0,3 | Bodenpersonal als Anteil der Besatzung | `:1272` |
| 2 500 + 100 × Größe · 3 000 + 150 × Größe · × 1,1 | Grund-Landegebühr Narrowbody · Widebody | `:1213-1214` |
| 180 / 180 / 420 | Bezugssitze der Landegebühr | `:1171` |
| 0,85 · 700 km/h | Nachlass Propeller · Grenze Propeller | `:1179`, `:1182` |
| 2 200 | Landegebühr unbekannter Klasse | `:1215` |
| 0,95 / 0,85 | Drehkreuz-Nachlass Stufe 2 / 3 (Landung, Schalter) | `src/lib/hubOwnership.ts:21-22` |
| 0,5 / 0,475 | Check-in je Fluggast normal / ab Stufe 2 | `:1294-1295` |
| 3 / 4 / 5 | Abfertigung je Fluggast nach Flughafengröße | `:1296` |
| 125 / 250 / 250 | Slot-Unterhalt je Woche | `:26-28`, `:138` |
| 150 / 300 / 600 | Stand-Unterhalt je Woche | `:32-34` |
| 2 500 / 1 500 · 5 000 / 10 000 · 0,2 | Schalter: Kosten · Fluggäste je Woche · fester Anteil | `:39-40`, `:141`, `:144` |
| 10 000 / 12 500 / 10 000 | Hangar / VIP-Lounge / Küche je Woche | `:111-113` |
| 0,006 | Versicherung je Jahr (Anteil Listenpreis) | `src/lib/fleetCosts.ts:14` |
| 0,03 → 0,08 · 25 Jahre | Wartung je Jahr neu → alt | `src/lib/fleetCosts.ts:16-18` |
| 0,5 | geparktes Flugzeug: Anteil der Kosten | `src/lib/fleetCosts.ts:20` |
| 3 / 0,03 / 0,30 · 4–15 % | Flotten-Mischung: freie Familien, Zuschlag, Höchstzuschlag · Nachlässe | `src/lib/fleetCosts.ts:67-76` |
| 0,012 | reale Kostensteigerung je Jahr | `src/lib/realCosts.ts:19` |
| 80–130 % | Lohn-Spanne | `src/lib/staff.ts:31-32` |
| 0,4 | kleinster Forschungs-Faktor | `src/lib/research.ts:253`; `src/lib/economyContext.ts:31` |
| 25 000 / 50 000 / 100 000 · 0,5 | Slot-Kaufpreis · Rückgabe beim Verkauf | `:1716`, `:1808` |
| 30 000 / 750 000 / 25 000 000 | Verwaltungsstufe je Flughafengröße | `:1656` |
| 0,5 | Anteil der KI-Landegebühren für den Eigentümer | `src/lib/hubOwnership.ts:30` |
| 4 | Wochen je Monat | Monat:487-503, :547, :550 |

## Beispielwerte (nachgerechnet)

Strecke je Woche, Preis = Marktpreis, alle Maschinen voll (Nachfrage reicht):

| Fall | Erlös | Kosten | Gewinn | Treibstoff | Landung | Fluggast-Geb. | Besatzung + Boden |
|---|---|---|---|---|---|---|---|
| Caravelle III, FRA–CDG 1962, 14×, 80 Sitze | 145 600 | 101 288 | **+44 312** | 22 % | 44 % | 25 % | 8 % |
| 707-320, FRA–JFK 1962, 150 Y + 20 J | 470 400 | 518 764 | **−48 364** | 75 % | 10 % | 5 % | 9 % |
| A320ceo, FRA–MAD 1990, 150 Y + 12 J | 275 688 | 175 371 | **+100 317** | 28 % | 41 % | 20 % | 10 % |
| A320ceo, gleich, Hard | 241 752 | 182 699 | **+59 053** | 31 % | 39 % | 20 % | 10 % |
| A320ceo, FRA–MAD 2020 | 275 688 | 289 799 | **−14 111** | 38 % | 35 % | 18 % | 9 % |
| A320neo, FRA–MAD 2020, 168 Y + 12 J | 309 960 | 288 881 | **+21 079** | 34 % | 37 % | 20 % | 9 % |
| A330-300, FRA–JFK 1995, 250 Y + 30 J | 1 010 380 | 765 134 | **+245 246** | 63 % | 13 % | 9 % | 15 % |
| A330-300, gleich, 2005 | 1 005 900 | 1 552 986 | **−547 086** | – | – | – | – |
| A330-300, gleich, 2020 | 988 960 | 1 508 614 | **−519 654** | 75 % | 9 % | 6 % | 10 % |
| A350-900, FRA–JFK 2020, 280 Y + 40 J | 1 204 322 | 1 332 422 | **−128 100** | 71 % | 10 % | 7 % | 11 % |
| ATR 72-200, FRA–CDG 1990, 14×, 68 Sitze | 121 856 | 109 716 | **+12 140** | 11 % | 47 % | 27 % | 13 % |

Weitere Werte:

- Treibstoff je Sitz und 100 km: 707 7,9 l; A320ceo und A330 4,2 l; A320neo 3,6 l; A350 3,5 l.
- Landegebühr je Abflug (Größe-7-Flughafen): A320ceo 1990 5 202 $ (28 $ je Sitz), 2020 7 440 $;
  A330 1995 7 085 $ (16 $ je Sitz). Widebody zahlt je Sitz gut die Hälfte eines Narrowbody.
- Fluggast-Gebühren je Fluggast und Flug (zwei Größe-7-Flughäfen): 1962 11,27 $, 1990 15,73 $, 2020 22,50 $.
- Bester Preis (0,8- bis 1,5-facher Marktpreis, Stufen 0,1): A350 FRA–JFK Juli 2019, 7 Umläufe:
  −57 000 $ je Woche; 3 Umläufe (Nachfrage 3,2-mal Sitze): +16 000 $ je Woche, also 64 000 $ im Monat
  gegen 420 000 $ Flugzeug-Unterhalt. 707 FRA–JFK 1962, 3 Umläufe (Nachfrage 3,5-mal Sitze): −13 000 $.
  Bester Preis ist jeweils der Marktpreis.
- Flugzeug-Unterhalt im ersten Jahr: A320ceo 120 000 $/Monat, A320neo 144 000 $, A330-300 276 000 $,
  A350-900 420 000 $, 707-320 55 500 $.
- Treibstoff je Gallone mit Ereignissen (Januar, Normal): 1960 1,05 · 1970 1,55 · 1974 4,20 · 1980 2,92 ·
  1990 1,20 · 2000 1,72 · 2020 2,66 · 2030 2,39 · **2031 1,05** · 2040 1,05.

## Widersprüche und Auffälligkeiten

### W1 · Langstrecke verliert fast immer, egal zu welchem Preis
- Befund: Auf Langstrecke ist Treibstoff 63–75 % der Kosten. Der Marktpreis je km ist dort am
  niedrigsten (0,05 $/km, Paket 1.3). Je eingebautem Sitz und km: 707 (1962) Treibstoff 2,6 ct,
  Erlös 3,2 ct; A350 (2020) Treibstoff 3,4 ct, Erlös 4,3 ct. Für alles andere bleibt fast nichts.
- Fundstelle: `:1256-1257`; `:726` (Grundpreis); `src/data/fuelPrices.ts`
- Folge im Spiel: FRA–JFK mit voller Maschine beim Marktpreis: 1962 −48 000 $, 1995 +245 000 $,
  2005 −547 000 $, 2020 −128 000 bis −520 000 $ je Woche. Ein anderer Preis hilft nicht; nur sehr
  knappe Sitze (3 Umläufe bei dreifacher Nachfrage) bringen 2019 einen kleinen Strecken-Gewinn, der
  den Flugzeug-Unterhalt nicht deckt. Ob Langstrecke Gewinn bringt, entscheidet vor allem der
  Treibstoffpreis des Jahres.
- Vorschlag: Im Balance-Skript (3.9) Marge je Streckenlänge und Jahrzehnt festlegen; dann
  Treibstoff-Formel, Grundpreis-Kurve oder Langstrecken-Zuschlag darauf einstellen.
- Braucht Entscheidung: ja

### W2 · 2020 lohnt sich auch Kurzstrecke kaum noch
- Befund: Kosten steigen über die Jahre (Löhne und Gebühren × 2,05 bis 2020, Treibstoff × 2,5
  von 1960 bis 2020), Preise bleiben gleich (Paket 1.3 W7).
- Fundstelle: `src/lib/realCosts.ts:19-28`; `src/data/fuelPrices.ts`; `:726`
- Folge im Spiel: A320ceo FRA–MAD voll beim Marktpreis: 1990 +100 000 $, 2020 −14 000 $ je Woche.
  Selbst die neue A320neo bringt 2020 nur +21 000 $ je Woche (84 000 $ im Monat) und kostet
  144 000 $ Unterhalt im Monat. Bei halber Auslastung (3 Umläufe) bester Preis +20 000 $ je Woche.
- Vorschlag: Zusammen mit 1.3 W7 und O5 entscheiden; drei Zeitregeln (Preis fest, Kosten real
  steigend, Nachfragebremse) gemeinsam festlegen.
- Braucht Entscheidung: ja (= 1.3 Frage 4, O5)

### W3 · Ab 2031 fällt der Treibstoff auf den Preis von 1960
- Befund: Die Tabelle endet 2030-12. Fehlt ein Monat, gilt 1,05 $. Ein Spielende gibt es nicht;
  der Kostenindex läuft bis 2100.
- Fundstelle: `:1618`; `src/data/fuelPrices.ts` (letzter Eintrag „2030-12“); `src/lib/realCosts.ts:22`
- Folge im Spiel: Januar 2031 sinkt der Treibstoff von 2,39 $ auf 1,05 $ (−56 %) über Nacht.
  A320neo FRA–MAD: Gewinn je Woche 2020 +21 000 $, 2035 +44 000 $; die Langstrecke wird plötzlich
  sehr gewinnbringend.
- Vorschlag: Ersatzwert = letzter Tabellenwert (oder festgelegter Verlauf danach).
- Braucht Entscheidung: nein

### W4 · Treibstoff-Krisen möglicherweise doppelt
- Befund: Die Tabelle ist ein geglätteter Verlauf, der die 1970er-Jahre schon enthält
  (1972: 1,72 → 1975: 2,18). Darauf kommen die Ereignisse (Ölkrise 1973 × 2,0, 1979 × 1,8).
  Die Spalte heißt „Preis_Real_Heute_USD_Gallon“.
- Fundstelle: `src/data/fuelPrices.ts`; `src/data/raw_fuel.csv:1`; `src/lib/eventSystem.ts:70-90`, `:93-113`; `:1620-1622`
- Folge im Spiel: Januar 1974: 4,20 $ je Gallone, das Vierfache von 1960. Die Langstrecke (W1)
  wird in dieser Zeit sehr teuer.
- Vorschlag: Festlegen, ob die Tabelle Grundverlauf ohne Krisen ist (dann glätten) oder echte
  Preise mit Krisen (dann Ereignis-Faktor 1).
- Braucht Entscheidung: ja (welche Quelle für Treibstoff)

### W5 · Gebühren je Fluggast werden an beiden Flughäfen fällig
- Befund: Jeder Fluggast eines Flugabschnitts zahlt Check-in und Abfertigung am Start **und**
  am Ziel. Ein Fluggast checkt aber nur am Start ein. Umsteiger zahlen das auf beiden Teilstrecken,
  also am Umsteige-Flughafen doppelt.
- Fundstelle: `:1510-1513`
- Folge im Spiel: 18–27 % der Kurzstrecken-Kosten (A320 FRA–MAD 1990: 15,73 $ je Fluggast statt
  7,87 $). Die Flughafen-Ansicht zeigt nur den Satz für einen Flughafen (`src/components/AirportDetailView.tsx:285`).
- Vorschlag: Festlegen, was eine Fluggast-Gebühr ist (je Abflug, je Ankunft oder beides) und die
  Höhe neu einstellen.
- Braucht Entscheidung: ja

### W6 · Drehkreuz-Nachlass beim Check-in nicht gleich
- Befund: Landegebühr und Schalter nutzen `hubFeeFactor` (Stufe 2: −5 %, Stufe 3: −15 %).
  Check-in je Fluggast ist fest −5 % ab Stufe 2, auch bei Stufe 3. Abfertigung hat keinen Nachlass.
- Fundstelle: `:1281-1285`, `:1294-1296`; `src/lib/hubOwnership.ts:5-6`, `:20-24`
- Folge im Spiel: Der Text zu Stufe 3 verspricht 15 % weniger Gebühren; ein Teil bekommt nur 5 %.
- Vorschlag: Ein Nachlass-Faktor für alle Flughafen-Gebühren.
- Braucht Entscheidung: nein

### W7 · Abstellplätze kosten ab Stufe 2 nichts mehr
- Befund: Ab Verwaltungsstufe 2 bekommt jeder Slot automatisch einen Abstellplatz, und alle
  Abstellplätze kosten keinen Unterhalt mehr. Auf Stufe 1 kosten sie 150–600 $ je Woche.
- Fundstelle: `:19`, `:102-106`; `:1684-1692`
- Folge im Spiel: Ein Drehkreuz mit 20 Widebody-Slots spart 12 000 $ je Woche (× Kostenindex)
  durch den Stufenaufstieg. Ob gewollt, sagt kein Kommentar.
- Vorschlag: Festlegen, ob Stufe 2 Abstellplätze „schenkt“ oder nur automatisch kauft.
- Braucht Entscheidung: ja

### W8 · Einmalpreise steigen nicht mit dem Kostenindex
- Befund: Slot-Unterhalt, Gebühren und Löhne wachsen mit dem Kostenindex. Slot-Kauf
  (25 000–100 000 $), Verwaltungsstufe (bis 25 Mio. × Größe) und die Einnahme aus KI-Landungen
  nicht. Die Einnahme nutzt außerdem eine eigene Landegebühr ohne Flugzeuggröße.
- Fundstelle: `:1715-1719`, `:1656-1660`; `src/lib/hubOwnership.ts:33-35`, `:69`
- Folge im Spiel: 2020 zahlt der Spieler je A320-Landung an einem Größe-7-Flughafen 7 440 $;
  ein Rivale „zahlt“ dem Eigentümer dort 1 760 $ (50 % von 3 520 $), egal wie groß sein Flugzeug ist.
  Ein Slot kostet 2020 so viel wie 1960, sein Unterhalt das Doppelte.
- Vorschlag: Eine Regel, welche Preise mit dem Index wachsen; KI-Landegebühr mit derselben
  Funktion wie beim Spieler.
- Braucht Entscheidung: ja (welche Preise wachsen)

### W9 · Hard verteuert auch den Treibstoff der KI
- Befund: `getJetFuelPrice` schlägt auf Hard 15 % auf. Die KI ruft es mit ihrer eigenen
  Schwierigkeit auf. Eine Hard-KI zahlt also mehr für Treibstoff als eine Normal-KI.
- Fundstelle: `:1624`; `src/lib/aiSimulation.ts:776`, `:793`
- Folge im Spiel: Hard-Rivalen sind wirtschaftlich schwächer, nicht stärker (wie 1.2 W10).
  Für den Spieler ist Hard eine dritte Schwierigkeits-Stelle neben Preis und Nachfrage.
- Vorschlag: In 2.2 festlegen (= O6). Treibstoffpreis der KI ohne Spieler-Schwierigkeit.
- Braucht Entscheidung: ja (= O6)

### W10 · Kosten folgen den Höchstsitzen, nicht der Bestuhlung
- Befund: Treibstoff, Zahl der Flugbegleiter und Landegebühr rechnen mit `capacity` (Höchstzahl
  laut Datenblatt). Verkauft werden die eingebauten Sitze (`config`). Schalter-Auslastung nutzt
  dagegen die eingebauten Sitze.
- Fundstelle: `:1256`, `:1262`, `:1285`; `:174`; `src/lib/fleet.ts:58-70`
- Folge im Spiel: A350 mit 320 statt 440 Sitzen: Treibstoff je verkauftem Sitz 37 % höher.
  Für Treibstoff und Landegebühr ist das echt (Gewicht des Flugzeugs). Für Flugbegleiter nicht:
  9 statt 7, und eine First-Kabine braucht im Spiel nicht mehr Personal als Economy.
- Vorschlag: Treibstoff und Landung nach Flugzeug lassen; Flugbegleiter nach Kabinen.
- Braucht Entscheidung: nein

### W11 · Bodenpersonal hängt an den Flugstunden
- Befund: Bodenpersonal = 30 % der Besatzungskosten. Es wächst mit Flugstunden, nicht mit
  Fluggästen oder Flughäfen. Der Kommentar nennt es selbst „Just a flat ground staff assumption“.
- Fundstelle: `:1271-1272`
- Folge im Spiel: Eine Langstrecke mit 2 Flügen hat mehr Bodenpersonal als eine Kurzstrecke mit
  20 Flügen. Gleichzeitig gibt es schon Schalter-Kosten und Abfertigung je Fluggast; die Rollen
  überlappen.
- Vorschlag: Bodenpersonal entweder streichen (in Abfertigung und Schaltern enthalten) oder je
  Abflug rechnen.
- Braucht Entscheidung: nein

### W12 · Einweg-Flüge zahlen Landegebühr an beiden Flughäfen
- Befund: Landegebühren = Gebühr × Fahrplan-Einträge, am Start und am Ziel. Ein Einweg-Eintrag
  landet aber nur einmal (`flightLegs` zählt ihn richtig als 1).
- Fundstelle: `:1248`, `:1253`, `:1291-1292`
- Folge im Spiel: Ein Einweg-Flug zahlt die doppelte Landegebühr. Selten, weil Einweg-Einträge selten sind.
- Vorschlag: Landungen aus den Flugabschnitten zählen: je Abschnitt eine Landung am Ziel.
- Braucht Entscheidung: nein

### W13 · Kauf von Flugzeugen zählt nicht als Kosten
- Befund: Der Monatsgewinn enthält Unterhalt (Versicherung, Wartung), aber keinen Wertverlust und
  keine Finanzierung. Kauf und Verkauf laufen nur über die Kasse (`spend`). Kredite und Leasing gibt
  es nicht.
- Fundstelle: Monat:422-425, :580; `src/lib/fleetCosts.ts:47-56`; `getAircraftResaleValue` `:1633-1647`
- Folge im Spiel: Gewinnserie, Moral und Jahresziele sehen einen Monat mit Kauf eines
  140-Mio.-Flugzeugs als normalen Gewinnmonat. Ein Flugzeug verliert 2 % Wert je Jahr
  (`src/lib/fleetCosts.ts:23`), das erscheint nie als Kosten.
- Vorschlag: Festlegen, ob „Gewinn“ einen Wertverlust enthält (dann Monatsabschreibung als Kosten).
- Braucht Entscheidung: ja

### W14 · Mahlzeiten-Zahl springt noch in Stufen
- Befund: Die Zahl der Mahlzeiten folgt der Zeitklasse (Stufen bei 360 und 720 Minuten).
  Nachfrage und Preise nutzen schon den stufenlosen Zeitindex.
- Fundstelle: `:1396`; `:250-264`
- Folge im Spiel: Eine Minute mehr Flugzeit verdoppelt die Verpflegungskosten. Kleine Summen
  (Verpflegung 0–1 % in den Beispielen), aber derselbe Fehler, den `getFlightTimeIndex` behoben hat.
- Vorschlag: Gemeinsam mit dem Mehrgang-Menü (1.1, Frage 1) festlegen.
- Braucht Entscheidung: nein

### W15 · Jahreswerte uneinheitlich
- Befund: Strecken-Kosten und Flughafen-Unterhalt sind Wochenwerte × 4 (48 Wochen im Jahr).
  Flugzeug-Unterhalt ist Jahreswert / 12 (volles Jahr).
- Fundstelle: Monat:488, :547, :550; `src/lib/fleetCosts.ts:55`
- Folge im Spiel: Strecken-Gewinn und Flughafen-Unterhalt sind im Jahr 8 % zu klein gegenüber dem
  Flugzeug-Unterhalt (siehe 1.3 W6).
- Vorschlag: Eine Monatslänge (= 1.3 Frage 3).
- Braucht Entscheidung: ja (= 1.3 Frage 3)

## Doppelte Rechnungen

- Forschungs-Faktor Gebühren auf zwei Wegen: über `mods.feeFactor` in der Strecke (`:1267`,
  `src/lib/gameState.ts:494`) und über den globalen Wert `getFeeFactor()` im Unterhalt (`:21`,
  `src/lib/economyContext.ts:28-36`, gesetzt in `src/App.tsx:266`). Gleicher Wert, zwei Quellen.
- Fluggast-Gebühr und Landegebühr in der Flughafen-Ansicht selbst gerechnet:
  `src/components/AirportDetailView.tsx:283-287` (fester Nachlass 0,95 auch auf Stufe 3, ohne
  Forschung, nur ein Flughafen; vgl. W5, W6).
- KI-Landegebühr als eigene Formel: `src/lib/hubOwnership.ts:33-35` (Kopie von `:1213` ohne
  Größe, Index, Nachlass; W8).
- Stundensatz der Besatzung im Planer als Text nachgebaut: Planer `:3476`
  (`2 × 100 + aufrunden(Sitze/50) × 40`, ohne Kostenindex und Lohn).
- Sitze der Abflüge zweimal gezählt: `weeklyDeskPassengers` (`:162-178`, eingebaute Sitze, nur
  Abflüge) und `passengerData` in `getAirportUpkeep` (`:66-87`, Höchstsitze, Ab- und Ankünfte;
  nur für die Anzeige „Weekly Seats“, `src/components/AirportDetailView.tsx:252`).
- Treibstoffpreis: Planer ruft `getJetFuelPrice` selbst auf, nimmt aber den Preis aus App, wenn
  vorhanden (Planer `:873-877`). Stimmt, solange App den Preis übergibt.

## Nebenbefund für Paket 1.5

- Der Ruf rechnet die Auslastung als Fluggäste / **gewichtete** Sitze (1 / 1,6 / 3 / 5).
  Eine Maschine mit Business-Kabine wirkt damit leerer, als sie ist.
  Fundstelle: Monat:508-515, :600; `:1518-1523`.

## Bezug zu bisherigen offenen Fragen

- O5 und 1.3 W7 (Zeitregeln): durch W1, W2 verschärft; mit Zahlen belegt.
- O6 (Schwierigkeit): W9 nennt eine weitere Stelle (Treibstoff +15 % auf Hard).
- 1.3 W6 (Monatslänge): W15 zeigt, dass auch Kosten betroffen sind.
- 1.1 Frage 1 (Mehrgang-Menü): W14.

## Offene Fragen an den Menschen

1. Welche Marge soll eine Strecke haben, je Länge (kurz, mittel, lang) und Jahrzehnt? Heute
   verliert Langstrecke fast immer, und 2020 lohnt sich kaum eine Strecke. (W1, W2, O5)
2. Treibstoff: Ist die Tabelle der Grundverlauf ohne Krisen (dann Krisen als Ereignis) oder der
   echte Preis mit Krisen (dann keine Ereignis-Faktoren)? Und was gilt nach 2030? (W3, W4)
3. Fluggast-Gebühren: Nur am Abflug, nur an der Ankunft oder an beiden? (W5)
4. Soll Verwaltungsstufe 2 die Abstellplätze kostenlos machen? (W7)
5. Welche Preise wachsen mit dem Kostenindex: auch Slot-Kauf und Verwaltungsstufe? (W8)
6. Soll der Monatsgewinn einen Wertverlust der Flugzeuge enthalten (Abschreibung)? (W13)
7. Schwierigkeit beim Treibstoff: behalten (+15 % auf Hard) oder in die eine Schwierigkeits-Stelle
   aus O6 aufnehmen? (W9)
