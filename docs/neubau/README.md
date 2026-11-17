# Neubau des Rechenmodells

## Ziel

Die Spiellogik rechnet an mehreren Stellen widersprüchlich (Beispiele:
`SAT-ANALYSE.md`, Abschnitte 4 und 5). Ursache: Mechaniken wurden nacheinander
angebaut, ohne gemeinsame Beschreibung, was jede Größe bedeutet.

Das Projekt baut deshalb **nur das Rechenmodell** neu, in dieser Reihenfolge:

1. **Bestand aufnehmen:** Was rechnet der Code heute, wo widerspricht er sich?
2. **Spezifikation schreiben:** Jede Größe einmal festlegen (Bedeutung, Formel, Wirkung).
3. **Modell neu bauen:** Neuer Ordner `src/model/`, Konstanten an einem Ort, Regeltests.
4. **Oberfläche anbinden:** Ansichten rufen nur noch das Modell auf; Glossar aus den Konstanten.
5. **Abschluss:** Spielstand-Umwandlung, Balance-Skript, alten Code entfernen.

Oberfläche, Karte, Cloud-Spielstände, Flugzeug- und Flughafendaten bleiben.

## Arbeitsweise (gegen Kontext- und Nutzungsgrenzen)

- **Eine Sitzung = ein Arbeitspaket.** Für jedes Paket eine neue Sitzung starten.
  So beginnt jede Sitzung mit leerem Kontext.
- **Das Gedächtnis liegt im Repository, nicht im Chat.** `STATUS.md` sagt, was
  erledigt ist und was als Nächstes kommt. Ergebnisse stehen in Dateien.
- **Nur lesen, was das Paket braucht.** Jedes Paket nennt seine Dateien.
- **Pakete klein halten.** Wird ein Paket zu groß, wird es in `STATUS.md` geteilt
  (z. B. 1.3a, 1.3b), statt es in einer Sitzung zu erzwingen.
- **Entscheidungen trifft der Mensch.** Claude schlägt vor (mit Empfehlung),
  der Mensch entscheidet. Festgehalten in `ENTSCHEIDUNGEN.md`.
- **Pro Paket ein Pull Request.** Kleine, nachvollziehbare Schritte.

## Eine Sitzung starten

Neue Sitzung im Repository öffnen und schreiben:

```
Mach das nächste Paket aus docs/neubau/STATUS.md.
```

Oder gezielt:

```
Mach Paket 1.2 aus docs/neubau/STATUS.md.
```

`CLAUDE.md` im Hauptordner wird von Claude Code automatisch gelesen und verweist hierher.

## Dateien

| Datei | Inhalt |
|---|---|
| `STATUS.md` | Phasen, Pakete, Stand, nächster Schritt |
| `ENTSCHEIDUNGEN.md` | Getroffene und offene Entscheidungen |
| `SPEZIFIKATION.md` | Das Soll-Modell (entsteht in Phase 2) |
| `bestand/` | Ergebnis von Phase 1, eine Datei je Bereich |
| `bestand/VORLAGE.md` | Aufbau einer Bestandsdatei |
