# Änderung: nachvollziehbare Kundenzuordnung

Stand: 18.08.2026

## Ziel

Das Kundenregister soll sichtbar machen, welchem Gesellschafter ein gewonnener bzw. geschriebener Kunde zugeordnet ist. Die Zuordnung dient zunächst der transparenten Dokumentation der Vertriebsleistung. Eine Provisions- oder Gewinnabrechnung ist in dieser Änderung noch nicht enthalten.

## Technische Grundlage

Die App hatte bereits das Feld `completedBy` am Kundendatensatz. Dieses Feld wird beim erstmaligen Anlegen serverseitig anhand des angemeldeten Profils gesetzt.

Bei späteren Änderungen an einer bestehenden Kundenkartei wird die vorhandene Zuordnung serverseitig beibehalten. Eine normale Bearbeitung von Name, Kontakt- oder Betreuungsdaten überschreibt die Zuordnung daher nicht.

Auch bei Online-Aufnahmen wird die spätere Kundenkartei dem Profil zugeordnet, das die Online-Aufnahme erstellt hat.

## Sichtbare Änderungen

- Kundenbereich heißt jetzt „Kunden & Zuordnung“.
- Aktive Kunden von Herr Voss und Herr Dicke werden getrennt gezählt.
- Kunden können nach „Alle“, „Herr Voss“ oder „Herr Dicke“ gefiltert werden.
- In jeder Kundenzeile wird die Zuordnung direkt angezeigt.
- In der Kundenkartei heißt der Eintrag „Vertrieblich zugeordnet“.
- Ein Hinweis erklärt, dass die Zuordnung beim Anlegen serverseitig gesetzt und durch normale Änderungen nicht überschrieben wird.
- Beim Audit von Kundenanlage und Kundenänderung wird `completedBy` zusätzlich in den Auditdetails mitgeführt.

## Bewusst noch nicht enthalten

- Provisionshöhe pro Kunde
- unterschiedliche Provisionssätze für Strom und Gas
- Storno-Rückbelastungen in Euro
- gemeinsame Kunden / prozentuale Aufteilung
- automatische Auszahlung oder Gewinnverteilung

Diese Punkte sollten erst ergänzt werden, wenn feststeht, nach welcher wirtschaftlichen Formel ihr später abrechnen wollt.
