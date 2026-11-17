# Hinweise für Claude

## Laufendes Projekt: Neubau des Rechenmodells

Das Spielmodell (Zufriedenheit, Nachfrage, Preis, Kosten, Ruf, Konkurrenz,
Monatsabschluss) wird geordnet neu aufgebaut. Oberfläche und Technik bleiben.

**Vor jeder Arbeit daran:**

1. `docs/neubau/STATUS.md` lesen: Welches Paket ist dran, was ist offen?
2. `docs/neubau/README.md` nur lesen, wenn die Arbeitsweise unklar ist.
3. Nur die Dateien lesen, die das Paket in `STATUS.md` nennt. Nicht das ganze Projekt.

**Am Ende jeder Sitzung:**

1. Ergebnis in die Datei schreiben, die das Paket nennt (nicht nur in den Chat).
2. `docs/neubau/STATUS.md` aktualisieren: Paket-Status, Ergebnis in einem Satz,
   offene Fragen, nächstes Paket.
3. Neue Entscheidungen in `docs/neubau/ENTSCHEIDUNGEN.md` eintragen.
4. Committen, pushen, Pull Request.

## Allgemein

- Antworten und Dokumente auf Deutsch, einfach erklärt. Oberflächentexte im Spiel bleiben Englisch.
- Code-Stellen immer als `datei:zeile` angeben.
- Prüfen vor dem Commit: `npm test` und `npm run lint`.
- Ältere Analysen: `ANALYSE.md`, `SAT-ANALYSE.md`, `docs/CODE_REVIEW.md`. Sie beschreiben
  teilweise einen veralteten Stand; im Zweifel gilt der Code.
