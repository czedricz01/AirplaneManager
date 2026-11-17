# Bestand: Nachfrage und Marktanteil

Paket 1.2 · Stand 17.11.2026 · Commit 9b48087

Alle Fundstellen ohne Pfad liegen in `src/lib/financeUtils.ts`.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).
Standard-Beispiel: Juli, Schwierigkeit Normal, Reisegeschwindigkeit 850 km/h, keine Spieler-Zuschläge.
Nachfrage gilt immer **pro Woche, beide Richtungen zusammen**.

## Überblick

Die Nachfrage sagt, wie viele Fluggäste pro Woche zwischen zwei Städten fliegen wollen,
egal mit welcher Fluggesellschaft. Danach wird sie auf die Anbieter aufgeteilt (Marktanteil).
Rechenweg in einem Bild:

```
Stadtgröße (Geschäft, Tourismus je Flughafen und Jahr)
  → Verflechtung beider Städte (kleinere Stadt zählt stärker)        :668-677
  → Grundnachfrage = 29 × Verflechtung^0,448
       × Schwierigkeit × Jahresbremse × Flugzeit-Faktor
       × weltweite Ereignisse × Spieler-Faktor                        :683
  → Aufteilung auf Economy / Premium / Business / First               :684-708
  → Marktanteil gegen Rivalen und eigene Parallelstrecken            :1425-1432
  → + Gäste, die bei vollen Rivalen keinen Platz finden              :1440-1455
  → höchstens so viel wie Sitze × Preis-Faktor (Paket 1.3)           :1468-1471
  → + Umsteiger aus dem eigenen Netz (transferUtils.ts)              :1489-1508
```

Der „Spieler-Faktor“ fasst Ruf, Krisenhilfe, Forschung, Werbung, Streckenalter und
regionale Ereignisse zusammen. Die KI bekommt ihn nicht (sie rechnet mit 1).

## Größen

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Stadtgröße (Geschäft, Tourismus) | Tabelle je Flughafen und Jahr ab 1960; nach Tabellenende fortgeschrieben mit eigenem Wachstum (höchstens 50 Jahre) | `src/data/airports.ts:33-59` | Flughafen, Jahr | Verflechtung |
| Flugdauer (`durMin`) | Großkreis × 1,02, mit Beschleunigen/Bremsen, Geschwindigkeit des Flugzeugs (sonst 800) | `:192-220` | Strecke, **Flugzeug** | Flugzeitindex |
| Flugzeitindex | Gleitend 1–8 (30 min = 1 … 810 min = 8) | `:246-264` | Flugdauer | Flugzeit-Faktor, Klassen-Aufteilung, Grundpreise |
| Saison (`seasonFactor`) | Monatstabelle 0,88 … 1,15 (Mittel ≈ 1); Südhalbkugel um 6 Monate versetzt, anteilig je Ende | `:279-302` | Monat, Lage | nur Tourismus-Verflechtung |
| Geschäfts-Verflechtung | min(G1, G2)^1,4 × max(G1, G2)^0,6 | `:668-670` | Geschäft beider Enden | Grundnachfrage, Geschäftsanteil |
| Tourismus-Verflechtung | Mittel von (G1 mit T2) und (G2 mit T1), gleiche Formel, × Saison | `:673-675` | Geschäft und Tourismus kreuzweise, Saison | Grundnachfrage |
| Schwierigkeit (`S`) | Easy 1,1 · Normal 0,9 · alles andere 0,75 | `:660` | Schwierigkeit | Grundnachfrage |
| Jahresbremse (`eraDemandFactor`) | 1960: 1 → 1990: 0,65 → ab 2020: 0,40, linear dazwischen | `:622-640` | Jahr | Grundnachfrage |
| Flugzeit-Faktor | max(0,4; 3,1 − 0,35 × Index): 2,75 bei Index 1, 1,0 bei 6, 0,4 ab 7,71 | `:681` | Flugzeitindex | Grundnachfrage |
| Weltweite Ereignisse | Produkt der `demandMultiplier` aller laufenden Ereignisse ohne Region | `src/lib/eventSystem.ts:326-335`, `:664-665` | Monat | Grundnachfrage (Spieler und KI) |
| Grundnachfrage (`baseDemand`) | 29 × Verflechtung^0,448351 × S × Jahresbremse × Flugzeit-Faktor × Ereignisse × Spieler-Faktor | `:683` | alle obigen | Klassen-Nachfrage |
| Geschäftsanteil (`businessRatio`) | Geschäfts-Verflechtung / gesamte Verflechtung | `:684` | Verflechtung | Klassen-Aufteilung |
| Premium-Anteil | max(0,10; 0,15 × (0,3 + 0,7 × Geschäftsanteil) × √((Index/8)^0,7)) × 0,9 | `:685-690` | Geschäftsanteil, Index | Premium-Nachfrage |
| Business-Nachfrage | Premium × 0,9 × (0,4 + 1,2 × Geschäftsanteil) × (0,7 … 1,0 nach Flugzeit bis Index 4) | `:697-703` | Premium, Geschäftsanteil, Index | Business-Nachfrage |
| First-Nachfrage | (Business ohne Flugzeit-Abschlag) × 0,45 × (0,3 + 1,4 × Geschäftsanteil) × (0,35 … 1,0 nach Flugzeit bis Index 4) | `:706` | wie oben | First-Nachfrage |
| Economy-Nachfrage | Grundnachfrage − Premium − Business − First | `:708` | obige | Economy-Nachfrage |
| Ruf-Faktor | 0,85 + 0,2 × Ruf/100 (neutral bei Ruf 75) | `src/lib/gameState.ts:427-429` | Ruf | Spieler-Faktor |
| Krisenhilfe | Für gewählte Ereignis-Antworten: (Abschlag gemildert) / (Abschlag roh) | `src/lib/gameState.ts:440-456` | Ereignis-Entscheidung | Spieler-Faktor |
| Forschung Nachfrage | × (1 + 0,015 + 0,025 + 0,01) bei allen drei Stufen | `src/lib/research.ts:114`, `:143`, `:165`; `src/lib/gameState.ts:490` | Forschung | Spieler-Faktor |
| Werbe-Faktor je Region | 1 + Summe der laufenden Kampagnen (lokal 0,05, national 0,10, global 0,18), höchstens 1,25 | `src/lib/marketing.ts:74-78`, `:84`, `:126-135` | Kampagnen | Strecken-Faktor |
| Strecken-Faktor (`routeDemandFactor`) | Spieler-Faktor × Mittel der Werbe-Faktoren beider Enden | `src/lib/gameState.ts:510-520` | obige, Regionen | Grundnachfrage |
| Streckenalter (`routeMaturityFactor`) | 0,6 im 1. Monat → 1 nach 9 Monaten; ab 24 Monaten bis +5 % nach 48 Monaten | `src/lib/routeMaturity.ts:27-36` | Monate seit Eröffnung, Forschung (Start 0,75) | Grundnachfrage (nur Direktstrecke) |
| Regionale Ereignisse | Je Ereignis: Mittel beider Enden (betroffen = Faktor, sonst 1); Produkt über Ereignisse | `src/lib/eventSystem.ts:343-351`, `:1144-1152` | Monat, Regionen | Grundnachfrage (Direktstrecke, Planer) |
| Attraktivität eines Angebots | √Abflüge × Preis-Reiz^1,2 × SAT-Reiz^0,8; Preis-Reiz gekappt 0,5 … 2, SAT-Reiz 0,5 … 1,6 | `:1122-1137` | Abflüge, Preis, SAT | Marktanteil |
| Eigener Preis-Reiz | Marktpreis (ohne SAT) / eigener Preis, je Klasse | `:1425-1429` | Preis, Grundpreis, Schwierigkeit | eigene Attraktivität |
| Rivalen-Attraktivität | Je Rivalen-Strecke: √Abflüge × (1 / (1 − Preisnachlass))^1,2; SAT immer 1 | `:1369-1378`, `src/lib/monthClose.ts:191-205` | KI-Strecken | Marktanteil |
| Eigene Parallelstrecken | Je weitere eigene Strecke auf demselben Paar: √Abflüge (Preis und SAT neutral) | `:1379-1385` | eigene Strecken | Marktanteil |
| Treue (Vielflieger-Programm) | 0,05 im 1. Monat, +0,01 je Monat, höchstens 0,20; hebt eigene und eigene Parallelstrecken | `src/lib/marketing.ts:192-194`, `:207-211`, `:1391`, `:1432` | Programm-Laufzeit | Marktanteil |
| Marktanteil (`marketShare`) | eigene / (eigene + alle anderen); 1, wenn niemand sonst fliegt | `:1161-1165`, `:1430-1432` | Attraktivitäten | Markt-Nachfrage |
| Überlauf von Rivalen | Wollen bei einem Rivalen mehr Gäste mitfliegen als er Sitze hat, wählen die übrigen neu unter den Anbietern mit Platz | `:1440-1455` | Rivalen-Sitze | Markt-Nachfrage |
| Markt-Nachfrage der Strecke | Klassen-Nachfrage × Marktanteil + Überlauf | `:1462` | obige | erreichbare Nachfrage |
| Erreichbare Nachfrage | min(Markt-Nachfrage, Sitze pro Woche × 1,0) | `:1040`, `:1468` | Sitze, Abflüge | Fluggäste |
| Fluggäste (lokal) | min(Sitze, abrunden(erreichbar × Preis-Faktor)) | `:1469-1471` | Preis-Faktor (Paket 1.3) | Erlös, Ruf, Kosten |
| Umsteiger-Potenzial | Markt O–D (eine Richtung) × 0,25 × Umweg-Faktor × Drehkreuz-Güte × Anschluss-Faktor × Anteil gegen Direkt-Rivalen | `src/lib/transferUtils.ts:422` | Netz, Flugplan, Drehkreuz | Umsteiger |
| Umweg-Faktor | 1 − (Umweg − 1) / 0,6; über 1,6 kein Umsteigen | `src/lib/transferUtils.ts:403-405` | Entfernungen | Umsteiger-Potenzial |
| Drehkreuz-Güte | 0,4 + 0,15 × Ausbaustufe (+0,05 Stufe 3, Lounge, Catering), höchstens 1; × (1 + Forschung 0,1) | `src/lib/transferUtils.ts:156-162`, `:389` | Ausbau, Forschung | Umsteiger-Potenzial |
| Anschluss-Faktor | Machbare Anschlüsse (45–360 min) / weniger zahlreiche Seite | `src/lib/transferUtils.ts:125-147`, `:409-411` | Flugpläne | Umsteiger-Potenzial |
| Umsteiger je Strecke | Teuerste Tickets zuerst auf freie Sitze derselben Klasse, beide Teilstrecken; ein O–D-Markt nur einmal | `src/lib/transferUtils.ts:438-479` | freie Sitze, Potenzial | Fluggäste, Erlös |

## Konstanten

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| 29,0 und Hochzahl 0,448351 | Umrechnung Verflechtung → Fluggäste pro Woche | `:683` |
| 1,4 / 0,6 | Gewicht der kleineren / größeren Stadt in der Verflechtung | `:670`, `:673-674` |
| 0,89 … 1,15 | Saison je Monat (Jan … Dez) | `:279` |
| 1,1 / 0,9 / 0,75 | Nachfrage Easy / Normal / Hard (und jeder andere Text) | `:660` |
| `E = 1` | Ohne Wirkung, nur in `formulaVars` | `:661` |
| (1960; 1), (1990; 0,65), (2020; 0,40) | Stützpunkte der Jahresbremse | `:622` |
| 3,1 − 0,35 × Index, mindestens 0,4 | Flugzeit-Faktor | `:681` |
| 0,15 · 0,3 + 0,7 · Hochzahl 0,7 · Untergrenze 0,10 · × 0,9 | Premium-Anteil | `:685-690` |
| 0,9 · 0,4 + 1,2 · 0,7 … 1,0 | Business-Anteil | `:698`, `:702-703` |
| 0,45 · 0,3 + 1,4 · 0,35 … 1,0 | First-Anteil | `:699`, `:706` |
| 0,85 + 0,2 × Ruf/100 | Ruf-Faktor | `src/lib/gameState.ts:428` |
| 0,05 / 0,10 / 0,18; höchstens 1,25 | Werbung lokal / national / global; Obergrenze je Region | `src/lib/marketing.ts:74-78`, `:84` |
| 0,05 + 0,01 je Monat, höchstens 0,20 | Vielflieger-Treue im Marktanteil | `src/lib/marketing.ts:192-194` |
| 0,6 / 9 Monate / +5 % von 24 bis 48 Monaten | Anlauf und Stammkunden einer Strecke | `src/lib/routeMaturity.ts:17-24` |
| +0,15 | Forschung „Route planning suite“: Anlauf ab 75 % | `src/lib/research.ts:123` |
| +1,5 % / +2,5 % / +1 % | Forschung Nachfrage (drei Stufen) | `src/lib/research.ts:114`, `:143`, `:165` |
| Hochzahlen 0,5 / 1,2 / 0,8 | Gewicht Abflüge / Preis / SAT in der Attraktivität | `:1134-1136` |
| 0,5 … 2 / 0,5 … 1,6 | Kappung Preis-Reiz / SAT-Reiz | `:1132-1133` |
| höchstens 50 % | Größter Preisnachlass einer KI im Preis-Reiz | `src/lib/monthClose.ts:202` |
| 1,0 | `MAX_DEMAND_SURPLUS`: Nachfrage zählt höchstens bis zu den eigenen Sitzen | `:1040` |
| 45 / 360 min | Kürzester / längster Umstieg | `src/lib/transferUtils.ts:37-39` |
| 1,6 | Größter Umweg für Umsteiger | `src/lib/transferUtils.ts:41` |
| 0,25 | Höchster Anteil eines O–D-Markts für Umsteiger | `src/lib/transferUtils.ts:43` |
| 0,9 | Umsteiger-Tarif gegenüber Direkt-Grundpreis (Paket 1.3) | `src/lib/transferUtils.ts:45` |
| 800 km/h | Angenommene Geschwindigkeit für Umsteiger-Märkte und Planer ohne Flugzeug | `src/lib/transferUtils.ts:70`, `src/components/RoutePlannerView.tsx:945` |
| 0,4 + 0,15 je Stufe, +0,05 je Extra | Drehkreuz-Güte | `src/lib/transferUtils.ts:158-161`, `src/lib/hubOwnership.ts:27` |
| +10 % | Forschung „Alliance“: mehr Umsteiger | `src/lib/research.ts:135` |

## Beispielwerte (nachgerechnet)

Nachfrage pro Woche (gesamt / Economy / Premium / Business / First):

| Paar | km | Index | 1960 | 1990 | 2019 |
|---|---|---|---|---|---|
| Frankfurt–Paris | 449 | 1,22 | 6 299 (5 281 / 567 / 363 / 88) | 14 953 | 15 649 |
| Frankfurt–Madrid | 1 420 | 2,38 | 3 720 | 12 255 | – |
| Frankfurt–New York | 6 189 | 6,03 | 2 658 | 5 642 (4 458 / 508 / 464 / 212) | – |
| London–Sydney | 17 020 | 8 | 970 | 2 076 | – |

- Zum Vergleich: ein 180-Sitzer mit 7 Hin- und Rückflügen bietet 2 520 Sitze pro Woche.
- Juli 2020 läuft „Global Pandemic“ (Faktor 0,2): Frankfurt–Paris fällt auf 3 107.
- Frankfurt–Paris: Verflechtung wächst 1960 → 2019 um das 56-fache, die Nachfrage nur um das 2,5-fache
  (Hochzahl 0,448 macht daraus 6,1-fach, die Jahresbremse 0,41 den Rest).
- Monat (1990): Januar 14 177, Juli 14 953, November 13 438.
- Schwierigkeit (1990): Easy 18 276, Normal 14 953, Hard 12 461.
- Ruf 0 / 50 / 75 / 100 → Faktor 0,85 / 0,95 / 1,00 / 1,05.
- Streckenalter 0 / 3 / 6 / 9 / 36 / 48 Monate → 0,60 / 0,73 / 0,87 / 1,00 / 1,025 / 1,05.

## Widersprüche und Auffälligkeiten

### W1 · Die Nachfrage eines Städtepaars hängt vom eingesetzten Flugzeug ab
- Befund: Der Flugzeitindex kommt aus `route.durMin`, und das wird mit der Geschwindigkeit des eingesetzten Flugzeugs gerechnet. Ein langsames Flugzeug macht die Flugzeit länger und damit den Flugzeit-Faktor kleiner. Das ändert die **Größe des ganzen Markts**, nicht nur den eigenen Anteil. Umsteiger-Märkte rechnen dagegen immer mit 800 km/h, der Planer mit dem gewählten Flugzeug oder 800 km/h.
- Fundstelle: `:1260`, `:1300`, `:1321-1328`; `src/lib/transferUtils.ts:70`, `:354`; `src/components/RoutePlannerView.tsx:945-950`
- Folge im Spiel: Frankfurt–Madrid 1990: mit 450 km/h 9 542 Gäste pro Woche, mit 900 km/h 12 413 (+30 %). Frankfurt–Paris: 14 170 gegenüber 14 985. Derselbe Markt hat je nach Flugzeug und Ansicht drei verschiedene Größen. Bei zwei Anbietern mit unterschiedlichen Flugzeugen rechnet jeder mit einer anderen Marktgröße.
- Vorschlag: Marktgröße mit einer festen Bezugsgeschwindigkeit (oder nur aus der Entfernung) rechnen. Wenn langsame Flugzeuge weniger Gäste anziehen sollen, das im Marktanteil abbilden.
- Braucht Entscheidung: ja (ob Geschwindigkeit wirken soll, und wenn ja wo)

### W2 · Aufteilung auf eigene Strecken gewinnt Marktanteil
- Befund: Abflüge zählen mit der Wurzel, aber **je Strecke**. Eigene Parallelstrecken werden einzeln addiert. Dieselben Abflüge auf mehrere Strecken verteilt ergeben eine höhere Summe.
- Fundstelle: `:1134`, `:1379-1385`, `:1430-1432`
- Folge im Spiel: Gegen einen Rivalen mit 14 Abflügen: eine eigene Strecke mit 14 Abflügen → 50 %. Zwei Strecken mit 7 + 7 → 58,6 %. Drei Strecken mit 5 + 5 + 4 → 63,4 %. Gleiche Flüge, mehr Gäste, nur durch Aufteilen.
- Vorschlag: Attraktivität je Fluggesellschaft aus der Summe ihrer Abflüge auf dem Paar bilden, danach auf ihre Strecken verteilen.
- Braucht Entscheidung: nein

### W3 · Eigene Parallelstrecken: Anteile ergeben nicht 100 %
- Befund: Die gerade gerechnete Strecke zählt mit ihrem Preis und ihrer SAT, die anderen eigenen Strecken auf demselben Paar mit Preis und SAT neutral (1). Jede Strecke rechnet so; die Anteile passen nicht zusammen.
- Fundstelle: `:1384` gegenüber `:1425-1429`
- Folge im Spiel: Zwei gleiche Strecken mit je 7 Abflügen und SAT 130 bekommen je 55,2 %, zusammen 110,5 % des Markts. Mit SAT 70 je 42,9 %, zusammen 85,8 %. Bei SAT 160 sogar 118,6 %.
- Vorschlag: Alle Angebote eines Paars einmal mit ihren echten Werten aufteilen (eine Rechnung je Markt statt je Strecke).
- Braucht Entscheidung: nein

### W4 · Der Preis wirkt doppelt, sobald ein Rivale da ist
- Befund: Ein niedriger Preis hebt (1) den Marktanteil über den Preis-Reiz (Hochzahl 1,2) und (2) die Nachfrage über den Preis-Faktor (Paket 1.3, bis 1,5). Ohne Rivalen wirkt nur (2). Außerdem messen beide an verschiedenen Bezugspreisen: der Anteil am Marktpreis ohne SAT, der Preis-Faktor am fairen Preis mit SAT und Knappheit.
- Fundstelle: `:1132-1135`, `:1427`, `:1463-1469`, `:1010-1019`
- Folge im Spiel (Economy, Rivale mit gleich vielen Abflügen): 10 % billiger → ohne Rivale +13,5 % Gäste, mit Rivale +20,6 %. Halber Preis → +50 % gegenüber +109 %. 20 % teurer → Anteil 44,6 % statt 50 %, dazu Preis-Faktor 0,60.
- Vorschlag: Festlegen, ob der Preis die Marktgröße, den Anteil oder beides bestimmt, und an welchem Bezugspreis. Zusammen mit W8 aus 1.1 (SAT wirkt dreifach).
- Braucht Entscheidung: ja

### W5 · Premium-Anteil ist fast immer genau 9 %
- Befund: Die Premium-Formel hängt von Geschäftsanteil und Flugzeit ab, hat aber eine Untergrenze von 0,10. Die Formel liegt fast immer darunter, also gilt 0,10 × 0,9 = 9 %.
- Fundstelle: `:685-690`
- Folge im Spiel: Von 28 920 geprüften Paaren (Jahr 2000, mindestens 200 Gäste) liegen 92 % genau auf der Untergrenze; 5 %- bis 95 %-Wert: 9,0 % bis 9,2 %. Frankfurt–Paris, Frankfurt–New York und London–Sydney haben alle 9,0 % Premium. Der Aufwand der Formel wirkt nicht. Da Business und First von Premium abgeleitet sind, hängen auch sie fast nur noch am Geschäftsanteil und an der Flugzeit bis 3,5 h.
- Vorschlag: Klassen-Anteile neu und einfach festlegen (z. B. je Klasse ein Anteil, der mit Flugzeit und Geschäftsanteil wächst), mit Balance-Skript prüfen.
- Braucht Entscheidung: ja (welche Klassen-Aufteilung gewollt ist)

### W6 · Schwierigkeit „Normal“ ist bei der Nachfrage nicht neutral; unbekannter Wert = Hard
- Befund: Nachfrage Easy 1,1 / Normal 0,9 / sonst 0,75. Beim Preis gilt Easy 1,12 / Hard 0,88 / sonst 1. Ein falsch geschriebener Wert (z. B. `'hard'`) gilt bei der Nachfrage als Hard, beim Preis als Normal.
- Fundstelle: `:660`, `:479-483`
- Folge im Spiel: Auf Normal fehlen immer 10 % Nachfrage gegenüber der Formel. Schwierigkeit wirkt an mehreren Stellen (Nachfrage, Preis, Treibstoff `:1624`), siehe O6.
- Vorschlag: Normal = 1 überall; eine Stelle, die Schwierigkeitswerte prüft; Wirkungsorte in 2.2 festlegen.
- Braucht Entscheidung: ja (= O6)

### W7 · Schwere KI bekommt weniger Nachfrage
- Befund: Jede KI rechnet ihre Strecken mit ihrer eigenen Schwierigkeit (`aiDifficulty`). Eine „Hard“-KI bekommt damit Nachfrage × 0,75, Preise × 0,88 und Treibstoff × 1,15; eine „Easy“-KI Nachfrage × 1,1. Gleichzeitig hat die Hard-KI mehr Startkapital und kauft öfter.
- Fundstelle: `src/lib/aiSimulation.ts:776`, `:793`, `:426-440`; `:660`, `:481`, `:1624`; `src/lib/aiSimulation.ts:700`, `:1111`
- Folge im Spiel: Die „stärkste“ KI rechnet mit der schlechtesten Wirtschaft. Die Wirkung der KI-Stufe ist teils umgekehrt.
- Vorschlag: KI-Wirtschaft immer neutral rechnen; KI-Stärke nur über Verhalten (Kapital, Suche, Kaufneigung). Gehört auch zu Paket 1.6.
- Braucht Entscheidung: nein

### W8 · Zwei Bremsen gegen das Wachstum hintereinander
- Befund: Die Verflechtung wächst mit den Stadtgrößen sehr stark. Sie wird erst über die Hochzahl 0,448 gedämpft und dann noch einmal über die Jahresbremse (bis 0,40).
- Fundstelle: `:683`, `:622-640`
- Folge im Spiel: Frankfurt–Paris: Verflechtung 1960 → 2019 × 56, Nachfrage × 2,5. Ohne Jahresbremse wäre es × 6,1. Die Jahresbremse ist eine reine Spielregel ohne Bezug zur Wirklichkeit; sie steht im Code begründet (`:612-621`), aber nirgends für den Spieler sichtbar außer in der Debug-Anzeige.
- Vorschlag: Eine einzige Wachstumsregel festlegen (gewünschtes Verhältnis Nachfrage 2019 / 1960) und daraus eine Konstante machen.
- Braucht Entscheidung: ja (= O5)

### W9 · Umsteiger rechnen nach anderen Regeln als Direktgäste
- Befund: Der Umsteiger-Markt nutzt `calculateDemand` mit dem Strecken-Faktor, aber ohne regionale Ereignisse und ohne Streckenalter. Rivalen zählen dort nur mit Abflügen (ohne Preisnachlass und ohne Sitz-Grenze). Der Anteil gegen Rivalen nutzt die Zahl der Anschlüsse statt der Abflüge. Der Tarif ist 0,9 × Grundpreis ohne Schwierigkeit und ohne SAT. Geschwindigkeit fest 800 km/h (W1).
- Fundstelle: `src/lib/transferUtils.ts:327-331`, `:357-361`, `:367`, `:415` gegenüber `:1321-1328`, `:1371`, `:1413-1414`
- Folge im Spiel: In einer Region mit Krise (z. B. Faktor 0,7) bleiben Umsteiger voll, Direktgäste nicht. Ein Rivale im Preiskampf schreckt Direktgäste stärker ab als Umsteiger.
- Vorschlag: Eine gemeinsame Funktion „Markt zwischen O und D“ für Direkt- und Umsteiger-Rechnung. Tarif in Paket 1.3.
- Braucht Entscheidung: nein

### W10 · Spieler und KI rechnen denselben Markt verschieden
- Befund: Der Spieler rechnet seinen Anteil mit eigener SAT und eigenem Preis gegen Rivalen mit SAT 1 und KI-Preisnachlass. Die KI rechnet ihren Anteil gegen den Spieler mit Preis und SAT neutral (`playerOffers` ohne `priceAppeal`). Beide Rechnungen sind getrennt, die Anteile ergeben zusammen nicht 100 %.
- Fundstelle: `src/lib/aiSimulation.ts:768-773`, `:796-809`; `:1369-1378`, `:1425-1432`
- Folge im Spiel: Spieler mit SAT 130 und 10 % unter Marktpreis gegen eine KI mit gleich vielen Abflügen: Spieler rechnet sich 58,3 %, die KI rechnet sich 50 %, zusammen 108,3 %.
- Vorschlag: Je Markt einmal für alle Anbieter aufteilen (wie W3). Gehört zu Paket 1.6 (Bezug W10 aus 1.1).
- Braucht Entscheidung: nein

### W11 · Planer zeigt für neue Strecken volle Nachfrage
- Befund: Neue Strecken starten bei 60 % Nachfrage (mit Forschung 75 %). Der Planer rechnet die Vorschau mit der Strecken-ID des Entwurfs; die steht noch nicht in `mods.maturity`, also Faktor 1. Die Markt-Vorschau in Schritt 1 lässt das Streckenalter ebenfalls weg.
- Fundstelle: `src/lib/transferUtils.ts:605-615`, `:1325`; `src/components/RoutePlannerView.tsx:942-953`; `src/lib/routeMaturity.ts:17`
- Folge im Spiel: Planer rechnet z. B. mit 2 000 Gästen Nachfrage pro Woche; im ersten Monat sind es 1 200, nach drei Monaten 1 467. Der Hinweis „Ramping up“ erscheint erst in den Streckendetails nach dem Speichern (`src/components/RouteDetailView.tsx:233`).
- Vorschlag: Planer zeigt den Anlauf (erster Monat und volle Nachfrage).
- Braucht Entscheidung: nein

### W12 · Gleiche Namen für verschiedene Dinge („loyalty“, „market share“)
- Befund: „Loyalty“ heißt (a) Stammkunden-Zuschlag alter Strecken (+5 % Nachfrage, `routeMaturity.ts`) und (b) Vielflieger-Treue (bis +20 % Attraktivität, `marketing.ts`). „Market share“ heißt (a) Anteil an der Nachfrage aus der Attraktivität (`marketShare`) und (b) Anteil an den Abflügen in der Chronik (`departureMarketShare`).
- Fundstelle: `src/lib/routeMaturity.ts:20-24`, `:68`; `src/lib/marketing.ts:191-211`; `:1161`; `src/lib/chronicle.ts:81-101`, `src/lib/monthClose.ts:1257`
- Folge im Spiel: Chronik zeigt einen Marktanteil, der nichts mit dem gerechneten zu tun hat (Preis und SAT fehlen).
- Vorschlag: Eigene Namen festlegen (zusammen mit O4).
- Braucht Entscheidung: ja (= O4)

### W13 · Langstrecken ab etwa 12,6 h sind gleich
- Befund: Der Flugzeit-Faktor fällt linear von 2,75 (Index 1) und erreicht die Untergrenze 0,4 bei Index 7,71 (≈ 758 min). Der Index selbst endet bei 8 (810 min).
- Fundstelle: `:681`, `:246-255`
- Folge im Spiel: Ein 13-h-Flug und ein 20-h-Flug haben denselben Faktor. Zwischen Kurz- (45 min) und Langstrecke liegt ein Faktor 6,9.
- Vorschlag: Kurve in 2.2 / Balance-Skript bewusst festlegen.
- Braucht Entscheidung: ja (gewollte Kurve)

### W14 · Einweg-Flug zählt im Marktanteil wie ein Hin- und Rückflug
- Befund: Eigene Abflüge sind `schedule.length` (Anzahl Umläufe), egal ob Einweg oder Hin und Rück. Bei Rivalen gelten `departures` als Hin und Rück (Sitze × Abflüge × 2).
- Fundstelle: `:1248`, `:1383`, `:1376`
- Folge im Spiel: 7 Einweg-Umläufe zählen im Marktanteil wie 7 volle Umläufe, bringen aber nur halb so viele Sitze.
- Vorschlag: Abflüge je Richtung zählen.
- Braucht Entscheidung: nein

## Doppelte Rechnungen

- Saison-Tabelle zweimal: `:279` und `src/App.tsx:878` (`getBaseGlobalDemand`, Anzeige „globale Nachfrage“). Die Kopie kennt keine Südhalbkugel und keine regionalen Ereignisse.
- Markt-Nachfrage im Planer selbst zusammengesetzt (`calculateDemand` mit eigenem Faktor-Produkt): `src/components/RoutePlannerView.tsx:942-953`, gleichbedeutend mit `:1321-1328`, aber ohne Streckenalter (W11). Debug-Text der Formel nachgebaut: `src/components/RoutePlannerView.tsx:2171-2210`; zeigt die Zeitklasse in Stufen (`tc`), gerechnet wird mit dem gleitenden Index.
- Markt-Nachfrage für Umsteiger nochmals zusammengesetzt: `src/lib/transferUtils.ts:348-372` (W9).
- „Mittel beider Enden“ für Regionen dreimal einzeln programmiert: Werbung `src/lib/gameState.ts:517-519`, Ereignisse `src/lib/eventSystem.ts:347-348`, Saison `:285-291`. Gleiche Regel, keine Abweichung gefunden.
- Ruf-Faktor in der Firmenansicht aus derselben Funktion (`src/components/MyCompanyView.tsx:253`): keine Doppelung, nur Hinweis.
- Marktanteil zweimal mit verschiedener Bedeutung (W12): `:1161` und `src/lib/chronicle.ts:81`.

## Bezug zu bisherigen offenen Fragen

- O1 (Ruf neutral bei 75 oder 50): bestätigt, `src/lib/gameState.ts:427-429`. Weiter offen.
- O5 (Jahresbremse): siehe W8.
- O6 (Schwierigkeit an einer oder mehreren Stellen): Nachfrage `:660`, Preis `:479-483`, Treibstoff `:1624`, KI-Wirtschaft (W7). Siehe W6.
- 1.1 W8 (SAT wirkt dreifach) und W10 (Rivalen SAT 100): Im Marktanteil bestätigt (`:1428`, `:1371`). Dazu kommt W4 (Preis doppelt).

## Offene Fragen an den Menschen

1. Soll die Größe eines Markts von der Geschwindigkeit des eingesetzten Flugzeugs abhängen? Wenn langsame Flugzeuge schlechter sein sollen: lieber über den Marktanteil? (W1)
2. Preis: Soll ein niedriger Preis den Markt vergrößern, den Anteil gegen Rivalen erhöhen oder beides? (W4)
3. Klassen-Aufteilung: Sollen Premium, Business und First spürbar mit Geschäftsanteil und Flugzeit schwanken (heute Premium fast immer 9 %)? (W5)
4. Schwierigkeit: Soll „Normal“ überall neutral (Faktor 1) sein, und an welchen Stellen soll Schwierigkeit wirken? (W6, O6)
5. Wachstum: Wie stark soll die Nachfrage von 1960 bis heute wachsen (heute etwa × 2,5), und reicht dafür eine Regel statt zwei? (W8, O5)
6. Namen: Wie sollen Stammkunden-Zuschlag und Vielflieger-Treue sowie die zwei „Marktanteile“ heißen? (W12, O4)
7. Flugzeit: Soll die Nachfrage auch jenseits von 12,6 h weiter sinken, und wie groß soll der Unterschied Kurz- zu Langstrecke sein? (W13)
