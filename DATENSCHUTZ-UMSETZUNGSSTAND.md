# Datenschutz-Umsetzungsstand - Voss & Dicke FieldOps

Stand: 21.07.2026

## In dieser Version technisch umgesetzt

- Öffentliche Seiten `/datenschutz` und `/impressum` sowie PDF-Fassungen.
- Unternehmensangaben zentral über `NEXT_PUBLIC_COMPANY_*` konfigurierbar.
- Normale Kundenaufnahme ohne Pflicht-Unterschrift.
- Reine Dankes-E-Mail mit gespeichertem Resend-Status, Versand-ID und manueller Wiederholung.
- Optionaler Datenschutz-Nachweis mit versionierter PDF und SHA-256-Prüfsumme; freiwillige Unterschrift möglich.
- Kein automatischer PDF-Mailversand und keine automatischen Wiederholungsversuche.
- Private, serverseitig geschützte Dokumentablage in Supabase Storage.
- Kundenbezogene PDF- und JSON-Datenauskunft.
- Wiedervorlage, direkte Öffnung aus Benachrichtigung und bewusste Verlängerung.
- Sieben Tage Nachfrist; danach automatischer Kunden-Papierkorb.
- Endgültige Löschung nach 30 Tagen einschließlich Kunde, Live-Einträgen, Terminen, Benachrichtigungen, App-Audit-Bezügen, Datenschutz-PDFs und Anhängen.
- Wiederherstellung während der Papierkorbfrist.
- Unvollständige Aufnahme wird nach sieben Tagen ebenfalls automatisch in den Papierkorb verschoben.
- Neutrale Push-Mitteilungen ohne Kundenangaben auf dem Sperrbildschirm.
- Wochenberichte ohne Kundennamen und vollständige Kundenanschriften.
- Begrenzung alter Audit- und Rate-Limit-Daten auf einen technischen Richtwert von 180 Tagen.
- Interne PDFs: Kundeninformation, Datenschutzerklärung, Löschkonzept, TOM und Produktionsfreigabe-Checkliste.
- Fertige statische HTML-Seiten zum Einbau in die öffentliche GitHub-Pages-Website.

## Vor Produktivbetrieb außerhalb des Codes erforderlich

- Migrationen 001 und 002 im echten Supabase-Projekt ausführen und testen.
- AV-/Datenschutzunterlagen von Supabase, Vercel, Resend, Google/Gmail und TeleSon prüfen und dokumentieren.
- Resend-Absenderdomain verifizieren; eine öffentliche Gmail-Adresse kann nur Antwortadresse sein, nicht die verifizierte Resend-Absenderdomain ersetzen.
- Register-, Steuer-, Start- und spätere Geschäftsnummern aktualisieren.
- Verbraucherschlichtungsangabe festlegen.
- Backupregion, Aufbewahrungszyklus und Wiederherstellungstest dokumentieren.
- TeleSon-Aufbewahrungs- und Löschregeln sowie Empfänger der Vertragsdaten prüfen.
- Rechtstexte auch in der separaten GitHub-Pages-Website verlinken.
- End-to-End-Test mit ausschließlich fiktiven Testdaten durchführen.
- Vor Livegang eine fachliche Schlussprüfung der konkreten Rechtsgrundlagen und gesetzlichen Aufbewahrungsfristen durchführen.

## Wichtige Abgrenzung

Die FieldOps-App speichert Organisations- und Betreuungsdaten. Vollständige Strom-/Gasverträge und deren Vertragsabwicklung bleiben im TeleSon-System. Eine App-Löschung kann Daten in TeleSon-, Energieversorger-, E-Mail- oder Backup-Systemen nicht automatisch entfernen; dafür müssen die jeweiligen Prozesse und Verträge beachtet werden.
