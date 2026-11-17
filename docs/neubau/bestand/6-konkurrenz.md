# Bestand: Konkurrenz (KI)

Paket 1.6 · Stand 17.11.2026 · Commit a131e57

KI = `src/lib/aiSimulation.ts`. Monat = `src/lib/monthClose.ts`. Andere Dateien mit Pfad.
Beispielzahlen sind mit dem echten Code nachgerechnet (Hilfsskript, nicht im Projekt).
Die Läufe über mehrere Jahrzehnte sind zufällig; die Zahlen zeigen die Größenordnung, nicht
einen festen Wert.

## Überblick

Die Konkurrenz sind 6 (Voreinstellung) KI-Fluggesellschaften. Jede hat ein Drehkreuz, eine
Persönlichkeit (Flag, LCC, Expansionist, Optimizer, Boutique), eine Schwierigkeit und eine Kasse.
Einmal im Monat, nach dem Spieler, „spielt“ jede KI einen Monat: Sie bucht ihre Strecken mit
demselben Rechenkern wie der Spieler (`calculateRouteFinancials`), passt Flüge an, streicht
Verlust-Strecken, kauft Flugzeuge und eröffnet Strecken. Ihre Strecken wirken auf den Spieler
als Wettbewerb um Fluggäste. Eine KI mit langer Pleite steht zum Verkauf; der Spieler kann sie
ab Rang 6 kaufen.

Rechenweg in einem Bild:

```
Spielstart: generateAiAirlines (KI:679-744)
  Wer: echte Gesellschaften des Startjahrs + erfundene, nie am Spieler-Drehkreuz  KI:607-658
  Kasse: 50 / 80 / 120 Mio. $ (Easy/Normal/Hard) × Persönlichkeit ± 3 Mio. $      KI:700-707
  Flotte: 2 / 3 / 4 Flugzeuge, keine Strecken                                    KI:710-720

Monatsabschluss (Monat:826-863) → simulateAiAirlinesTurn (KI:746-1228), je KI:
  1  Monat buchen   je Strecke: Rechenkern × 4 Wochen                              KI:814-854
     Monatsergebnis = Σ Strecken − Flugzeug-Unterhalt + Zuschuss                   KI:864
     Kasse          = Kasse + Monatsergebnis − (0,5 % Pech: 20–70 Mio. $)          KI:865-873
  1a Preiskampf     −12 % auf Strecken, die der Spieler auch fliegt               KI:892-905
  1b Krise          Flüge kürzen bis 80 % Auslastung, später zurück                KI:911-944
  2  Verlierer      erst ausdünnen (40 %), sonst streichen                          KI:950-976
  3  Feinabstimmung ±25 % Flüge, wenn die Vorhersage besser ist                     KI:982-1001
  4  Modernisieren  ein altes Flugzeug durch neues derselben Klasse                 KI:1006-1031
  5  Notverkauf     Kasse < 0: ein Flugzeug verkaufen                               KI:1035-1044
  6  Leerlauf       freie Flugzeuge auf die beste Strecke (Vorhersage > 0)          KI:1050-1105
  7  Wachsen        Flugzeug kaufen, wenn alles fliegt und Slots frei sind          KI:1111-1168
  8  2. Drehkreuz   4 % Chance ab 8 Flugzeugen und 100 Mio. $                       KI:1173-1190
  9  Notlage        6 Monate Kasse < 0 → zum Verkauf; 12 Monate später aufgelöst    KI:1195-1210
  danach: fehlt eine KI, mit 15 % je Monat eine neue gründen                      Monat:849-860

Wirkung auf den Spieler
  Rivalen-Angebote (Abflüge, Sitze, Preiskampf) → Marktanteil (Paket 1.2)        Monat:191-205
  Landegebühren an eigenen Stufe-3-Flughäfen (Paket 1.4)                          Monat:561
  Übernahme (src/lib/takeover.ts), Rang im Ticker nach Kasse                       Monat:1393
```

## Größen

### Gründung

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Anzahl | Spieler-Einstellung (Voreinstellung 6) oder Szenario | `src/App.tsx:404`, `:1593`, `:1654` | Neues Spiel | Gründung, Nachrücken |
| Echte / erfundene | 1 KI: 40 % erfunden; sonst 30–50 % erfunden, mindestens 1 | KI:620-623 | Zufall | Auswahl |
| Echte Gesellschaft | nur im Startjahr aktiv, nur an ihrem echten Drehkreuz; nie am Spieler-Drehkreuz; gewichtet nach √(Nachfrage am Drehkreuz) | KI:625-637; `src/data/rivalAirlines.ts` | Jahr, Spieler-Drehkreuz | Name, Drehkreuz, Persönlichkeit |
| Erfundene Gesellschaft | Drehkreuz unter freien Flughäfen ab Stufe 4 (sonst 2), gewichtet nach Nachfrage; Persönlichkeit zufällig reihum | KI:642-655 | Jahr | Name, Drehkreuz, Persönlichkeit |
| Persönlichkeiten echter Gesellschaften | Flag 56, Optimizer 25, LCC 19, Boutique 15, Expansionist 14 | `src/data/rivalAirlines.ts` | – | Auswahl |
| Startkasse | Basis (Easy 50, Normal 80, Hard 120 Mio. $) × Persönlichkeit (Flag 1,25 · Boutique 1,12 · Expansionist 0,94 · LCC 0,88 · Optimizer 1) ± 3 Mio. $ | KI:700-707 | Schwierigkeit, Persönlichkeit | Kasse |
| Startflotte | Easy 2, Normal 3, Hard 4 Flugzeuge; das erste Narrowbody (Easy: Regional), die anderen Regional; Typ nach Persönlichkeit bewertet ± Zufall | KI:661-677, :710-715 | Schwierigkeit, Startjahr | Flotte |
| Kabine | Anteile Economy/Premium/Business/First je Persönlichkeit; Rest an Economy | KI:202-222 | Persönlichkeit | Erlös, SAT |
| Angriffslust (`aggression`) | Expansionist 9, LCC 8, Flag 6, Boutique 5, Optimizer 4 | KI:93 | Persönlichkeit | Preiskampf, Geduld, 2. Drehkreuz |
| KI-Schwierigkeit | eine Stufe für alle KI, gewählt beim Spielstart | KI:691, :729 | Einstellung | alles unten |
| Nachrücken | KI weniger als Anzahl: je Monat 15 % Chance auf eine neue KI mit denselben Startwerten (nominal) | Monat:849-860 | Zufall | Anzahl |

### Monat buchen

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| KI-Flugzeug für den Rechenkern | Sitze, Effizienz, Beliebtheit aus dem Datenblatt; Innenausstattung fest je Persönlichkeit (42–78); Zustand aus dem Flugzeug (immer 100) | KI:160-195 | Persönlichkeit | SAT, Kosten |
| KI-Service | eine Mahlzeit, Extras, Service je Klasse und Persönlichkeit (LCC: nichts) | KI:287-334 | Persönlichkeit | SAT, Verpflegungskosten |
| KI-Preise | Grundpreis × Faktor je Klasse: Easy 2,25–2,50 · LCC 0,82–1 · Flag 1,05–1,18 · Boutique 1,02–1,35 · Optimizer 1,04–1,06 · Expansionist 0,92–1 | KI:337-352 | Persönlichkeit, Schwierigkeit | Erlös, Auslastung |
| KI-Flughäfen | Abflug wie Verwaltungsstufe 3, Ziel wie Stufe 2, je 100 Slots und Abstellplätze, 10 bzw. 5 Schalter | KI:410-423 | – | Gebühren (× 0,85 bzw. 0,95), Schalter-SAT |
| Strecken-Ergebnis | `calculateRouteFinancials` mit KI-Schwierigkeit, Ruf-Faktor 1, ohne Spieler-Wirkungen (`mods`); Wochengewinn × 4, abgerundet | KI:385-452 | alles oben, Rivalen-Angebote | Monatsgewinn |
| Auslastung | Fluggäste / Sitze je Woche, höchstens 1 | KI:445-447 | Strecken-Ergebnis | Krise |
| Reichweite überschritten | Strecke bucht −150 000 $ | KI:842-843 | Flugzeug | Monatsgewinn |
| Geglätteter Gewinn (`avgProfit`) | 0,65 × alt + 0,35 × neu | KI:852 | Strecken-Ergebnis | Verlierer, Preiskampf, Notverkauf |
| Flugzeug-Unterhalt | `fleetOwnershipCost` wie beim Spieler (Versicherung, Wartung; abgestellte zur Hälfte) | KI:858-863; `src/lib/fleetCosts.ts:124-145` | Flotte | Monatsergebnis |
| Zuschuss | 450 000 $ bis 1985, dann linear auf 150 000 $ bis 2005 | KI:47-65 | Monat | Monatsergebnis |
| Monatsergebnis | Σ Strecken − Unterhalt + Zuschuss | KI:864 | obige | Kasse, Verlauf (12 Monate) |
| Rückschlag | je Monat 0,5 %: 20–70 Mio. $ Verlust (nominal) | KI:76-79, :869-873 | Zufall | Kasse |
| Rivalen-Angebote aus KI-Sicht | Spieler-Strecken (Abflüge, Sitze) + alle anderen KI (Abflüge, Sitze), ohne Preiskampf | KI:768-810 | Spieler, andere KI | Marktanteil der KI |
| Treibstoffpreis | `getJetFuelPrice` mit KI-Schwierigkeit (Hard × 1,15) | KI:793 | Jahr, Ereignisse, KI-Schwierigkeit | Kosten |

### Entscheidungen

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Höchste Umläufe je Flugzeug | abrunden(7 × 18 h / Blockzeit eines Umlaufs), 1–21 | KI:105-108, :281-285 | Flugdauer, Klasse | alle Fahrpläne |
| Drehkreuz-Slots | Flughafen-Stufe × 40 Abflüge je Woche, minus Abflüge aller eigenen Strecken von dort | KI:141, :879-883 | Flughafen-Stufe | Wachstum, Feinabstimmung, Krise |
| Ziel-Vorauswahl | √(Nachfrage Drehkreuz × Nachfrage Ziel, nach Persönlichkeit gewichtet) × min(1, km / (0,2 × Reichweite)) × (LCC über 3 500 km 0,4) / (1 + Rivalen-Abflüge / 14) | KI:503-521 | Flughäfen, Rivalen | Strecken-Plan |
| Suchbreite | beste 4 / 8 / 12 (Easy/Normal/Hard) + 2 zufällige | KI:114, :525-530 | Schwierigkeit | Strecken-Plan |
| Strecken-Plan | je Ziel 100 %, 60 %, 30 % der Höchst-Umläufe durch den Rechenkern; bester (verrauschter) Gewinn | KI:532-554 | Rechenkern | Eröffnung, Kauf |
| Schätzfehler | Gewinn ± Zufall × 40 % / 10 % / 0 % (Easy/Normal/Hard) | KI:120, :547 | Schwierigkeit | Strecken-Plan |
| Preiskampf | Angriffslust ≥ 7 (LCC, Expansionist), Strecke ≥ 2 Monate, Gewinn > 0, Spieler fliegt dasselbe Paar: Preise × 0,88; endet, wenn der Spieler geht oder `avgProfit` < 0 | KI:72-73, :892-905 | Spieler-Strecken | KI-Erlös, Spieler-Marktanteil |
| Krisenstärke | max(1 − Nachfrage-Faktor, (Treibstoff-Faktor − 1) / 2) der weltweiten Ereignisse, 0–1 | `src/lib/rivalCrisis.ts:20-23` | Ereignisse | Krise, Wachstumsstopp |
| Krise | ab Stärke 0,25 | `src/lib/rivalCrisis.ts:30` | Krisenstärke | Krisen-Fahrplan |
| Krisen-Fahrplan | Auslastung < 0,8: Flüge × Auslastung / 0,8; ≥ 0,95: + 25 % des alten Plans; nach der Krise + 25 % je Monat bis zum alten Plan | `src/lib/rivalCrisis.ts:52-85`; KI:914-944 | Auslastung | Abflüge |
| Wachstumsstopp | Stärke ≥ 0,25 (Flag, Optimizer, Boutique), ≥ 0,35 (LCC), ≥ 0,5 (Expansionist): kein Kauf, keine Modernisierung, kein 2. Drehkreuz, Leerlauf-Uhr steht | `src/lib/rivalCrisis.ts:39-49`; KI:1014, :1098, :1122, :1175 | Persönlichkeit | Wachstum |
| Geduld | Monate bis zum Urteil: Optimizer 3, LCC 4, Expansionist 5, Flag 6, Boutique 6; + (Angriffslust − 6), wenn positiv | KI:126, :950 | Persönlichkeit | Verlierer |
| Verlierer | `avgProfit` < 0 nach Geduld; je Monat 1 (Hard 2), die schlechtesten; erst auf 40 % der Flüge, wenn das Gewinn bringt, sonst streichen (mindestens 2 Strecken bleiben) | KI:133, :951-976 | Gewinn | Netz |
| Feinabstimmung | nicht Easy; Normal jeden zweiten Monat zufällig; ± max(1, 25 %) Flüge, behalten, wenn Vorhersage um > 2 % besser | KI:982-1001 | Rechenkern | Abflüge |
| Modernisierung | erstes Flugzeug > 20 Jahre oder > 12 Jahre nach Bauende; Ersatz: beliebtester Typ derselben Klasse, der die Strecke schafft und bezahlbar ist; altes bringt 20 % Listenpreis | KI:1006-1031 | Alter, Kasse | Flotte, Kasse |
| Notverkauf | Kasse < 0 und > 1 Flugzeug: ein freies, sonst das der schlechtesten Verlust-Strecke; Erlös `getAircraftResaleValue` ohne Alter | KI:1035-1044 | Kasse | Flotte, Kasse |
| Eröffnung | freie Flugzeuge, je Monat 1 (Hard 2), Kasse ≥ 1,5 Mio. $; Vorhersage > 0 (Easy: jede, aber nur jeder zweite Versuch); kostet 1,5 Mio. $ | KI:96, :1050-1089 | Strecken-Plan | Netz, Kasse |
| Leerlauf-Verkauf | 6 Monate ohne Strecke → ein Flugzeug verkaufen (ohne Alter) | KI:144, :1095-1105 | Leerlauf | Flotte, Kasse |
| Kaufneigung | Hard 0,85 · Normal 0,45 · Easy 0,12; × 1,35 Expansionist (höchstens 0,9), × 1,25 LCC (höchstens 0,85), × 0,7 Optimizer, × 0,6 Boutique | KI:1111-1115 | Schwierigkeit, Persönlichkeit | Kauf |
| Kauf | alle Flugzeuge fliegen, Slots frei, kein Stopp; Preis ≤ 45 % (LCC, Expansionist 65 %) der Kasse und Preis + 1,5 Mio. $ ≤ Kasse − Reserve (5 bzw. 10 Mio. $); ohne Gewinn der letzten 3 Monate nur, wenn Preis ≤ Kasse / 3; aus 3 Lieblingstypen der mit dem besten Strecken-Gewinn / Preis | KI:147-149, :1117-1167 | Kasse, Gewinn | Flotte, Netz |
| Easy-Kabine | gekaufte Flugzeuge der Easy-KI: 85 % First oder 50 % Premium + 38 % Business | KI:228-239, :1149-1151 | Schwierigkeit | Erlös |
| 2. Drehkreuz | Angriffslust ≥ 5, ≥ 8 Flugzeuge, ≥ 100 Mio. $, 4 % je Monat; Flughafen ab Stufe 3 weltweit, gewichtet nach Nachfrage × (Spieler-Drehkreuz 3) × Angriffslust / 6; kostet 5 Mio. $ | KI:82-85, :1173-1190 | Größe, Kasse | Netz, Slots |
| Notlage-Zähler | Kasse < 0: + 1, sonst − 1 (nicht unter 0) | KI:1195 | Kasse | Verkauf |
| Zum Verkauf | Zähler ≥ 6; zurück, wenn Zähler 0 und Kasse > 0 | KI:68, :1198-1206 | Zähler | Übernahme |
| Auflösung | 12 Monate zum Verkauf → KI verschwindet mit Flotte | KI:69, :1207-1210, :1227 | Zeit | Anzahl |

### Wirkung auf den Spieler

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Rivalen-Angebote | je KI-Strecke: Abflüge, Sitze des Flugzeugs, Preis-Reiz 1 / (1 − Nachlass) bei Preiskampf | Monat:191-205; `src/App.tsx:581` | KI-Strecken | Spieler-Marktanteil (1.2), Überlauf |
| Zeitpunkt | Spieler rechnet seinen Monat mit den KI-Strecken vom Monatsbeginn; die KI danach mit den Spieler-Strecken desselben Monats | Monat:466, :826-845 | Reihenfolge | beide Monate |
| Sperre | Flughäfen mit Spieler-Stufe 3: keine neuen KI-Strecken, kein 2. Drehkreuz | KI:1048-1051, :1064, :1181; `src/lib/hubOwnership.ts:76-78` | Verwaltung | KI-Netz |
| Einnahme eigener Flughafen | KI-Landungen × 4 × Gebühr × 0,5 (Paket 1.4) | Monat:561; `src/lib/hubOwnership.ts:30-73` | KI-Strecken | Spieler-Gewinn |
| Ticker-Rang | 1 + Anzahl KI mit mehr Kasse als der Spieler | Monat:1393 | Kassen | Anzeige |
| Meldungen | Preiskampf, Kapazitätskürzung, Streckenende und 2. Drehkreuz nur, wenn das Spieler-Drehkreuz betroffen ist; Verkauf, Erholung, Auflösung, Rückschlag (nur ins Minus), Modernisierung, neue KI immer | KI:764, :872, :901, :939, :974, :1029, :1187, :1201-1209; Monat:853-858 | Ereignisse | Postfach |

### Übernahme (`src/lib/takeover.ts`)

| Größe | Formel (vereinfacht) | Fundstelle | Hängt ab von | Wirkt auf |
|---|---|---|---|---|
| Flottenwert | Σ `getAircraftResaleValue` (Zustand, **ohne Alter**) | `src/lib/takeover.ts:38-42` | KI-Flotte | Preis |
| Preis zum Verkauf | Flottenwert × 0,8 + 250 000 $ je Strecke, mindestens 1 Mio. $, auf 50 000 $ gerundet | `src/lib/takeover.ts:21-25`, `:43-44` | Flotte, Strecken | Kasse |
| Preis gesund | obiger Preis × 2,5 | `src/lib/takeover.ts:23`, `:44` | obige | Kasse |
| Rang-Sperre | zum Verkauf: Rang 6 (International); gesund: Rang 9 (Global Player) | `src/lib/takeover.ts:45-49`; `src/lib/airlineRank.ts:194-196` | Rang | Kauf möglich |
| Was der Spieler bekommt | alle Flugzeuge (Alter und Zustand bleiben, einfache Economy-Kabine); Slots = Σ Abflüge der Strecken ab Heimat- **und** 2. Drehkreuz, alle am Heimat-Drehkreuz; dort mindestens Verwaltungsstufe 1 | `src/lib/takeover.ts:64-117` | KI | Flotte, Slots |
| Was verfällt | Strecken, Kasse (auch eine positive), 2. Drehkreuz | `src/lib/takeover.ts:1-12`; `src/App.tsx:1865` | – | – |
| Folgen | Kasse − Preis, Übernahmen + 1, Ruf + 2, KI verschwindet | `src/App.tsx:1849-1873` | – | Ruf (1.5), Karriere |

## Konstanten

| Wert | Bedeutung | Fundstelle |
|---|---|---|
| 450 000 / 150 000 $ | Zuschuss je Monat bis 1985 / ab 2005 (nominal) | KI:47-52 |
| 6 / 12 Monate | Notlage bis Verkauf / Verkauf bis Auflösung | KI:68-69 |
| 0,12 / 7 | Preiskampf-Nachlass / nötige Angriffslust | KI:72-73 |
| 0,5 / 0,5 % | größter Preis-Nachlass im Rechenkern und im Preis-Reiz / Rückschlag-Chance je Monat | KI:356; Monat:201; KI:76 |
| 20–70 Mio. $ | Rückschlag (nominal) | KI:77-78 |
| 8 / 100 Mio. $ / 5 Mio. $ / 4 % | 2. Drehkreuz: Flotte / Kasse / Kosten / Chance | KI:82-85 |
| 1,5 Mio. $ | Kosten einer Streckeneröffnung (nominal) | KI:96 |
| 150 km | kürzeste KI-Strecke | KI:99 |
| 18 h × 7 / 21 | Flugzeit je Woche / höchste Umläufe je Flugzeug | KI:105, :108 |
| 4 / 8 / 12 | Suchbreite Easy / Normal / Hard | KI:114 |
| 0,4 / 0,1 / 0 | Schätzfehler Easy / Normal / Hard | KI:120 |
| 2 | Kernnetz, das nie freiwillig gestrichen wird | KI:133 |
| 40 | Slots je Flughafen-Stufe am KI-Drehkreuz | KI:141 |
| 6 Monate | Leerlauf bis Verkauf | KI:144 |
| 5 / 10 Mio. $ | Kassen-Reserve LCC, Expansionist / andere | KI:147-149 |
| 42 … 78 | Innenausstattung je Persönlichkeit | KI:160-166 |
| 0,65 / 0,35 | Glättung des Strecken-Gewinns | KI:852 |
| 0,2 | Restwert eines modernisierten Flugzeugs | KI:1017 |
| 20 Jahre / 12 Jahre | Alter bzw. Jahre nach Bauende bis zur Modernisierung | KI:1010-1011 |
| 0,25 / 0,8 / 0,95 / 0,25 | Krise ab / Ziel-Auslastung / „voll“ / Erholungsschritt | `src/lib/rivalCrisis.ts:30`, `:52`, `:55`, `:58` |
| 0,15 | Chance je Monat, eine fehlende KI zu ersetzen | Monat:849 |
| 0,8 / 2,5 / 250 000 $ / 1 Mio. $ | Übernahme: Flottenanteil / Aufschlag gesund / je Strecke / Mindestpreis | `src/lib/takeover.ts:21-25` |

## Beispielwerte (nachgerechnet)

Zuschuss je Monat: 1960–1985 450 000 $ · 1990 375 000 · 1995 300 000 · 2000 225 000 · ab 2005 150 000.

Krisenstärke (Juni): 1974 0,50 · 1979/1980 0,40 · 1991 0,25 · 2009 0,25 · 2020/2021 0,80; sonst 0.

Höchste Umläufe je Woche: Narrowbody 1 h und 2 h Flug: 21 · Widebody 5 h: 10 · 10 h: 5.

KI-Strecke, ein Flugzeug, höchste Umläufe, Juli, keine Rivalen. Gewinn je Monat in Mio. $
(Auslastung):

| Fall | Schw. | Flag | Boutique | Optimizer | Expansionist | LCC |
|---|---|---|---|---|---|---|
| A320ceo FRA–MAD 1990, 21× | Normal | 1,98 (0,92) | 1,36 (0,69) | 2,21 (0,98) | 1,50 (1,00) | 0,89 (1,00) |
| | Hard | 1,34 (0,82) | 0,70 (0,60) | 0,99 (0,69) | 0,30 (0,62) | 0,06 (0,70) |
| | Easy | 1,12 (0,27) | 0,70 (0,20) | 0,52 (0,22) | −0,18 (0,16) | −0,45 (0,15) |
| 747-100 FRA–JFK 1985, 7× | Normal | 3,11 (0,50) | 2,05 (0,40) | −0,13 (0,30) | −1,95 (0,21) | −2,71 (0,20) |
| | Hard | −0,31 (0,30) | −0,82 (0,25) | −2,24 (0,19) | −3,33 (0,14) | −3,86 (0,13) |
| 737-800 FRA–MAD 2019, 21× | Normal | 0,81 (0,92) | 0,24 (0,70) | 0,98 (0,98) | 0,27 (1,00) | −0,35 (1,00) |
| | Hard | 0,06 (0,83) | −0,53 (0,61) | −0,32 (0,68) | −1,02 (0,61) | −1,23 (0,70) |
| A330-300 FRA–JFK 2019, 7× | Normal | 1,67 (0,57) | 0,36 (0,42) | −1,57 (0,33) | −3,17 (0,25) | −3,91 (0,22) |
| | Hard | −1,54 (0,36) | −2,19 (0,28) | −3,55 (0,21) | −4,53 (0,16) | −5,05 (0,14) |

Zum Vergleich der Spieler (Paket 1.4, Wochenwert × 4, 7 Umläufe, Stufe-1-Flughäfen):
A320ceo FRA–MAD 1990 +0,40 Mio. $ · A330-300 FRA–JFK 2020 −2,08 Mio. $.

Fünf KI ohne Spieler, Start 1960, Kasse in Mio. $ (ein Lauf je Stufe):

| Jahr | Normal: Flag / Flag / LCC / Optimizer / Expansionist | Hard: LCC / Optimizer / Flag / Flag / Flag | Easy: Boutique / Flag / Flag / Flag / Boutique |
|---|---|---|---|
| 1965 | 554 / 469 / 90 / 182 / 138 | 8 / 169 / 391 / 190 / 78 | 14 / 70 / 33 / 10 / 28 |
| 1975 | 2 644 / 1 985 / 1 / 398 / 534 | 15 / 107 / 918 / 921 / 515 | 3 / 202 / aufgelöst / 2 / aufgelöst |
| 1985 | 6 913 / 4 372 / 215 / 510 / 681 | 21 / 69 / 1 256 / 601 / 322 | 4 / 30 / – / aufgelöst / – |
| 2000 | 25 885 / 18 801 / 710 / 920 / 2 688 | aufgelöst / 56 / 6 323 / 4 778 / 3 937 | 0 / 216 / – / – / – |

Mittlere Auslastung der Easy-KI: 0,12–0,32. Normal-Flag-Carrier 1985–2000: 85–132 Mio. $
Monatsgewinn bei 37–45 Flugzeugen.

Weltkrise 1974 (Normal-Lauf): KL 24 → 15 Strecken bei 24 Flugzeugen, LCC M5 20 → 6 Strecken bei
22 Flugzeugen. Hard-Lauf: AC 14 → 2 Strecken bei 23 Flugzeugen. Bis 1980 wieder aufgebaut.

Drehkreuz-Slots nach 30 Jahren (Normal, zwei Läufe, 10 KI): 9 von 10 nutzen alle Slots
(Stufe × 40) voll. Zweite Drehkreuze: KZN, BRU (für Kuwait), MSY (für Hongkong), MKE (für
Buenos Aires), BUD, DTW (für Taipeh), GVA, SNA (für Bahrain), SHE.

Übernahme, 10 × A320ceo (Liste 40 Mio. $), 20 Jahre alt, 10 Strecken, zum Verkauf:
10 × 36 Mio. $ × 0,8 + 2,5 Mio. $ = 290,5 Mio. $. Derselbe Flottenwert beim Spieler (Alter
eingerechnet, Zustand 100): 10 × 21,6 Mio. $ = 216 Mio. $. Gesund: 726 Mio. $. Eine
Normal-Flag-KI mit 45 Flugzeugen und 26 Mrd. $ Kasse kostet gesund 7,1 Mrd. $; die Kasse verfällt.

## Was die KI anders rechnet als der Spieler

| Bereich | Spieler | KI | Fundstelle KI |
|---|---|---|---|
| Flughafen-Unterhalt (Slots, Abstellplätze, Schalter) | zahlt (1.4) | nichts | KI:410-423, :864 |
| Gebühren-Rabatt | nur mit Verwaltungsstufe | überall: Abflug Stufe 3 (× 0,85), Ziel Stufe 2 (× 0,95) | KI:410-423 |
| Slots | kauft je Flughafen (1.4) | nur Drehkreuz begrenzt (Stufe × 40), Ziele frei, kostenlos | KI:141, :879-883 |
| Anlauf neuer Strecken | 60 % (1.2) | volle Nachfrage ab Monat 1 | KI:426-440 (ohne `mods`) |
| Ruf-Faktor | 0,85–1,05 (1.5) | immer 1 (neutral bei Ruf 75) | KI:438 |
| Personal, Streik, Störungen, Werbung, Forschung | ja | nichts davon | KI:426-440 (ohne `mods`) |
| Verschleiß | Kabine und Zelle nutzen ab (Monat:1512-1547) | Zustand bleibt 100 | KI:256-257 |
| Alterung der Beliebtheit | − bis 15 Punkte ab 8 Jahren (`src/lib/fleetCosts.ts:153-160`) | Datenblatt-Wert für immer | KI:252 |
| Wiederverkauf | mit Alter | ohne Alter (90 % Liste bei Zustand 100); Modernisierung 20 % | KI:1040, :1103, :1017 |
| Rang- und Klassen-Sperren | Flughafen-Größe, Flugzeugklassen (1.5) | keine; kauft jedes lieferbare Flugzeug | KI:1124-1128 |
| Treibstoff | Spieler-Schwierigkeit | KI-Schwierigkeit (Hard × 1,15) | KI:793 |
| Nachfrage, Preis | Spieler-Schwierigkeit | KI-Schwierigkeit (Hard × 0,75 bzw. × 0,88) | KI:433 |
| Zuschuss | – | 150 000–450 000 $ je Monat | KI:864 |
| Bordverpflegung Langstrecke | bis 3 Mahlzeiten | 1 Mahlzeit (1.1 W11) | KI:296-333 |
| Qualität im Wettbewerb | eigene SAT und eigener Preis | gegenüber dem Spieler SAT 1, Preis nur im Preiskampf (1.1 W10, 1.2 W10, 1.3 W4) | Monat:191-205 |

## Widersprüche und Auffälligkeiten

### W1 · Die Persönlichkeit entscheidet über Reichtum oder Pleite
- Befund: Kabine und Preisfaktor hängen fest an der Persönlichkeit. Flag (12 % Business, 8 % First,
  Preise × 1,05–1,18) und Boutique verdienen auf Langstrecke, LCC (96 % Economy, Preis × 0,82),
  Expansionist und Optimizer verlieren dort. Auf Kurzstrecke ist die LCC trotz voller Maschinen
  am schwächsten.
- Fundstelle: KI:202-208, :337-352; Beispielwerte oben
- Folge im Spiel: A330 FRA–JFK 2019: Flag +1,67 Mio. $, LCC −3,91 Mio. $ im Monat. 737-800
  FRA–MAD 2019: LCC −0,35 Mio. $ bei 100 % Auslastung. In den Läufen werden Flag-Carrier bis 2000
  zu 19–26 Mrd. $ Kasse, LCC und Optimizer bleiben unter 1 Mrd. $ oder werden aufgelöst. Das
  „Billigflieger“-Modell funktioniert im Rechenkern nicht, weil Kosten je Sitz nicht vom
  Geschäftsmodell abhängen (gleiche Besatzung, Gebühren, kein dichteres Sitzen).
- Vorschlag: Persönlichkeit als Verhalten (Zielwahl, Preis relativ zum Markt, Kabine) mit
  ähnlichem Erfolg im Mittel. Klären, ob LCC-Kostenvorteile (dichtere Kabine, weniger Personal)
  ins Modell gehören.
- Braucht Entscheidung: ja

### W2 · Die KI spielt nach anderen Regeln
- Befund: Die KI nutzt denselben Rechenkern, aber mit anderen Eingaben: keine Flughafen-Kosten,
  Gebühren-Rabatt an jedem Flughafen, freie Slots an allen Zielen, kein Anlauf, kein Ruf, kein
  Verschleiß, keine Alterung, keine Sperren, Zuschuss (Tabelle oben).
- Fundstelle: KI:160-195, :385-452, :864
- Folge im Spiel: A320ceo FRA–MAD 1990: Optimizer-KI 2,21 Mio. $ im Monat, der Spieler mit
  demselben Flugzeug 0,40 Mio. $ (7 statt 21 Umläufe, Flughafen-Stufe 1). Die Rivalen-Ansicht
  stellt beide Gewinne nebeneinander, als wären sie vergleichbar. Gleichzeitig hat die KI Nachteile
  (eine Mahlzeit, Easy-Preise), die der Spieler nicht hat.
- Vorschlag: Festlegen, welche Regeln für alle gelten. Was die KI auslässt, als Liste in der
  Spezifikation führen und begründen.
- Braucht Entscheidung: ja

### W3 · Schwierigkeit wirkt in der KI verkehrt herum
- Befund: Die KI-Stufe ändert Verhalten (Kasse, Startflotte, Suche, Schätzfehler, Kaufneigung)
  **und** Wirtschaft (Nachfrage, Preis, Treibstoff über die Spieler-Schwierigkeitsregeln). Hard-KI
  hat mehr Geld und kauft mehr, rechnet aber mit Nachfrage × 0,75, Preis × 0,88 und Treibstoff
  × 1,15. Easy-KI verlangt das 2,25- bis 2,5-fache des Grundpreises und baut gekauften Flugzeugen
  85 % First ein.
- Fundstelle: KI:337-352, :433, :700-712, :793, :1111, :1149-1151; Bezug 1.2 W7, 1.3 W4, 1.4 W9
- Folge im Spiel: Läufe 1960–2000: Normal-Flag-Carrier enden bei 19–26 Mrd. $, Hard-Flag-Carrier
  bei 4–6 Mrd. $. Easy-KI fliegt mit 12–32 % Auslastung, lebt fast nur vom Zuschuss, drei von
  fünf werden bis 1985 aufgelöst. Hard ist für den Spieler am Anfang härter (größere Flotten),
  später nicht.
- Vorschlag: KI-Wirtschaft immer neutral rechnen; Stärke nur über Verhalten.
- Braucht Entscheidung: ja (= O6)

### W4 · Kasse wächst ohne Grenze, Wachstum endet an den Slots
- Befund: Die KI gibt Geld nur für Flugzeuge, Eröffnungen und das 2. Drehkreuz aus. Wachsen darf
  sie nur, solange am Drehkreuz Slots frei sind (Stufe × 40 Abflüge je Woche). Danach sammelt sich
  der Gewinn in der Kasse.
- Fundstelle: KI:141, :879-883, :1122; Beispielwerte oben
- Folge im Spiel: Nach 30 Jahren haben 9 von 10 KI alle Slots belegt. Flag-Carrier häufen bis 2000
  über 20 Mrd. $ an. Der Ticker-Rang zählt nach Kasse (Monat:1393): Der Spieler ist gegen solche
  Zahlen dauerhaft weit hinten. Zuschuss (0,45 Mio. $), Rückschlag (20–70 Mio. $) und Notlage
  spielen für diese KI keine Rolle mehr. Weil die Grenze Abflüge zählt, nicht Flugzeuge, bleiben
  Kurzstrecken-KI (bis 21 Umläufe je Flugzeug) in den Läufen bei 10–15 Flugzeugen;
  Langstrecken-KI (5–7 Umläufe) kommen auf 26–73 Flugzeuge.
- Vorschlag: Ein Maß für Größe festlegen (Flugzeuge, Sitze oder Slots), Ausgaben der KI vorsehen
  (Dividende, Modernisierung, mehr Drehkreuze) und den Rang nicht nach Kasse bilden.
- Braucht Entscheidung: ja

### W5 · Zuschuss und Festbeträge passen nicht über 60 Jahre
- Befund: Zuschuss, Startkasse, Eröffnungskosten, Rückschlag, 2. Drehkreuz und Übernahme-Preis je
  Strecke sind nominale Dollar. Der Kostenindex (1.4) wirkt hier nicht.
- Fundstelle: KI:47-52, :77-78, :82-85, :96, :700; `src/lib/takeover.ts:24-25`
- Folge im Spiel: Eine 2010 nachrückende Easy-KI startet mit 50 Mio. $ und 2 Flugzeugen, so viel
  wie 1960. Der Zuschuss trägt 1960 eine kleine KI, ab 1990 kaum noch und ist für große KI
  bedeutungslos. Er verdeckt, dass Easy-KI-Strecken Verlust machen.
- Vorschlag: Alle Festbeträge über einen Index (= 1.4 Frage 5, 1.5 W9). Zuschuss abschaffen, wenn
  die KI-Wirtschaft nach W1–W3 stimmt.
- Braucht Entscheidung: ja

### W6 · Übernahme: Preis und Inhalt passen nicht zusammen
- Befund: Der Preis rechnet den Flottenwert ohne Alter, und der Zustand der KI-Flugzeuge ist immer
  100. Die Kasse der KI verfällt beim Kauf, auch eine positive. Slots vom 2. Drehkreuz werden dem
  Heimat-Drehkreuz gutgeschrieben.
- Fundstelle: `src/lib/takeover.ts:38-44`, `:86-91`, `:96-117`; `src/App.tsx:1861-1865`
- Folge im Spiel: 10 × A320ceo, 20 Jahre: Preis 290,5 Mio. $, Wiederverkauf beim Spieler 216 Mio. $.
  Ein Flag-Carrier mit 26 Mrd. $ Kasse kostet 7,1 Mrd. $; das Geld verschwindet. Eine KI mit
  2. Drehkreuz in Brüssel gibt dem Spieler die Brüsseler Slots in Kuwait.
- Vorschlag: Preis = Flottenwert mit Alter + Kasse (oder − Schulden) + Wert der Slots; Slots je
  Flughafen übergeben.
- Braucht Entscheidung: ja

### W7 · Wiederverkauf der KI ohne Alter, Modernisierung mit 20 %
- Befund: Notverkauf und Leerlauf-Verkauf nehmen `getAircraftResaleValue` ohne Alter. Das ergibt
  bei Zustand 100 immer 90 % des Listenpreises. Die Modernisierung gibt für dasselbe Flugzeug 20 %.
- Fundstelle: KI:1017, :1040, :1103
- Folge im Spiel: Eine MD-82 von 1981 bringt 2000 im Notverkauf 21,6 Mio. $ (Liste 24 Mio. $), bei
  der Modernisierung 4,8 Mio. $. Eine KI in Not kommt so leicht wieder ins Plus.
- Vorschlag: Eine Restwert-Formel für alle (mit Alter und Zustand).
- Braucht Entscheidung: nein

### W8 · Aufgelöste KI: Flugzeuge verschwinden
- Befund: Die Meldung sagt „Its slots and aircraft go back to the market“. Der Code entfernt die
  KI mit Flotte; nichts geht an den Gebrauchtmarkt.
- Fundstelle: KI:1207-1210, :1227
- Folge im Spiel: Die Meldung verspricht etwas, das nicht passiert. Ob der Gebrauchtmarkt
  KI-Flugzeuge brauchen könnte, prüft 1.7.
- Vorschlag: Flugzeuge an den Gebrauchtmarkt geben oder die Meldung ändern.
- Braucht Entscheidung: ja (welche der beiden)

### W9 · Krise legt Flotten still, Hard-KI schrumpft am stärksten
- Befund: In der Krise werden Verlust-Strecken gestrichen (Hard 2 je Monat), aber der
  Wachstumsstopp hält die Leerlauf-Uhr an. Geparkte Flugzeuge werden nicht verkauft und kosten
  weiter den halben Unterhalt.
- Fundstelle: KI:951-976, :1095-1099; `src/lib/rivalCrisis.ts:39-49`; `src/lib/fleetCosts.ts:124-145`
- Folge im Spiel: 1974 (Hard): AC 14 → 2 Strecken bei 23 Flugzeugen. Der Spieler hat in dieser
  Zeit fast keinen Wettbewerb; danach baut die KI in einem Schub wieder auf.
- Vorschlag: Krisen-Regeln in der Spezifikation behalten (sie sind gewollt), aber Streichen und
  Parken abstimmen; geparkte Flugzeuge in langer Krise verkaufen.
- Braucht Entscheidung: nein

### W10 · Zweites Drehkreuz an beliebigen Orten der Welt
- Befund: Jeder Flughafen ab Stufe 3 weltweit ist möglich, gewichtet nur nach Nachfrage.
- Fundstelle: KI:1179-1182
- Folge im Spiel: Kuwait Airways mit 2. Drehkreuz Brüssel, Cathay Pacific in New Orleans, Aerolíneas
  Argentinas in Milwaukee. Für echte Gesellschaften unglaubwürdig. Der Kommentar spricht von
  „a major airport“; Stufe 3 ist mittelgroß.
- Vorschlag: Heimatregion bevorzugen; Mindeststufe 5.
- Braucht Entscheidung: nein

### W11 · Texte und Kommentare weichen vom Code ab (klein)
- Befund:
  - Notlage „six months in a row“: Der Zähler sinkt in guten Monaten nur um 1. Folge
    −, −, −, +, −, −, −, − ergibt 6 und damit den Verkauf (KI:1192-1199).
  - Rivalen-Ansicht: Preiskampf „0-0.2“; der Code nutzt 0,12 (`src/components/CompetitorsView.tsx:78`;
    KI:72).
  - Notverkauf: Wenn alle Strecken Gewinn machen, wird nichts verkauft, obwohl die Kasse negativ
    ist (KI:1037-1038).
  - Rückschlag-Meldung nur, wenn die Kasse danach negativ ist (KI:872); die Zeitung zeigt es
    über `rivalMoves` nicht.
- Folge im Spiel: keine falsche Zahl; Erklärungen ungenau.
- Vorschlag: Texte aus den Konstanten erzeugen (Paket 4.1).
- Braucht Entscheidung: nein

## Doppelte Rechnungen

- Rivalen-Angebote zweimal gebaut: für den Spieler `buildRivalOffers` (Monat:191-205, mit
  Preis-Reiz) und für die KI in `simulateAiAirlinesTurn` (KI:796-809, **ohne** Preis-Reiz). Der
  Preiskampf einer KI wirkt daher nur gegen den Spieler, nicht gegen andere KI.
- Sitze je KI-Strecke: `rivalSeats` (Monat:185-189) und KI:801 – gleiche Regel, zwei Stellen.
- Sitze je Spieler-Strecke für die KI: Summe der Kabine oder Kapazität (Monat:837-843).
- `PERSONALITIES` und `AGGRESSION` als Kopie in `src/lib/saveMigration.ts:57-58`.
- Kabinenaufteilung: `cabinConfigFor` (KI:210-222) und eine Ersatz-Aufteilung 85/10/4/Rest in
  `buildAiSimAircraft` (KI:188-193) für alte Spielstände.
- KI-Abflüge je Flughafen oder Paar an mehreren Stellen: `buildRivalRoutesByPair`
  (`src/lib/financeUtils.ts:1100`), `rivalLandingsPerWeek` (`src/lib/hubOwnership.ts:45-53`),
  `src/components/RoutePlannerView.tsx:259`, `src/components/AirportDetailView.tsx:132`,
  `src/components/AirportsView.tsx:85`. Prüft 1.8.
- Restwert: `getAircraftResaleValue` mit Alter (Spieler) und ohne (KI, Übernahme), dazu 20 % fest
  (Modernisierung) (W7).

## Bezug zu bisherigen offenen Fragen

- O6 (Schwierigkeit): W3, mit Zahlen aus Mehrjahres-Läufen.
- 1.1 W10 (Rivalen SAT 100) und W11 (eine Mahlzeit): bestätigt; die KI-SAT wird berechnet, aber
  nicht an den Spieler-Marktanteil weitergegeben (Monat:191-205).
- 1.2 W7 und W10 (KI-Wirtschaft, Anteile über 100 %): bestätigt (KI:768-773 ohne Preis-Reiz und SAT).
- 1.3 W4 (KI-Preise ohne Marktpreis): bestätigt; dazu W1 (Persönlichkeit) und W3 (Easy 2,25×).
- 1.4 W9 (Hard-Treibstoff der KI) und Frage 5 (Index für Festbeträge): W3, W5.
- 1.5 W9 (feste Dollar-Beträge): W5.

## Offene Fragen an den Menschen

1. Soll die KI nach denselben Regeln rechnen wie der Spieler (Flughafen-Kosten, Slots, Anlauf,
   Verschleiß, Sperren), oder bewusst vereinfacht? Wenn vereinfacht: welche Lücken sind gewollt? (W2)
2. Soll die KI-Schwierigkeit nur das Verhalten ändern (Kasse, Suche, Kaufneigung) und die
   Wirtschaft neutral bleiben? Easy-KI mit 2,25-fachen Preisen behalten? (W3)
3. Sollen alle Persönlichkeiten im Mittel ähnlich erfolgreich sein? Und soll ein Billigflieger
   echte Kostenvorteile bekommen (dichtere Kabine, weniger Personal)? (W1)
4. Was soll das KI-Wachstum begrenzen, und was macht die KI mit Gewinnen, wenn sie nicht mehr
   wachsen kann? Und soll der Rang im Ticker nach Kasse bleiben? (W4)
5. Zuschuss: behalten, an den Kostenindex koppeln oder abschaffen? (W5)
6. Übernahme: Preis nach Flotte (heute, ohne Alter) oder nach Unternehmenswert? Was gehört dazu
   (Kasse, Strecken, Slots beider Drehkreuze)? (W6)
7. Flugzeuge aufgelöster KI: an den Gebrauchtmarkt geben oder verschwinden lassen (dann Meldung
   ändern)? (W8)
