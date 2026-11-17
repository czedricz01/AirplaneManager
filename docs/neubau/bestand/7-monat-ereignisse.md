# Bestand: Monatsabschluss, Ereignisse, Flottenmarkt

Paket 1.7 · Stand 17.11.2026 · Commit bfc2dc6

Monat = `src/lib/monthClose.ts`. Ereignisse = `src/lib/eventSystem.ts`. Störungen =
`src/lib/disruptions.ts`. Andere Dateien mit Pfad.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).
Was frühere Pakete schon beschreiben (Ruf, Rang, Ziele, Personal, KI-Zug, Kosten), steht hier
nur als Schritt im Ablauf, mit Verweis.

## Überblick

Der Monatsabschluss (`closeMonth`) ist der Hauptschritt des Spiels. Er rechnet den Monat
ab (Strecken × 4 Wochen, dazu Flughafen-, Flotten-, Werbe- und Charterkosten), schreibt den
Bericht, lässt die KI ziehen, würfelt Ereignisse, Störungen und Vogelschläge für den nächsten
Monat, liefert bestellte Flugzeuge aus, nutzt die Flotte ab und rechnet die Vorhersage für den
nächsten Monat. Er ändert den Spielstand nicht selbst, sondern gibt eine Liste von Befehlen
zurück, die `App` nacheinander ausführt (Monat:375-379).

Rechenweg in einem Bild (Monat X wird abgeschlossen, X+1 beginnt):

```
1  Monat X abrechnen                                                    Monat:442-580
   Strecken      Netz einmal rechnen, Erlös/Kosten/Gewinn je Woche × 4   :463, :487-489
   Flughäfen     Slots + Abstellplätze + Einrichtungen + Schalter × 4    :537-553
   Flotte        Versicherung + Wartung je Monat (1/12 Jahr)              :558
   Eigene Flughäfen  Einnahme aus KI-Landungen                             :561
   Werbung, Vielflieger                                                   :566
   Charter       90 % des geretteten Erlöses                              :573-579
   Monatsergebnis = Strecken − Flughäfen − Werbung − Charter − Flotte + Einnahme  :580
2  Ruf, Meilensteine, Rang (Paket 1.5)                                   :591-694
3  Pech-Deckel für X+1 (malus.ts), Personal und Streik (Paket 1.4/1.5)    :701-751
4  Bericht X schreiben; Kasse += Monatsergebnis; Einmal-Liste leeren     :773-823
5  KI-Zug (Paket 1.6); fehlt eine KI: 15 % neue                           :826-863
6  Januar: Vorschau neuer Flugzeugtypen                                    :875-912
7  Zufallsereignis: 5 % je Monat, Start X+1                                :916-939
8  Störungen für X+1 würfeln (nur wenn Pech-Deckel offen)                  :945-969
9  Vogelschläge für X+1: sofort bezahlt                                    :974-993
10 Dezember: Jahresziel (Paket 1.5); alle 10 Jahre Jubiläum                :999-1119
11 Forschung, Auslieferung der Bestellungen (Rest bezahlen)                :1122-1201
12 Ruf und Karriere speichern; Ereignis-Start/-Ende melden                :1205-1230
13 Preise/Boni auf die Kasse; Bericht ergänzen, 120 Monate behalten       :1240-1263
14 Chronik, Szenario, Zeitung, abgelaufene Kampagnen, Postfach            :1265-1424
15 Datum + 1; Autosave; Vorhersage X+1 auf jede Strecke                   :1427-1485
   große Störungen (≥ 25 %) als Frage: Charter oder streichen            :1468-1480
16 Flotte: Verschleiß, Alterung der Beliebtheit; neue Flugzeuge dazu      :1495-1550
```

## Größen

### Monatsabrechnung und Bericht

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Strecken-Erlös, -Kosten, -Gewinn | Wochenwert aus dem Netz × 4 | Monat:463, :487-489 | alles aus 1.1–1.4 | Monatsergebnis, Bericht |
| Kosten-Aufteilung | Treibstoff, Verpflegung, Crew, Infrastruktur, Lande- und Fluggast-Gebühren je Woche × 4 | Monat:495-505 | Strecken | Bericht |
| Flughafen-Unterhalt | (Slots + Abstellplätze + Einrichtungen + Schalter) je Woche × 4 | Monat:537-553; `src/lib/financeUtils.ts:11` | Verwaltung, Jahr | Monatsergebnis |
| Flotten-Unterhalt | `fleetOwnershipCost`: Jahreswert / 12; abgestellte zur Hälfte | Monat:558; `src/lib/fleetCosts.ts:55` | Alter, Listenpreis | Monatsergebnis |
| Einnahme eigene Flughäfen | `ownerIncome` aus KI-Landungen (Paket 1.4) | Monat:561 | KI-Strecken | Monatsergebnis |
| Werbung, Vielflieger | `marketingMonthCost` (Paket 1.5) | Monat:566 | Kampagnen, Fluggäste | Monatsergebnis |
| Charterkosten | Summe der Charter-Gebühren (unten) | Monat:573-579 | Störungen | Monatsergebnis |
| Monatsergebnis | Strecken − Flughäfen − Werbung − Charter − Flotte + Einnahme | Monat:580 | alles oben | Kasse, Gewinnserie, Bericht |
| Einmal-Ausgaben (`capex`) | Summe der Einmal-Posten des Monats (Käufe, Verkäufe negativ, Checks, Forschung …) | Monat:773; `src/App.tsx:1701-1705` | Spieler-Handlungen | Bericht |
| Kassen-Änderung | Monatsergebnis − Einmal-Ausgaben (+ Preise/Boni) | Monat:786, :1249 | oben | Bericht |
| Kasse danach (Bericht) | Kasse + Monatsergebnis (+ Preise/Boni) | Monat:787, :1250 | oben | Bericht, Chronik, Szenario |
| Kasse (echt) | += Monatsergebnis; −= Vogelschläge; −= Auslieferungen; += Preise/Boni | Monat:822, :982, :1199, :1244 | oben | alles |
| Bericht-Verlauf | letzte 120 Monate | Monat:1263 | – | Diagramme, Jahresziel |
| Gewinnserie | Ergebnis < 0 → 0; mit Strecken +1; ohne Strecken unverändert | Monat:611 | Monatsergebnis | Meilensteine, Personal |
| Rang im Ticker | 1 + Zahl der KI mit mehr Kasse | Monat:1393 | KI-Kasse | Zeitung |

Der Spieler hat keine Kredite, keine Zinsen und im freien Spiel keine Pleite: Die Kasse darf
ohne Folge negativ werden (W6). Nur Szenarien kennen ein Verlieren (`src/data/scenarios.ts:112`).

### Weltereignisse

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Geschichtliche Ereignisse, weltweit | 6 feste: Ölkrise 1973 (Nachfrage 0,9, Treibstoff 2,0, 18 Monate), Energiekrise 1979 (0,85/1,8/24), Golfkrieg 1990 (0,95/1,5/12), Luftfahrtkrise 2001 (0,65/1/12), Finanzkrise 2008 (0,75/1,2/24), Pandemie 2020 (0,20/0,7/24) | Ereignisse:68-206 | Datum | Nachfrage, Treibstoff |
| Geschichtliche Ereignisse, regional | 11 feste (Streiks, Olympiaden, SARS, Aschewolke …), Nachfrage 0,60–1,15, 2–36 Monate, Treibstoff 1 | Ereignisse:209-307 | Datum | Nachfrage in der Region |
| Zufallsereignis | 5 % je Monat (im Mittel 0,6 je Jahr); Vorlage gleich verteilt aus 11; Dauer, Nachfrage, Treibstoff gleich verteilt im Bereich der Vorlage; regionale Vorlage: eine von 6 Regionen | Monat:916-939, :206-287 | Zufall, Pech-Deckel | Nachfrage, Treibstoff |
| Pech-Ereignis (`isMalusEvent`) | Nachfrage < 1 oder Treibstoff > Nachfrage; 6 der 11 Vorlagen | `src/lib/malus.ts:44-46` | Vorlage | Pech-Deckel |
| Pech-Deckel | Monat gesperrt, solange ein Zufalls-Pech-Ereignis läuft oder nachwirkt (Dauer × 2), und nach einem Monat mit Störung oder Streik | `src/lib/malus.ts:75-87` | Zufallsereignisse, Störungen, Streik | Zufallsereignis, Störungen, Streik |
| Weltweiter Faktor | Produkt der Nachfrage-Faktoren aller laufenden Ereignisse ohne Region; Treibstoff-Faktor aller Ereignisse | Ereignisse:326-335 | laufende Ereignisse | Nachfrage (1.2), Treibstoff (1.4), KI-Krise (1.6) |
| Regionaler Faktor | je Ereignis Mittel beider Strecken-Enden (betroffen = Faktor, sonst 1) | Ereignisse:343-351 | Regionen | Nachfrage Spieler (KI nicht, 1.2) |
| Antworten auf Krisen | nur die 6 weltweiten geschichtlichen Ereignisse; feste Preise: Absicherung 4 / 6 / 3 Mio. $ (1973/1979/1990), Rückgewinnung 5 / 8 / 25 Mio. $ (2001/2008/2020) | Ereignisse:73-202; `src/components/app/GameDialogs.tsx:72-79` | Kasse | Kasse, Treibstoff, Nachfrage |
| Treibstoff-Absicherung | Preis des Monats vor dem Ereignis gilt für die ganze Dauer, nur für den Spieler | `src/App.tsx:639-650` | Ereignis-Wahl | Treibstoffpreis Spieler |
| Rückgewinnung | Faktor = (roh + (1 − roh) × Anteil) / roh, nur für den Spieler | `src/lib/gameState.ts:440-456` | Ereignis-Wahl | Nachfrage Spieler |
| Meldungen | Start und Ende jedes Ereignisses; Frage einmal beim Start | Monat:1208-1230, :79-128 | Ereignisse | Postfach, Dialog |
| Jahres-Vorschau | Januar: Typen, die im Jahr erstmals geliefert werden | Monat:875-912 | Datenblatt | Postfach |

### Betriebsstörungen und Vogelschläge

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Technischer Defekt | je Strecke und Monat: 0,333 % + (100 − Zelle) × 0,0267 % + Alter × 0,0333 %; Hangar am Abflug × 0,5; Forschung × 0,7; streicht 50 % der Flüge | Störungen:64-70, :144-155, :197-206 | Zustand, Alter, Hangar | Flüge, SAT |
| Flughafen-Streik | je angeflogenem Flughafen 0,333 %; streicht 60 % aller Flüge dort | Störungen:82, :208-217 | Netzgröße | Flüge, SAT |
| Winterwetter | je Region (EU, NA, AS) im Dez.–Feb. 3 %; streicht 15 % aller Flüge mit einem Ende dort | Störungen:85-89, :228-238 | Monat, Netz | Flüge, SAT |
| Mehrere Ursachen | 1 − Π(1 − Anteil) je Strecke; Personalstreik zusätzlich für alle | Störungen:116-129; `src/lib/gameState.ts:503` | – | gestrichener Anteil |
| Wirkung im Rechenkern | Flüge, Sitze, Treibstoff, Crew, Gebühren × geflogener Anteil; SAT − 50 × gestrichener Anteil | `src/lib/financeUtils.ts:1250-1253`, `:1291-1292`, `:1312` | gestrichener Anteil | Erlös, Kosten, SAT |
| Frage an den Spieler | Störung ≥ 25 % mit Erlösverlust; höchstens 3 je Monat, größter Verlust zuerst | Störungen:92-94, :530-539; Monat:1468-1480 | Vorhersage X+1 | Entscheidung |
| Charter | alle Flüge fliegen (eigene Kosten voll); Gebühr 90 % des geretteten Erlöses, beim Abschluss nach echtem Ergebnis; teilen sich mehrere eine Strecke, wird geteilt | Störungen:478-511; Monat:573-579 | Erlösverlust | Monatsergebnis |
| Streichen | kostenlos; Ruf −1 je betroffene Strecke (× nicht anders gestrichener Anteil), höchstens −4 | Störungen:98-100, :520-523 | Strecken | Ruf (1.5) |
| Vogelschlag | je fliegende Strecke 0,2 % je Monat; Reparatur 100 000 / 200 000 / 400 000 $ (Regional/Narrowbody/Widebody), sofort bezahlt; außerhalb des Pech-Deckels | Störungen:73-79, :274-292; Monat:974-993 | Netzgröße, Klasse | Kasse |
| Personalstreik | Paket 1.4/1.5; nur an dieser Stelle gewürfelt und als Frage gestellt | Monat:707-751 | Moral | Flüge, Ruf |

KI-Gesellschaften haben keine Störungen, Vogelschläge oder Streiks (Störungen:37-38; 1.6).

### Flottenmarkt

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Neukauf | Listenpreis (Datenblatt, nominal) + Kabinen-Extras je Sitz; sofort bezahlt | `src/components/ConfigurePurchaseView.tsx:491-541`; `src/App.tsx:1953` | Typ, Kabine | Kasse |
| Vorbestellung | Typen mit Erstauslieferung in den nächsten 12 Monaten; Rabatt 12 % + 1 % je weiteres Flugzeug, höchstens 20 % (ab 9 Stück) | `src/lib/preorders.ts:51-78` | Menge | Preis |
| Anzahlung / Rest | 20 % sofort; Rest bei Lieferung aus der Kasse nach dem Monatsergebnis | `src/lib/preorders.ts:19`, `:121-147`; Monat:1149 | Kasse | Kasse |
| Lieferung | Erstauslieferung + 1 + ⌊Menge / 3⌋ Monate; ganze Bestellung oder nichts | `src/lib/preorders.ts:75-76` | Menge | Flotte |
| Nicht bezahlbar | 1 Monat später, höchstens 3 Mal, dann storniert, Anzahlung weg | `src/lib/preorders.ts:27`, `:136-143` | Kasse | Kasse |
| Storno durch Spieler | 50 % der Anzahlung zurück | `src/lib/preorders.ts:29`, `:100-102`; `src/App.tsx:1801-1807` | – | Kasse |
| Erstkunden-Bonus | Lieferung ≤ 12 Monate nach Erstauslieferung: Beliebtheit + 5 für 24 Monate | `src/lib/preorders.ts:31-34`, `:149-151`; Monat:1163-1164 | Datum | SAT |
| Ausgelieferte Kabine | Standard: alles Economy, 74 cm, keine Extras | `src/lib/fleet.ts`; Monat:1155 | – | SAT, Umrüstung |
| Gebrauchtmarkt | 6 Angebote je Monat, gleiche Liste für jedes Spiel (Zufall nach Monat); Typen ≥ 5 Jahre im Dienst; Alter 4–24 Jahre, nicht älter als der Typ | `src/lib/usedMarket.ts:22-29`, `:61-84` | Monat | Angebot |
| Zustand gebraucht | Zelle 98 − 2,2 × Alter ± 7, Kabine 92 − 2,8 × Alter ± 11, je 20–95 | `src/lib/usedMarket.ts:73-76` | Alter, Zufall | Wert, Defekte, SAT |
| Gebrauchtpreis | Wiederverkaufswert × 0,95, auf 10 000 $ gerundet, mindestens 250 000 $ | `src/lib/usedMarket.ts:26`, `:77`, `:81` | Wiederverkaufswert | Kasse |
| Alter gebraucht | Kaufmonat wird um das Alter zurückgesetzt: Wartung, Wert, Beliebtheit, Defekte rechnen mit dem echten Alter | `src/App.tsx:1830` | Angebot | Kosten |
| Wiederverkaufswert | Liste × (0,30 + 0,45 × Zelle/100 + 0,15 × Kabine/100) × max(0,4; 1 − 0,02 × Alter) × (1 + Forschungs-Bonus) | `src/lib/financeUtils.ts:1633-1647`; `src/lib/fleetCosts.ts:23-24`, `:148-150` | Zustand, Alter | Verkauf, Flottenwert, Gebrauchtpreis, Übernahme |
| Verkauf | Wiederverkaufswert sofort; Strecken des Flugzeugs werden gelöscht | `src/App.tsx:1700-1711` | – | Kasse |
| Grundüberholung (General Check) | 200 000 $ fest, nur an Flughafen mit Hangar; Zelle + 50 / 50 / 40 / 30, danach nichts | `src/App.tsx:218-231`, `:2787-2810` | Zahl der Checks | Zelle |
| Kabinen-Umrüstung | 1 000 $ je Sitz + Extras; Kabine auf max(jetzt, 90 − 10 × Umrüstungen, mindestens 30) | `src/components/ConfigurePurchaseView.tsx:539`; `src/App.tsx:1951-1965` | Sitze, Zahl der Umrüstungen | Kabine, SAT |
| Verschleiß Kabine | min(Flugstunden × 0,0012 + 0,1; 1) je Monat × Forschung | Monat:1512-1527 | Flugplan | Kabine |
| Verschleiß Zelle | min(Flugstunden × 0,00076 + 0,1; 0,667) je Monat × Forschung | Monat:1513-1532 | Flugplan | Zelle |
| Flugstunden | geplante Blockzeit je Woche × 4 (ohne Streichungen) | Monat:1500-1509 | Flugplan | Verschleiß |
| Beliebtheit | Datenblatt − max(0; min(15; Alter − 8)) + Erstkunden-Bonus + Forschung | Monat:1537-1541; `src/lib/fleetCosts.ts:153-160` | Alter | SAT |

### Prüfhilfe (`src/lib/invariants.ts`)

| Größe | Formel | Fundstelle | Wirkt auf |
|---|---|---|---|
| `findNonFinite` | sucht NaN/Unendlich in einem Ergebnis (Tiefe 4, höchstens 20 Pfade) | `src/lib/invariants.ts:12-35` | Warnung im Log je Strecke (Monat:480-484) |
| `finiteOr` | Zahl oder Ersatzwert | `:38-41` | Spielstand-Laden |

Die Prüfung meldet nur; der Monat rechnet mit dem fehlerhaften Wert weiter (`|| 0` fängt nur
`NaN` ab, nicht Unendlich).

## Konstanten

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| 4 | Wochen je Monat (Strecken, Flughäfen, Fluggäste) | Monat:487-489, :547, :550, :566 |
| 1/12 | Monatsanteil der Flotten-Jahreskosten | `src/lib/fleetCosts.ts:55` |
| 120 | Monate Bericht-Verlauf | Monat:1263 |
| 0,05 | Chance je Monat auf ein Zufallsereignis | Monat:916 |
| 11 | Vorlagen für Zufallsereignisse (6 Pech, 5 Glück) | Monat:206-287 |
| 0,15 | Chance je Monat, eine fehlende KI zu ersetzen | Monat:849 |
| 120 Monate | Jubiläum | Monat:1093 |
| 0,0012 / 0,00076 | Verschleiß Kabine / Zelle je Flugstunde | Monat:1512-1513 |
| 0,1 | Verschleiß je Monat ohne Flug | Monat:1514 |
| 1 / 0,667 | Höchstverschleiß Kabine / Zelle je Monat | Monat:1515-1516 |
| 0,333 % / 0,0267 % / 0,0333 % | Defekt: Grund / je Punkt Zelle unter 100 / je Jahr Alter | Störungen:64-68 |
| 0,5 | Hangar-Faktor auf Defekte | Störungen:70 |
| 0,333 % / 3 % | Flughafen-Streik je Flughafen / Winterwetter je Region | Störungen:82, :85 |
| 50 / 60 / 15 % | gestrichener Anteil Defekt / Flughafen-Streik / Wetter | Störungen:57-61 |
| 0,25 / 3 | ab diesem Anteil eine Frage / höchstens Fragen je Monat | Störungen:92, :94 |
| 0,9 | Charter-Gebühr als Anteil des geretteten Erlöses | Störungen:96 |
| 1 / 4 | Ruf je gestrichene Strecke / höchstens je Störung | Störungen:98, :100 |
| 50 | SAT-Abzug bei ganz gestrichenem Flugplan | `src/lib/financeUtils.ts:803` |
| 0,2 % | Vogelschlag je Strecke und Monat | Störungen:73 |
| 100 000 / 200 000 / 400 000 $ | Vogelschlag-Reparatur (nominal) | Störungen:75-79 |
| 12 / 20 % / 12 | Vorbestellung: Vorlauf in Monaten / Anzahlung / größte Bestellung | `src/lib/preorders.ts:17-25` |
| 12 % + 1 %, höchstens 20 % | Vorbestell-Rabatt | `src/lib/preorders.ts:21-23` |
| 3 / 50 % | Verschiebungen bis Storno / Rückzahlung bei Storno | `src/lib/preorders.ts:27-29` |
| 5 / 24 / 12 | Erstkunden: Beliebtheit / Monate / Fenster in Monaten | `src/lib/preorders.ts:31-34` |
| 6 / 60 / 4–24 | Gebraucht: Angebote je Monat / Monate im Dienst / Alter in Jahren | `src/lib/usedMarket.ts:22-29` |
| 0,95 | Gebrauchtpreis als Anteil des Wiederverkaufswerts | `src/lib/usedMarket.ts:26` |
| 250 000 $ | kleinster Gebrauchtpreis (nominal) | `src/lib/usedMarket.ts:81` |
| 0,30 / 0,45 / 0,15 | Wiederverkauf: Sockel / Zelle / Kabine | `src/lib/financeUtils.ts:1642-1646` |
| 2 % / 0,4 | Wertverlust je Jahr / kleinster Altersfaktor | `src/lib/fleetCosts.ts:23-24` |
| 200 000 $ | Grundüberholung (nominal, jede Größe) | `src/App.tsx:218` |
| 50 / 50 / 40 / 30 | Zelle-Punkte der 1.–4. Grundüberholung | `src/App.tsx:225-231` |
| 1 000 $ | Umrüstung je Sitz (nominal) | `src/components/ConfigurePurchaseView.tsx:539` |
| 3–25 Mio. $ | Preise der Krisen-Antworten (nominal) | Ereignisse:78-193 |

## Beispielwerte (nachgerechnet)

**Verschleiß** je Jahr (Kabine / Zelle) nach Flugstunden im Monat: 0 h 1,2 / 1,2 · 150 h 3,4 / 2,6
· 300 h 5,5 / 3,9 · 450 h 7,7 / 5,3 · 600 h 9,8 / 6,7 · ab 750 h 12 / 8 (Deckel).

**Wiederverkaufswert** eines neu gekauften Flugzeugs, 300 Flugstunden im Monat, in % des
Listenpreises (in Klammern: nach einer Grundüberholung, Zelle + 50):

| Alter | 0 | 1 | 5 | 10 | 15 | 20 | 25 | 30 |
|---|---|---|---|---|---|---|---|---|
| Zelle / Kabine | 100 / 100 | 96 / 94 | 80 / 72 | 61 / 45 | 41 / 17 | 21 / 0 | 2 / 0 | 0 / 0 |
| Wert | 90 | 86 | 69 (77) | 51 (65) | 36 (52) | 24 (37) | 15 (27) | 12 (21) |

**Gebrauchtmarkt**, Januar, je 6 Angebote. Preis in % der Liste; sofortiger Weiterverkauf in %
des Kaufpreises:
- 1975: Tu-134A 5 Jahre 67 % · DC-8-10 5 Jahre 71 % · IL-18V 11 Jahre 53 % — Weiterverkauf je 105 %.
- 1990: A300B2 7 Jahre 67 % · 747-100SR 16 Jahre 40 % · Caravelle VI-N 18 Jahre 40 % — je 105 %.
- 2010: A330-300 9 Jahre 60 % · 757-200 8 Jahre 59 % · Britannia 300 23 Jahre 29 % — je 105 %.

**Vorbestellung**, Listenpreis 100 Mio. $: 1 Stück 88 Mio. $ (Lieferung Erstauslieferung + 1
Monat) · 3 Stück 86 · 6 Stück 83 (+ 3) · 12 Stück 80 (+ 5). Wiederverkaufswert bei Lieferung:
90 Mio. $.

**Störungs-Chancen** je Monat: Defekt bei Zelle 100 / Alter 0: 0,33 % · Zelle 90 / 2 Jahre: 0,67 %
· 70 / 10: 1,47 % · 50 / 15: 2,17 % · 20 / 25: 3,30 % (mit Hangar je die Hälfte). Netz mit 40
Flughäfen: Flughafen-Streik irgendwo 12,5 % je Monat. Netz mit 50 Strecken: Vogelschlag
irgendwo 9,5 % je Monat.

**Charter oder streichen** (Defekt 50 %, Normal, Ruf 50, Monat = 4 Wochen, in $):

| Strecke | ohne Störung: Erlös / Gewinn | 50 % gestrichen: Erlös / Gewinn | mit Charter: Gebühr / Gewinn |
|---|---|---|---|
| 737-100 FRA–CDG 1976, 7×/Woche | 273 160 / −97 403 | 79 120 / −92 082 | 174 636 / −272 039 |
| 737-100 FRA–LHR 1970, 14×, Preis 50 | 644 000 / −125 885 | 184 200 / −165 373 | 413 820 / −539 705 |
| A320ceo FRA–LHR 1995, 14×, Preis 60 | 1 008 000 / −149 590 | 228 480 / −271 609 | 701 568 / −851 158 |
| A320ceo FRA–MAD 2005, 14× | 1 050 720 / −921 150 | 206 400 / −728 354 | 759 888 / −1 681 038 |

Die Strecken verlieren schon ohne Störung (Paket 1.4). Der Vergleich gilt trotzdem: Charter ist
in jedem Fall um 175 000–770 000 $ schlechter als Streichen. Bei 50 % gestrichenen Flügen fällt
der Erlös um 71–80 %; eine vorher volle A320 (Auslastung 1,00) fliegt danach zu 45 %.

**Treibstoff-Absicherung** (Normal, je Gallone): Ölkrise 1973 gesichert 2,04 $ statt 4,12–4,36 $
(−51 %, 18 Monate, für 4 Mio. $) · 1979 1,83 $ statt 3,27 $ (−44 %, 24 Monate, 6 Mio. $) · 1990
1,19 $ statt 1,79 $ (−33 %, 12 Monate, 3 Mio. $).

## Widersprüche und Auffälligkeiten

### W1 · Gebrauchtmarkt: Kaufen und sofort verkaufen bringt 5 %
- Befund: Der Gebrauchtpreis ist der Wiederverkaufswert × 0,95. Der Spieler verkauft zum vollen
  Wiederverkaufswert. Kaufen und im selben Monat verkaufen bringt 1 / 0,95 = 105 % zurück, mit
  Forschungs-Bonus mehr. Es gibt keine Sperrfrist und keine Gebühr.
- Fundstelle: `src/lib/usedMarket.ts:26`, `:77`; `src/App.tsx:1700-1705`, `:1811-1838`
- Folge im Spiel: Jeden Monat 6 Angebote risikolos mit Gewinn. 2010: A330-300 für
  54,95 Mio. $ kaufen, für 57,84 Mio. $ verkaufen: +2,9 Mio. $ in einem Klick.
- Vorschlag: Ankaufspreis (was der Spieler bekommt) unter Verkaufspreis (was er zahlt) legen,
  z. B. Händler-Spanne auf beiden Seiten. Eine Formel für „Wert“, eine für „Preis“.
- Braucht Entscheidung: ja

### W2 · Vorbestellung billiger als der Wiederverkaufswert
- Befund: Ein neues Flugzeug ist sofort 90 % der Liste wert. Vorbestellt kostet es 80–88 %.
  Bei Lieferung verkauft: +2 bis +10 % der Liste je Flugzeug.
- Fundstelle: `src/lib/preorders.ts:21-23`, `:68-78`; `src/lib/financeUtils.ts:1641-1646`
- Folge im Spiel: 12 Flugzeuge zu 100 Mio. $ vorbestellt (Anzahlung 192 Mio. $), bei Lieferung
  verkauft: +120 Mio. $ ohne Risiko. Dazu Erstkunden-Bonus (Beliebtheit + 5 für 24 Monate).
- Vorschlag: Rabatt und Wertverlust bei Kauf aufeinander abstimmen (z. B. Wert neu = Kaufpreis,
  Wertverlust über die Zeit); Rabatt kleiner als der Abschlag bei Verkauf.
- Braucht Entscheidung: ja

### W3 · Grundüberholung zum Festpreis hebt den Wert um Millionen
- Befund: Ein Check kostet immer 200 000 $, egal ob Regionalflugzeug oder 747, 1960 oder 2040.
  Er hebt die Zelle um bis zu 50 Punkte, also den Wert um 0,45 × 50 % × Altersfaktor der Liste.
- Fundstelle: `src/App.tsx:218-231`, `:2787-2810`; `src/lib/financeUtils.ts:1642`
- Folge im Spiel: 747-100 (Liste 95 Mio. $), 10 Jahre, Zelle 61: Wert 48 Mio. $; nach dem Check
  62 Mio. $. 200 000 $ bringen 13 Mio. $ Wert. Vor jedem Verkauf lohnt ein Check.
  Ein CRJ200 (15 Mio. $) bekommt für denselben Preis 2 Mio. $.
- Vorschlag: Preis als Anteil des Listenpreises (und mit Kostenindex); Wertzuwachs höchstens
  so groß wie der Preis oder Wert nicht an den Check koppeln.
- Braucht Entscheidung: ja

### W4 · Charter rechnet sich nie
- Befund: Bei Charter fliegt der Rechenkern alle Flüge mit den eigenen Kosten (Treibstoff,
  Crew, Gebühren) und berechnet dazu 90 % des geretteten Erlöses. Das Ersatzflugzeug kostet also
  doppelt: eigene Kosten plus Gebühr. Unterschied Charter − Streichen = 0,1 × geretteter Erlös −
  Kosten der gestrichenen Flüge. Das ist fast immer negativ.
- Fundstelle: `src/lib/disruptions.ts:478-511`; `src/lib/financeUtils.ts:1250-1253`, `:1291-1292`;
  Monat:567-580
- Folge im Spiel: In allen vier Beispielen ist Charter 175 000–770 000 $ teurer als Streichen.
  Der einzige Vorteil sind bis zu 4 Ruf-Punkte und die SAT des Monats. Der Text der Frage sagt
  „about X $“, nennt aber die eigenen Kosten nicht.
- Vorschlag: Bei Charter entweder die eigenen Kosten der gestrichenen Flüge weglassen (das
  eigene Flugzeug steht) oder die Gebühr als Kosten je Flug statt als Erlösanteil festlegen.
- Braucht Entscheidung: ja

### W5 · Gestrichene Flüge vertreiben mehr Fluggäste, als Sitze wegfallen
- Befund: Ein gestrichener Anteil senkt Sitze und Kosten im gleichen Maß, zieht aber zusätzlich
  50 × Anteil von der SAT ab. Die SAT senkt die Nachfrage. Bei 50 % gestrichen fällt die SAT um 25.
- Fundstelle: `src/lib/financeUtils.ts:1312-1313`, `:803`
- Folge im Spiel: A320ceo FRA–LHR 1995 war voll (Auslastung 1,00). Mit halbem Flugplan sind die
  übrigen Flüge nur zu 45 % voll; der Erlös fällt um 77 % statt um 50 %. Die Charter-Gebühr wird
  aus diesem überhöhten Verlust berechnet. Dazu kommt der Ruf-Abzug fürs Streichen: dieselbe
  Störung wird doppelt bestraft.
- Vorschlag: Eine Strafe festlegen: entweder SAT-Abzug (dann ohne Ruf-Abzug) oder Ruf-Abzug.
  Die Nachfrage sollte höchstens auf die verbleibenden Sitze fallen, nicht darunter.
- Braucht Entscheidung: ja

### W6 · Die Kasse des Spielers darf ohne Folge negativ sein
- Befund: Es gibt keine Kredite, keine Zinsen und im freien Spiel keine Pleite. Käufe prüfen die
  Kasse, laufende Verluste nicht. Die KI dagegen steht nach 6 Monaten im Minus zum Verkauf (1.6).
- Fundstelle: Monat:822 (Kasse += Ergebnis, ohne Grenze); kein Treffer für Kredit, Zins oder
  Pleite in `src/lib/` und `src/App.tsx` außer KI und Szenario (`src/data/scenarios.ts:112`)
- Folge im Spiel: Ein Spieler mit Verlust-Netz fliegt beliebig lange weiter. Ohne Druck verliert
  der Monatsabschluss sein Ziel.
- Vorschlag: Regel festlegen: Dispo mit Zins, Warnung, ab einer Grenze Zwangsverkauf oder Ende.
- Braucht Entscheidung: ja

### W7 · „Kasse danach“ im Bericht ist nicht die Kasse danach
- Befund: Vogelschläge und Auslieferungen werden nach dem Bericht abgebucht. Sie stehen erst im
  Bericht des nächsten Monats unter Einmal-Ausgaben. Szenario, Chronik und Meilensteine lesen
  „Kasse + Ergebnis (+ Preise)“ ohne diese Abbuchungen; die Auslieferung prüft „Kasse + Ergebnis“
  ohne Preise und ohne Vogelschläge; die Zeitung ohne Preise.
- Fundstelle: Monat:638, :787, :982, :1149, :1199, :1268, :1299, :1358
- Folge im Spiel: Werden 12 vorbestellte Flugzeuge zu je 80 Mio. $ geliefert, zeigt der Bericht
  eine um 768 Mio. $ (Restzahlung) zu hohe Kasse. Ein Szenario mit Kassen-Ziel kann mit Geld gewonnen werden, das
  im selben Abschluss schon ausgegeben ist. Über mehrere Berichte geht die Rechnung auf.
- Vorschlag: Eine Größe „Kasse am Monatsende“, nach allen Buchungen des Abschlusses; alle Leser
  nutzen sie. Abbuchungen des Abschlusses gehören in den Bericht dieses Monats.
- Braucht Entscheidung: nein

### W8 · Feste Dollar-Beträge über 60 Jahre und jede Größe
- Befund: Krisen-Antworten (3–25 Mio. $), Vogelschlag (100 000–400 000 $), Grundüberholung
  (200 000 $), Umrüstung (1 000 $ je Sitz) und der kleinste Gebrauchtpreis (250 000 $) sind fest.
  Der Nutzen einer Krisen-Antwort wächst mit der Airline, der Preis nicht.
- Fundstelle: Ereignisse:78-193; Störungen:75-79; `src/App.tsx:218`;
  `src/components/ConfigurePurchaseView.tsx:539`; `src/lib/usedMarket.ts:81`
- Folge im Spiel: Die Absicherung 1973 halbiert die Treibstoff-Rechnung für 18 Monate. Bei
  1 Mio. $ Treibstoff im Monat spart sie etwa 9 Mio. $ für 4 Mio. $; bei 10 Mio. $ im Monat
  90 Mio. $ für dieselben 4 Mio. $. Eine Airline mit 3 Mio. $ Kasse kann sie nicht kaufen.
  Gleiches Muster wie 1.4 W8 und 1.6 W5.
- Vorschlag: Beträge an Kostenindex und Größe koppeln (z. B. Krisen-Antwort als Anteil der
  Treibstoff-Rechnung oder des Erlöses, Vogelschlag als Anteil des Listenpreises).
- Braucht Entscheidung: ja (gehört zur Frage „Kostenindex für Einmalpreise“ aus 1.4)

### W9 · Gebrauchtmarkt kennt das Bauende nicht
- Befund: Das Alter eines Angebots ist nur durch den Erstflug des Typs begrenzt, nicht durch das
  Bauende (`lastDeliveryOffset`). Flugzeuge aufgelöster KI kommen nicht auf den Markt, obwohl die
  Meldung das sagt (1.6 W8).
- Fundstelle: `src/lib/usedMarket.ts:62`, `:69-71`; `src/lib/aiSimulation.ts:1209`
- Folge im Spiel: 2010 wird eine Britannia 300 mit 22,5 Jahren angeboten, also Baujahr 1987. Der
  Typ wurde nur 1960 gebaut. Ein „junges“ Flugzeug eines alten Typs ist billiger in der Wartung
  und verliert weniger Beliebtheit, als es dürfte.
- Vorschlag: Alter mindestens „jetzt − Bauende“. KI-Flugzeuge bei Auflösung in die Angebote.
- Braucht Entscheidung: nein (Bauende), ja (KI-Flugzeuge, schon 1.6 Frage 7)

### W10 · Wiederverkaufswert: Text, Kabine und Sofortverlust
- Befund: (a) Der Kommentar nennt einen „30 % Sockel“; mit dem Altersfaktor ist der kleinste
  Wert 0,30 × 0,4 = 12 %. (b) Kabinen-Extras werden beim Kauf bezahlt, zählen aber nicht zum Wert.
  (c) Ein neues Flugzeug verliert beim Kauf sofort 10 % (Zustand 100 ergibt 0,90).
  (d) Die KI verkauft ohne Alter (1.6 W7).
- Fundstelle: `src/lib/financeUtils.ts:1627-1647`; `src/components/ConfigurePurchaseView.tsx:540`
- Folge im Spiel: Ein 30 Jahre altes Flugzeug bringt 12 % der Liste, nicht 30 %. Eine teure
  First-Kabine ist beim Verkauf nichts wert.
- Vorschlag: Ein Wertmodell in der Spezifikation: Kaufpreis, Abschreibung je Jahr, Zustand als
  Zu- oder Abschlag. Gehört zur Frage „Abschreibung“ aus 1.4.
- Braucht Entscheidung: ja

### W11 · Verschleiß zählt Flüge, die nicht stattfinden
- Befund: Der Verschleiß rechnet die geplante Blockzeit × 4 Wochen. Gestrichene Flüge (Störung,
  Streik) zählen mit. Der Kommentar spricht von „12 % / 8 % im Jahr“, gemeint sind Punkte.
- Fundstelle: Monat:1500-1532
- Folge im Spiel: Ein ganz bestreiktes Flugzeug nutzt sich ab wie im Normalbetrieb. Klein.
- Vorschlag: geflogenen Anteil aus dem Rechenkern verwenden.
- Braucht Entscheidung: nein

### W12 · Pech-Deckel lässt drei Pech-Arten im selben Monat zu
- Befund: Der Deckel wird einmal je Abschluss für X+1 bestimmt. Ist er offen, können im selben
  Abschluss ein Zufalls-Pech-Ereignis (Start X+1), Störungen für X+1 und ein Personalstreik für
  X+1 entstehen. Die Regel in `malus.ts` sagt: „nichts kommt dazu, solange ein Pech-Ereignis läuft“.
- Fundstelle: Monat:701, :707-714, :916-939, :945-947; `src/lib/malus.ts:17-22`
- Folge im Spiel: Selten, aber möglich: Wirtschaftskrise, Flughafen-Streik und Personalstreik
  beginnen im selben Monat.
- Vorschlag: Nach dem ersten gewürfelten Pech im Abschluss den Deckel schließen; oder Regel so
  aufschreiben, wie sie ist.
- Braucht Entscheidung: nein

### W13 · Zufallsereignisse: wenige, gleich für alle, ohne Antwort
- Befund: Im Mittel 0,6 Zufallsereignisse je Jahr, Stärke 0,70–1,20 (Nachfrage) und 0,82–1,40
  (Treibstoff). Weltweite Ereignisse treffen KI und Spieler gleich; regionale nur den Spieler
  (die KI rechnet ohne regionale Faktoren, 1.2). Antworten gibt es nur bei 6 geschichtlichen
  Krisen. Die Ereignisse liegen im Modul-Zustand von `eventSystem.ts`; `closeMonth` schreibt ihn
  direkt (`setRuntimeRandomEvents`), nicht als Befehl.
- Fundstelle: Monat:916-939; Ereignisse:310-320; `src/lib/aiSimulation.ts:793`
- Folge im Spiel: Ein regionales Pech-Ereignis trifft nur den Spieler; die KI am selben Ort
  fliegt weiter wie bisher. Ein Test, der `closeMonth` aufruft, ändert globale Daten.
- Vorschlag: In der Spezifikation festlegen: Gelten Ereignisse für alle Gesellschaften gleich?
  Ereignisse als Teil des Spielstands übergeben, nicht als Modul-Zustand.
- Braucht Entscheidung: ja (gleiche Wirkung für alle; gehört zu 1.6 Frage 1)

### W14 · Krisen-Treibstoff möglicherweise doppelt
- Befund: Schon in 1.4 W4: Die Preistabelle steigt 1973–1975 schon, darauf kommt × 2,0.
- Fundstelle: siehe `bestand/4-kosten.md` W4
- Braucht Entscheidung: ja (1.4 Frage 2)

## Doppelte Rechnungen

- Saisonfaktoren: `src/App.tsx:878` (`getBaseGlobalDemand`, für Zeitung und Anzeige) hat eine
  eigene Kopie der Tabelle aus `src/lib/financeUtils.ts:279`, ohne Südhalbkugel.
- Treibstoff-Absicherung wird in der Oberfläche gerechnet (`src/App.tsx:639-650`), nicht in
  `src/lib/`. Die KI ruft `getJetFuelPrice` direkt.
- Grundüberholung: Preis und Wirkung stehen in `src/App.tsx:218-231` und im Klick-Handler
  (`:2787-2810`), nicht in `src/lib/`.
- Umrüstungspreis und Kaufpreis rechnet die Ansicht `src/components/ConfigurePurchaseView.tsx:491-541`.
- Sitze eines Flugzeugs: Monat:837-840 rechnet sie selbst (Kabine oder Kapazität), ebenso
  `rivalSeats` (Monat:185-189).
- Monatswert = Wochenwert × 4 steht an vielen Stellen (Monat:487-505, :547, :550, :566, :626,
  :1265; `src/lib/aiSimulation.ts`; Paket 1.3 W „Monat = 4 Wochen“). Die Flotten-Kosten nutzen
  dagegen Jahr / 12 (`src/lib/fleetCosts.ts:55`): ein Jahr hat für Erlös 48 Wochen, für die
  Flotte 52.
- Ereignis-Netz: Die Vorhersage für X+1 wird einmal für die Strecken und für Störungsfragen
  gerechnet (gut); die Charter-Gebühr rechnet das Netz für jede Gruppe neu (Störungen:478-506).

## Bezug zu bisherigen offenen Fragen

- 1.3 „Monatslänge“: siehe Doppelte Rechnungen (48 gegen 52 Wochen).
- 1.4 „Kostenindex für Einmalpreise“ und „Abschreibung“: W3, W8, W10.
- 1.4 „Treibstoff-Quelle“: W14.
- 1.6 Frage 1 (gleiche Regeln für KI) und Frage 7 (Flugzeuge aufgelöster KI): W9, W13.

## Offene Fragen an den Menschen

1. Gebrauchtmarkt und Vorbestellung: Soll es eine Spanne zwischen Kauf- und Verkaufspreis geben,
   damit Kaufen und sofort Verkaufen nie Gewinn bringt? Wie groß? (W1, W2)
2. Wert eines Flugzeugs: Kaufpreis mit Abschreibung je Jahr und Zustand als Zu-/Abschlag, oder
   die heutige Formel (Sockel + Zustand × Alter)? Zählt die Kabine zum Wert? (W2, W3, W10)
3. Grundüberholung: Preis als Anteil des Listenpreises? Soll sie den Verkaufswert heben oder nur
   Defekte und Verschleiß? (W3)
4. Charter: Soll das eigene Flugzeug bei Charter stehen (keine eigenen Kosten), und wie teuer soll
   ein Ersatzflugzeug sein: Anteil des Erlöses oder Preis je Flug? (W4)
5. Gestrichene Flüge: eine Strafe (SAT oder Ruf) oder beide? Darf die Nachfrage unter die übrigen
   Sitze fallen? (W5)
6. Negative Kasse: Was passiert? Kredit mit Zins, Warnung, Zwangsverkauf, Spielende? (W6)
7. Ereignisse: für alle Gesellschaften gleich (auch regionale)? Krisen-Antworten mit festem Preis
   behalten oder an Größe und Kostenindex koppeln? Mehr Zufallsereignisse mit Antworten? (W8, W13)
