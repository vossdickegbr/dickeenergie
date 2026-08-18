# Stabilitäts- und Bedienungsoptimierung

Diese Fassung basiert auf der zuletzt korrigierten Version mit Dankes-E-Mail und optionalem Datenschutz-Nachweis. Das vorhandene Design und die fachlichen Abläufe wurden beibehalten.

## Behoben

- Gelöschte und wiederhergestellte Einträge bleiben während der Server-Synchronisierung zuverlässig aus der jeweils alten Liste ausgeblendet. Dadurch erscheinen sie nicht mehr kurz erneut.
- Mehrfach ausgelöste Hintergrund-Aktualisierungen werden zusammengefasst. Echtzeitereignisse werden kurz gebündelt und die regelmäßige Synchronisierung läuft nur bei sichtbarer App.
- Große handschriftliche Zeichnungen werden beim Vergleich zweier Datenstände nicht mehr vollständig serialisiert. Das reduziert kleine Ruckler.
- Ein kurzfristiger Netzfehler ersetzt nach dem erfolgreichen App-Start nicht mehr die gesamte Oberfläche durch eine Fehlerseite. Der letzte sichere Datenstand bleibt sichtbar.
- Geöffnete Dialoge sperren den Seitenhintergrund. Der Dialog selbst bleibt auf Handy, Tablet und Rechner scrollbar; die ursprüngliche Scrollposition wird beim Schließen wiederhergestellt.
- Kundenkartei: sichtbarer, auf Mobilgeräten dauerhaft erreichbarer Zurück-Button ergänzt.
- Profilauswahl: auf zwei kompakte Profilkarten reduziert; lange Erklärtexte entfernt.
- Schnelle Mehrfachklicks werden bei D2D-Eingaben, Arbeitszeit, Terminaktionen, Kundenaktionen, Papierkorb, Benachrichtigungen, Downloads und Verwaltungsaktionen blockiert.
- Ladezustände und verständliche Fehlermeldungen wurden für zuvor still fehlschlagende Buttons ergänzt.
- Termin- und Archivdialoge reagieren zuverlässig auf Schließen, Hintergrundklick und Escape, ohne während eines Speichervorgangs versehentlich zu verschwinden.
- Mobile Datei- und PDF-Downloads hängen den Download-Link kurz korrekt in das Dokument ein und geben die Objekt-URL verzögert frei.
- Beim Bearbeiten vorhandener Kunden und Termine bleibt das ursprüngliche Erstellungsdatum erhalten.
- Die Kundenkartei wird beim Aktualisieren nicht mehr unnötig neu montiert; Scrollposition und Eingabestatus bleiben stabiler.
- Betriebssysteme mit „Bewegung reduzieren“ erhalten deutlich weniger Animationen.

## Nicht verändert

- Gestaltung, Farben und grundsätzliche Seitenstruktur
- bestehende Kunden-, Termin-, D2D-, Datenschutz- und E-Mail-Abläufe
- Supabase-, Resend- und Vercel-Konfiguration
- Datenbankmigrationen und vorhandene Kundendaten
