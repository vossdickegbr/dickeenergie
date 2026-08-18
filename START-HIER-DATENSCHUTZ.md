# Start hier – Datenschutz-Gesamtversion

Diese Version verbindet die besprochenen Datenschutzabläufe mit der bestehenden FieldOps-App. Sie ist eine technische und organisatorische Arbeitsgrundlage, keine behördliche Zertifizierung und keine individuelle anwaltliche Freigabe.

## Bereits eingebaut

- normale Kundenaufnahme ohne Pflicht-Unterschrift
- reine Dankes-E-Mail mit gespeichertem Resend-Status und manueller Wiederholung
- optionaler Datenschutz-Nachweis mit freiwilliger Unterschrift per Finger, Maus oder Stift
- versionierte, kundenbezogene PDF mit Prüfsumme
- private Ablage der bestätigten Nachweis-PDF in Supabase Storage
- kein automatischer Versand der Datenschutz-PDF; Versand nur nach bewusster manueller Aktion
- manueller PDF-Versand, Versandstatus und sichtbare Fehleraufgabe
- geschützter PDF-Download sowie PDF-/JSON-Auskunft in der Kundenkartei
- optionale private Anhänge wie PDF oder Bild
- Wiedervorlage mit direktem Sprung aus der Benachrichtigung in die Kundenkartei
- bewusste Verlängerung bei erneuter Dienstleistung
- sieben Tage Nachfrist, anschließend Kunden-Papierkorb
- weitere 30 Tage Wiederherstellungsfrist, danach endgültige App-Löschung
- Entfernung verknüpfter Live-Einträge, Termine, Benachrichtigungen, Datenschutz-PDFs und Anhänge
- neutrale Push-Mitteilungen und anonymisierte Wochenberichte
- öffentliche Seiten `/datenschutz` und `/impressum`
- PDF-Dokumente für Kundeninformation, Website/App, Löschkonzept, TOM und Freigabeprüfung
- statische Rechtstexte zum Kopieren in die separate GitHub-Pages-Website

## Vor dem ersten echten Kunden zwingend

1. Beide SQL-Dateien aus `supabase/migrations` im produktiven Supabase-Projekt ausführen.
2. Prüfen, dass der Bucket `customer-documents` privat ist und die RLS-Regeln aktiv sind.
3. Alle Werte aus `.env.example` als sichere Hosting-Umgebungsvariablen hinterlegen.
4. Eine eigene Domain oder Versand-Subdomain bei Resend verifizieren und `CUSTOMER_PRIVACY_FROM_EMAIL` darauf setzen. Die Gmail-Adresse bleibt Antwortadresse.
5. `CRON_SECRET` setzen und die drei Cron-Routen im produktiven Hosting testen.
6. Anbieterunterlagen/AV-Verträge von Supabase, Vercel, Resend, E-Mail-Anbieter und TeleSon prüfen und ablegen.
7. TeleSon schriftlich zu Datenschutzrollen, Vertragsdaten, Unterauftragnehmern, Löschfristen und Betroffenenanfragen prüfen.
8. Geschäftsanschrift, Telefonnummer, Register-, Steuer- und Startangaben aktualisieren, sobald sie feststehen.
9. Die Inhalte aus `docs/website-legal` in die getrennte GitHub-Pages-Website übernehmen.
10. Den kompletten Ablauf ausschließlich mit fiktiven Daten testen: Aufnahme ohne Nachweis, Dankes-E-Mail, optionaler Datenschutz-Link, freiwillige Unterschrift, PDF-Download, manueller PDF-Versand, Verlängerung, Papierkorb, Wiederherstellung und endgültige Löschung.

## Unternehmensdaten ändern

Die sichtbaren Firmendaten stehen zentral in den Variablen `NEXT_PUBLIC_COMPANY_*` aus `.env.example`. Telefonnummer, Geschäftsanschrift, Registerangaben und Website lassen sich dadurch ohne Umbau der Komponenten austauschen. Nach einer Änderung der öffentlichen Variablen ist ein neuer Build/Deploy nötig.

## Wichtige Abgrenzung

Die App speichert Organisations- und Betreuungsdaten. Strom- und Gasverträge werden ausschließlich in den TeleSon-Systemen bearbeitet. Eine Löschung in FieldOps löscht nicht automatisch Daten bei TeleSon, Energieversorgern, E-Mail-Anbietern oder aus noch vorhandenen Backups. Dafür braucht die GbR dokumentierte externe Löschprozesse.
