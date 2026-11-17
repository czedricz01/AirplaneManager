# Bestand: Zufriedenheit (SAT)

Paket 1.1 · Stand 17.11.2026 · Commit 231d08b

Alle Fundstellen ohne Pfad liegen in `src/lib/financeUtils.ts`.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).
Standard-Beispiel: Flugzeug mit Typ-Beliebtheit 70, Kabinenwert 60, Kabinenzustand 100,
Flughäfen ohne Ausbau.

## Überblick

SAT sagt, wie gut ein Flug die Erwartung der Fluggäste einer Kabinenklasse erfüllt.
100 heißt „genau wie erwartet“. Je Klasse gilt:

```
SAT = 100 + Kabine + Service + Boden          (gekappt auf 0 … 160, gerundet)
    + Schalter-Überlast und Selbstbedienungs-Abzug   (beide Flughäfen, Summe)
    + Moral (±5) + Forschung (+2) − Ausfälle (bis −50)
```

Jeder Teil vergleicht „was geboten wird“ mit „was die Klasse bei dieser Flugdauer erwartet“.
Danach wirkt SAT an drei Stellen: auf den fairen Preis, auf den Marktanteil gegen
Konkurrenten und (über den Ruf) auf die Nachfrage aller Strecken.

## Größen

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Flugzeitklasse | Stufen 1–8 nach Minuten (<60, <120, <180, <240, <360, <540, <720, sonst 8) | `:222` | Flugdauer | Anzahl Mahlzeiten |
| Flugzeitindex | Gleitender Wert 1–8, Stützpunkte 30 min = 1 … 810 min = 8 | `:246`, `:250` | Flugdauer | Gewichte und Erwartungen in SAT |
| Typ-Beliebtheit (`popularity`) | Katalogwert − Alterung + Neuheitsbonus + Forschung, max. 100 | `src/lib/monthClose.ts:1536-1539`, `src/lib/research.ts:248` | Flugzeugtyp, Alter, Forschung | Kabinenwert |
| Alterung | −1 Punkt je Jahr ab Jahr 8, höchstens −15 | `src/lib/fleetCosts.ts:153-160` | Alter | Typ-Beliebtheit |
| Neuheitsbonus | +5, solange `launchBonusUntil` läuft | `src/lib/preorders.ts:31`, `src/lib/monthClose.ts:1536` | Vorbestellung | Typ-Beliebtheit |
| Innenausstattung je Klasse (`interiorByClass`) | Grundwert + Sitztyp × 2 + (Sitzabstand − Norm) × Faktor + Ausstattung + kabinenweite Extras | `src/components/ConfigurePurchaseView.tsx:402-484` | Kauf-/Umbau-Auswahl | Kabinenwert |
| Innenausstattung Durchschnitt (`baseInteriorPop`) | Sitzgewichteter Mittelwert der Klassen + kabinenweite Extras | `src/components/ConfigurePurchaseView.tsx:456-475` | wie oben | Kabinenwert (alte Flugzeuge, KI, Anzeigen) |
| Abnutzungsfaktor Kabine | 0,4 + 0,6 × Zustand/100 | `:499` | Kabinenzustand | Kabinenwert |
| Kabinenwert (`getPlaneSat`) | runden(0,33 × Beliebtheit + 0,67 × Innenausstattung × Abnutzungsfaktor) | `:510-524` | obige Größen, Klasse | Kabinen-Punkte |
| Kabinen-Punkte | 30 × tanh((Kabinenwert − Erwartung) × Gewicht / 30); Gewicht 0,5 + 0,1 × (Index − 1) | `:844-847` | Kabinenwert, Klasse, Index | SAT |
| Mahlzeiten je Flug | 1 bis Klasse 5, 2 bei Klasse 6–7, 3 bei Klasse 8 | `:834` | Flugzeitklasse | Service geliefert, Catering-Kosten (`:1396`) |
| Mahlzeit-Wert (`getCateringOpt`) | Mittelwert der Gerichte × (1 + 0,075 × (n − 1)); Kosten: Summe × (1 + 0,05 × (n − 1)) | `:371-425` | gewählte Gerichte | Service geliefert, Kosten |
| Extras / Bordservice | Summe der Punkte; je Gruppe (WLAN, Kits, Alkohol) nur die beste Stufe | `:432-469` | Auswahl | Service geliefert, Kosten |
| Service geliefert | Mahlzeiten-Punkte + Extras + Bordservice | `:850` | obige | Service-Punkte |
| Service erwartet | Grundwert + Wert je Index × (Index − 1), je Klasse | `:810-813` | Klasse, Index | Service-Punkte |
| Service-Punkte | Unter Erwartung: −Höchstabzug × (1 − geliefert/erwartet); darüber: 25 × (1 − e^−(Verhältnis − 1)) | `:819-827` | geliefert, erwartet, Klasse, Index | SAT |
| Höchstabzug Service | (6 + 9 × (Index − 1)) × Klassenfaktor (1 / 1,1 / 1,25 / 1,4) | `:822-823` | Index, Klasse | Service-Punkte |
| Bodengewicht | 1,2 − 0,1 × (Index − 1) | `:856` | Index | Boden-Punkte |
| Schalter-Abzug | Mittelwert beider Flughäfen von: kein Schalter −15; Premium ohne normalen Schalter −10; sonst 0; × Bodengewicht | `:535-539`, `:858-862` | Schalter, Klasse | Boden-Punkte |
| Lounge-Bonus | Summe beider Flughäfen: Business/First +4, Premium +1, Economy 0; × Bodengewicht | `:485-493`, `:863` | VIP-Lounge | Boden-Punkte |
| Stellplatz-Bonus | Mittelwert der Abdeckung (Stellplätze / Slots) beider Enden × 2; × Bodengewicht | `:584-604`, `:864` | Stellplätze, Slots | Boden-Punkte |
| Boden-Punkte | Schalter + Lounge + Stellplatz | `:865` | obige | SAT |
| SAT je Klasse (Grundwert) | runden(kappen(100 + Kabine + Service + Boden, 0, 160)) | `:867` | obige | SAT je Klasse auf Strecke |
| Schalterlast | Sitze aller eigenen Abflüge am Flughafen pro Woche / Kapazität (normal 5000, Selbst 10000) | `:141`, `:158-176`, `:553-572` | Strecken, Schalter | Schalter-Simulation |
| Schalter-Simulation (`getDeskSim().sat`) | −(Anteil Selbstbedienung) × 1 + Überlast (0 bis 80 %, dann −0,2 je %, ab 100 % −4 − 1,6 je %, höchstens −20) | `:547-551`, `:573-578` | Schalterlast, Schalterart | Überlast-Abzug |
| Überlast-Abzug | Summe der negativen `getDeskSim().sat` beider Flughäfen | `:937-939` | Schalter-Simulation | SAT je Klasse |
| SAT je Klasse auf Strecke (`getRouteClassSatisfaction`) | runden(kappen(Grundwert + Überlast-Abzug, 0, 160)) | `:909-962`, `:951` | obige, geprüfte Kabinen-Auswahl | Planer, Overlay, Wirtschaft |
| Moral-Zuschlag | (Moral − 50) × 0,1, also −5 … +5 | `src/lib/staff.ts:86-88`, `:160-162`, `src/lib/gameState.ts:475-476` | Personalmoral | SAT (`satDelta`) |
| Forschungs-Zuschlag | +2 („Cabin design studio“) | `src/lib/research.ts:142`, `src/lib/gameState.ts:491` | Forschung | SAT (`satDelta`) |
| Ausfall-Abzug | −(1 − geflogener Anteil) × 50 | `:1312` | Streik, Störungen | SAT |
| SAT in der Wirtschaft (`routeSat`) | runden(kappen(SAT auf Strecke + Moral + Forschung + Ausfall, 0, 160)) | `:1313-1316` | obige | Preis, Marktanteil, Ruf |
| SAT-Faktor (`getSatMultiplier`) | bis 100: SAT/100; 100–200: 1 + 0,008 × Ü − 0,000035 × Ü² (Ü = SAT − 100); über 200: 1,45 + 0,001 × (Ü − 100) | `:740-750` | SAT | fairer Preis |
| Fairer Preis (`satBase`) | Marktpreis × Schwierigkeits-Faktor × SAT-Faktor | `:1410-1414` | SAT, Strecke | Nachfrage über Preis (Paket 1.3) |
| Qualitäts-Anziehung | (SAT/100, gekappt 0,5 … 1,6)^0,8 | `:1122-1137`, `:1425-1429` | SAT | Marktanteil (Paket 1.2) |
| Strecken-SAT (Anzeige) | Sitzgewichteter Mittelwert der Klassen | `:965-975` | SAT je Klasse | Planer, Overlay, Streckendetails |
| Ruf-Anteil aus SAT | Passagiergewichtete SAT aller Strecken / 130 × 100, gekappt 0 … 100; Gewicht 0,65 im Ruf-Ziel | `src/lib/monthClose.ts:506-513`, `:145-160` | `routeSat`, Passagiere | Ruf (Paket 1.5) |

## Konstanten

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| `SAT_MAX` = 160 | Obergrenze jeder SAT | `:775` |
| Kabinen-Erwartung 55 / 60 / 68 / 80 | Kabinenwert, den Economy / Premium / Business / First voraussetzen | `:779` |
| Kabinengewicht 0,5 + 0,1 je Index | SAT-Punkte je Kabinenwert-Punkt | `:781` |
| Kabinen-Grenze 30 | Mehr als ±30 kann die Kabine nicht bewirken | `:783` |
| Service-Erwartung (Grund / je Index): 5/10, 12/14, 25/21, 40/33 | Bei Index 8: 75, 110, 172, 271 Punkte | `:788-793` |
| Service-Höchstabzug 6 + 9 je Index | Abzug, wenn gar nichts geboten wird | `:795` |
| Klassenfaktor Abzug 1 / 1,1 / 1,25 / 1,4 | Teure Klassen leiden mehr | `:797` |
| Service-Höchstgewinn 25 | Grenze für „mehr als erwartet“ | `:799` |
| Bodengewicht 1,2 − 0,1 je Index | Boden zählt bei langen Flügen weniger | `:801` |
| Ausfall-Abzug 50 | Bei komplett gestrichenem Flugplan | `:803` |
| 0,33 / 0,67 | Gewicht Typ-Beliebtheit / Innenausstattung im Kabinenwert | `:523` |
| 0,4 + 0,6 × Zustand | Abnutzung der Kabine | `:499` |
| +7,5 % SAT / +5 % Kosten je weiteres Gericht | Kombi-Mahlzeit | `:414-418` |
| −15 / −10 | Schalter-Abzug ohne Schalter / Premium nur Selbstbedienung | `:536-537` |
| +4 / +1 | Lounge Business+First / Premium, je Flughafen | `:490-491` |
| +2 | Stellplatz-Bonus bei voller Abdeckung | `:584` |
| 80 % / −20 | Schalterlast ab der es kostet / größter Überlast-Abzug je Flughafen | `:548-550` |
| −1 | Abzug bei nur Selbstbedienungs-Schaltern (anteilig) | `:576` |
| 5000 / 10000 | Wöchentliche Kapazität normaler / Selbstbedienungs-Schalter | `:141` |
| 0,1 je Moralpunkt, neutral bei 50 | Moral-Zuschlag | `src/lib/staff.ts:86-88` |
| +2 | Forschung „Cabin design studio“ | `src/lib/research.ts:142` |
| +0,01 Beliebtheit je Stufe (6 Stufen) | Forschung „Plane type satisfaction +1%“ | `src/lib/research.ts:100-164` |
| Alterung ab 8 Jahren, max. 15 | Beliebtheitsverlust | `src/lib/fleetCosts.ts:27-28` |
| +5 | Neuheitsbonus | `src/lib/preorders.ts:31` |
| 0,5 … 1,6, Hochzahl 0,8 | Kappung und Gewicht der SAT im Marktanteil | `:1133`, `:1136` |
| 130 | SAT, bei der der Ruf-Anteil voll ist | `src/lib/monthClose.ts:153` |
| 42 … 78 | Angenommene Innenausstattung der KI je Strategie | `src/lib/aiSimulation.ts:160-166` |
| Grundwerte Innenausstattung 50 (Eco), 70 (First) …, Sitzabstand-Faktoren 4 / … / 2,4 / 1,6, `FEATURE_POP`, `CABIN_EXTRA_POP`, Sitztyp × 2 | Formel des Kabinenwerts beim Kauf | `src/components/ConfigurePurchaseView.tsx:98-109`, `:402-452` |
| Gerichte, Extras, Bordservice (Punkte und Kosten) | Auswahl-Tabellen | `src/data/catering.ts:1-99` |

## Beispielwerte (nachgerechnet)

Economy, keine Flughafen-Ausstattung (also kein Schalter), Kabinenwert 63:

| Flugdauer | Index | Nichts geboten | Wasser + Softdrinks (4 $) | First, nichts geboten |
|---|---|---|---|---|
| 45 min | 1,25 | 78 (Kabine +4,2, Service −8,3, Boden −17,6) | 105 | 62 |
| 2 h | 2,5 | 70 | 86 | 46 |
| 6 h | 5,4 | 50 | 66 | 10 |
| 13,5 h | 8 | 33 (Service −69) | 48 | 0 |

SAT-Faktor: SAT 50 → 0,5; 80 → 0,8; 100 → 1; 120 → 1,146; 130 → 1,209; 160 → 1,354.

## Widersprüche und Auffälligkeiten

### W1 · Ein weiteres Gericht senkt die Zufriedenheit
- Befund: Der Mahlzeit-Wert ist der Mittelwert der Gerichte (mit kleinem Aufschlag), die Kosten sind die Summe. Ein billiges Gericht zu einem guten gelegt zieht den Wert nach unten.
- Fundstelle: `:407-418`
- Folge im Spiel: Wagyu (60 Punkte, 82,60 $) allein = 60. Wagyu + Butterkeks = 34,9 Punkte für 87,05 $. Schinkenbrot (8) + zwei Snacks = 6,9. Mehr bieten wird bestraft.
- Vorschlag: Wert eines Mehrgang-Menüs als Summe mit abnehmendem Zusatznutzen (z. B. bestes Gericht voll, weitere anteilig).
- Braucht Entscheidung: ja

### W2 · Sprung bei 6 Stunden Flugzeit (Mahlzeiten-Anzahl)
- Befund: Die Erwartung an Service steigt gleitend mit dem Index, die Zahl der Mahlzeiten aber in Stufen nach der Flugzeitklasse (1 / 2 / 3). Bei 360 Minuten kommt plötzlich eine zweite Mahlzeit hinzu (SAT und Kosten springen).
- Fundstelle: `:834`, `:1396`
- Folge im Spiel: Economy mit zwei hinterlegten Schinkenbroten: 359 min → SAT 58, 360 min → SAT 65. Eine Minute mehr Flugzeit, 7 Punkte mehr und doppelte Mahlzeit-Kosten. Ist nur eine Mahlzeit hinterlegt, ändert sich nichts, weil die zweite als „keine“ zählt.
- Vorschlag: Mahlzeiten-Anzahl gleitend gewichten oder Erwartung in denselben Stufen führen.
- Braucht Entscheidung: nein (Umsetzungsfrage), ggf. Teil von 2.2

### W3 · Die beiden Flughäfen werden unterschiedlich zusammengezählt
- Befund: Schalter-Abzug und Stellplatz-Bonus nehmen den Mittelwert beider Enden, Lounge-Bonus und Überlast-Abzug die Summe. Überlast wird außerdem nicht mit dem Bodengewicht verkleinert, die anderen Bodenteile schon.
- Fundstelle: `:862` (Mittel), `:863` (Summe), `:864` (Mittel), `:939` (Summe, ohne Bodengewicht)
- Folge im Spiel: Lounge an beiden Enden bringt Business auf 45 min +9,4 Punkte, Stellplätze an beiden Enden nur +2,35. Überlast an beiden Enden kostet bis −40 auch auf einem 13-Stunden-Flug, ein fehlender Schalter dort nur −7,5.
- Vorschlag: Eine Regel für „zwei Enden“ (Mittelwert) und eine Regel für Bodengewicht (gilt für alle Bodenteile).
- Braucht Entscheidung: ja

### W4 · Selbstbedienung kostet Economy doch etwas
- Befund: `getDeskPenalty` sagt ausdrücklich, Economy störe Selbstbedienung nicht. `getDeskSim` zieht aber zusätzlich den Anteil der Selbstbedienungs-Schalter ab (bis −1 je Flughafen), und dieser Wert landet über den Überlast-Abzug in jeder Klasse.
- Fundstelle: `:531-533` (Kommentar), `:575-577`, `:939`
- Folge im Spiel: 1 normaler + 1 Selbstbedienungs-Schalter an beiden Enden → −1 SAT in allen Klassen, auch Economy, ohne jede Überlast. Klein, aber versteckt und widersprüchlich.
- Vorschlag: Abzug entfernen oder in `getDeskPenalty` an einer Stelle regeln.
- Braucht Entscheidung: nein

### W5 · Planer zeigt eine andere SAT als die Wirtschaft rechnet
- Befund: Schritt 3 des Planers und das Kabinen-Overlay nutzen `getRouteClassSatisfaction` (ohne Moral, Forschungs-Bonus und Ausfälle). Preis-Schritt und Monatsabschluss nutzen `routeSat` aus `calculateRouteFinancials` (mit diesen Zuschlägen).
- Fundstelle: `src/components/RoutePlannerView.tsx:964`, `:3042`, `:3109`, `:3890` gegenüber `:3600`; Zuschläge `:1313-1316`
- Folge im Spiel: Moral 100 + Forschung → Planer zeigt z. B. 100 %, gerechnet wird mit 107 %. Bei Streik ist die Abweichung noch größer.
- Vorschlag: Eine Funktion liefert die endgültige SAT; Anzeigen zeigen nur diese (mit Aufschlüsselung).
- Braucht Entscheidung: nein

### W6 · Mehrfaches Kappen und Runden
- Befund: SAT wird dreimal auf 0 … 160 gekappt und gerundet: nach dem Grundwert, nach der Überlast, nach Moral/Forschung/Ausfall. Der Kabinenwert wird vorher schon auf ganze Zahlen gerundet.
- Fundstelle: `:523`, `:867`, `:951`, `:1316`
- Folge im Spiel: Eine Kabine, die roh bei 180 läge, wird erst auf 160 gekappt und verliert dann die Überlast voll (160 − 20 = 140 statt 160). Kleine Verbesserungen (z. B. Forschung +1 Beliebtheit = +0,33 Kabinenwert) verschwinden im Runden.
- Vorschlag: Intern ungerundet rechnen, einmal am Ende kappen; Runden nur für die Anzeige.
- Braucht Entscheidung: nein

### W7 · Drei verschiedene „Obergrenzen“ der SAT
- Befund: SAT ist bei 160 gekappt. Der Ruf zählt SAT nur bis 130. Der SAT-Faktor ist für Werte bis über 200 gebaut (ein Zweig über 200 wird nie erreicht). Die Debug-Anzeige erklärt den Zweig „bis 200“.
- Fundstelle: `:775`, `src/lib/monthClose.ts:152-153`, `:740-750`, `src/components/RoutePlannerView.tsx:3615`
- Folge im Spiel: SAT 130 → 160 erhöht den fairen Preis von 1,209 auf 1,354, nützt dem Ruf aber nichts. Toter Code im SAT-Faktor.
- Vorschlag: Eine Skala mit klaren Ankern festlegen (z. B. 100 = erwartet, 160 = Spitze) und alle Wirkungen daran ausrichten.
- Braucht Entscheidung: ja

### W8 · SAT wirkt dreifach
- Befund: Höhere SAT hebt (1) den fairen Preis, (2) den Marktanteil gegen Konkurrenten, (3) über den Ruf die Nachfrage aller Strecken. Der Code hat frühere Doppelungen schon entfernt (`:1422-1424`, `:998-1000`), diese drei bleiben.
- Fundstelle: `:1414`, `:1425-1429`, `src/lib/monthClose.ts:506-513`
- Folge im Spiel: Eine Verbesserung um 20 SAT-Punkte wirkt auf Erlös, Anteil und Ruf zugleich. Ob das gewollt ist, ist nirgends festgehalten.
- Vorschlag: In der Spezifikation festlegen, über welche Wege SAT wirken soll und wie stark jeweils.
- Braucht Entscheidung: ja

### W9 · Unter 100 ist SAT ein harter Preis-Hebel
- Befund: Bis SAT 100 ist der SAT-Faktor einfach SAT/100: SAT 50 halbiert den fairen Preis. Darüber flacht er ab.
- Fundstelle: `:741`
- Folge im Spiel: Kurzstrecke 45 min, Economy: ohne alles SAT 78 (Faktor 0,78), mit Wasser + Softdrinks (4 $ je Gast) SAT 105 (Faktor 1,04). Bei 52 $ Grundpreis steigt der faire Preis von 40,6 $ auf 54 $, also +13 $ für 4 $ Kosten. Ein fehlender Schalter kostet hier allein −17,6 SAT (≈ −18 % fairer Preis).
- Vorschlag: Kurve und Stärke der Abzüge gemeinsam in der Spezifikation festlegen (Balance-Skript 3.9).
- Braucht Entscheidung: ja

### W10 · Konkurrenten haben im Marktanteil immer SAT 100
- Befund: Rivalen-Angebote tragen nur Abflüge und Preisnachlass. Ihre Qualität geht mit 1 (= SAT 100) in den Marktanteil ein, obwohl die KI eigene Kabinen-Ausstattung und eigene SAT-Rechnung hat. Eigene Parallelstrecken ebenso.
- Fundstelle: `:1371`, `:1384`, `src/lib/monthClose.ts:191-201`, `src/lib/aiSimulation.ts:295-330`
- Folge im Spiel: Eine Boutique-KI mit Luxus-Service zählt im Wettbewerb gleich wie ein Billigflieger.
- Vorschlag: Rivalen-SAT mitgeben (gehört auch zu Paket 1.6).
- Braucht Entscheidung: nein (Umsetzung), Gewicht ja (mit W8)

### W11 · KI-Langstrecken haben nur eine Mahlzeit
- Befund: Die KI-Ausstattung hinterlegt nur eine Mahlzeit (`[['b15']]`). Auf Flügen ab 6 h zählen die zweite und dritte als „keine“.
- Fundstelle: `src/lib/aiSimulation.ts:298-310`, `:834`
- Folge im Spiel: KI-Langstrecken haben deutlich weniger SAT als geplant; trifft deren Erlös (Paket 1.6).
- Vorschlag: KI-Ausstattung je Mahlzeit füllen.
- Braucht Entscheidung: nein

### W12 · Forschung „Plane type satisfaction +1%“ bringt weniger als angezeigt
- Befund: Die Stufen heben die Typ-Beliebtheit um 1 Punkt. Die geht nur zu 33 % in den Kabinenwert ein, der wiederum mit 0,5 … 1,2 in SAT. Ergebnis: +0,2 … +0,4 SAT, durch Runden (W6) oft 0.
- Fundstelle: `src/lib/research.ts:100`, `:112`, `:127`, `:141`, `:157`, `:164`; `:523`
- Folge im Spiel: Der Text verspricht „+1 %“ Zufriedenheit; die Wirkung ist kaum messbar.
- Vorschlag: Text an Wirkung anpassen oder Wirkung direkt als SAT-Punkte geben (wie „Cabin design studio“).
- Braucht Entscheidung: ja (welche Wirkung gewollt ist)

### W13 · Fünf Dinge heißen „SAT“
- Befund: „SAT“ steht für (a) die Typ-Beliebtheit (Forschungs-Texte „Plane type satisfaction“), (b) den Kabinenwert 0–100 (Planer: „63% SAT“, Flottenansicht: „Satisfaction 63%“), (c) Punkte der Gerichte/Extras (`sat` in `catering.ts`), (d) SAT je Klasse 0–160 mit 100 = erwartet, (e) die sitzgewichtete Strecken-SAT. Die Skalen sind verschieden.
- Fundstelle: `src/components/RoutePlannerView.tsx:1899`, `src/components/MyFleetView.tsx:660`, `src/data/catering.ts:1`, `:775`, `:965`, `src/components/InfoTooltip.tsx:95-101`
- Folge im Spiel: Ein Flugzeug mit „63% SAT“ kann auf einer Strecke 105 % SAT haben. Für Spieler nicht durchschaubar.
- Vorschlag: Eigene Namen (siehe offene Frage O4).
- Braucht Entscheidung: ja (= O4)

### W14 · Kein Schalter = harter Abzug auch für Economy
- Befund: Ohne jeden Schalter verliert jede Klasse −15 × Bodengewicht (bis −18), auch wenn der Spieler nur fehlende Flughafen-Daten hat (leere Verwaltung zählt als „kein Schalter“).
- Fundstelle: `:536`, `:858-862`
- Folge im Spiel: Auf Kurzstrecke der größte Einzelposten (−17,6 im Beispiel), größer als jede Kabinen-Wirkung (+4,2). Ob Schalter Pflicht oder Option sein sollen, ist offen.
- Vorschlag: Festlegen, ob Fliegen ohne Schalter überhaupt möglich sein soll; dann Abzug passend wählen.
- Braucht Entscheidung: ja

### W15 · Altes Format der Mahlzeiten wird mehrfach gezählt
- Befund: Ist die Mahlzeit-Auswahl eine flache Liste (`['b15']` statt `[['b15']]`), ignoriert `getCateringOpt` die Mahlzeit-Nummer und zählt dieselbe Auswahl für jede Mahlzeit.
- Fundstelle: `:375-378`
- Folge im Spiel: Nur bei alten Spielständen denkbar; Langstrecke bekäme 2–3 volle Mahlzeiten aus einer Auswahl. Ob solche Daten noch vorkommen, ist ungeprüft.
- Vorschlag: In Paket 5.1 (Spielstand-Umwandlung) auf ein Format bringen.
- Braucht Entscheidung: nein

## Doppelte Rechnungen

- Kabinenwert-Formel (Grundwerte, Sitzabstand, Ausstattung) steht nur in der Oberfläche: `src/components/ConfigurePurchaseView.tsx:402-484`. Ein Modell-Teil in einer Ansicht (für Paket 1.8).
- Mahlzeiten-Anzahl `timeClass <= 5 ? 1 : timeClass <= 7 ? 2 : 3` steht zweimal: `:834` (SAT) und `:1396` (Kosten).
- SAT-Faktor-Rechnung in der Debug-Anzeige nachgebaut (Text der Formel, Grenze „200“): `src/components/RoutePlannerView.tsx:3600-3615`. Der Wert selbst kommt aus `getSatMultiplier`, der erklärende Text ist eine Kopie.
- Planer-Werte aus zwei Quellen (W5): `classSat` (`src/components/RoutePlannerView.tsx:964`) und `financials.routeSat`.
- Kabinenwert ohne Klasse (Durchschnitt) für Anzeigen, mit Klasse für die Wirtschaft: `src/components/MyFleetView.tsx:127`, `:185`, `:578`, `src/components/AircraftDetailsModal.tsx:47`, `src/components/RoutePlannerView.tsx:2997` gegenüber `:844`. Kein Rechenfehler, aber zwei Zahlen für „dasselbe“ Flugzeug.
- Schon vereinheitlicht (laut Code-Kommentaren): Strecken-SAT sitzgewichtet überall (`:965`, `src/components/RouteDetailView.tsx:401`, `src/components/RouteConfigOverlay.tsx:66-69`); Service-Erwartung im Overlay aus `expectedServicePoints` (`src/components/RouteConfigOverlay.tsx:63`).

## Bezug zu bisherigen offenen Fragen

- O3 (Gewichtung der Strecken-SAT): Anzeige ist sitzgewichtet (`:965`), der Ruf passagiergewichtet (`src/lib/monthClose.ts:506-513`). Weiter offen.
- O4 (eigene Namen): bestätigt, siehe W13.
- O6 (Schwierigkeit): Auf SAT wirkt sie nicht mehr (`:479-483`, `:915`); sie wirkt auf Preis und Nachfrage (Paket 1.2/1.3).

## Offene Fragen an den Menschen

1. Mehrgang-Menü: Soll ein zusätzliches Gericht immer etwas bringen (Summe mit abnehmendem Nutzen) statt den Durchschnitt zu senken? (W1)
2. Zwei Flughäfen: Überall Mittelwert beider Enden, und gilt das Bodengewicht (Boden zählt auf Langstrecke weniger) auch für Überlast? (W3)
3. Welche Skala soll SAT haben: Obergrenze 160, und soll der Ruf bis zur Obergrenze mitwachsen statt bei 130 aufzuhören? (W7)
4. Über welche Wege soll SAT wirken: Preis, Marktanteil, Ruf – alle drei oder weniger? (W8)
5. Wie stark soll SAT unter 100 den Preis drücken (heute: SAT 50 = halber Preis)? (W9)
6. Sollen Check-in-Schalter Pflicht sein, oder ist Fliegen ohne Schalter erlaubt und nur abgewertet? (W14)
7. Forschung „Plane type satisfaction“: Text anpassen oder Wirkung erhöhen? (W12)
