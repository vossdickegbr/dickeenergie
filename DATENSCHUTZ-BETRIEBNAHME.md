# Datenschutz - Betriebsnahmecheck

Diese Datei ist eine technische und organisatorische Checkliste, keine behördliche Zertifizierung.

## Vor echten Kundendaten zwingend erledigen

- [ ] Ladungsfähige Geschäftsanschrift, Telefonnummer, Registerangaben und USt-/W-IdNr. im Impressum aktualisieren.
- [ ] Datenschutzerklärung und Kundeninformation auf die tatsächlich eingesetzten Anbieter abstimmen.
- [ ] AV-Verträge/Datenschutzunterlagen von Supabase, Vercel, Resend, E-Mail-Anbieter und TeleSon prüfen und ablegen.
- [ ] Supabase-Migrationen `001` und `002` ausführen; Bucket `customer-documents` muss privat sein.
- [ ] Resend-Domain verifizieren; `CUSTOMER_PRIVACY_FROM_EMAIL` auf diese Domain setzen, Gmail nur als Reply-To.
- [ ] Backups, Backup-Region und Wiederherstellung testen; dokumentieren, wann alte Backups überschrieben werden.
- [ ] Cron-Route `/api/cron/privacy-retention` mit einem langen `CRON_SECRET` aktivieren und testen.
- [ ] Geräteverschlüsselung, Displaysperre, Fernlöschung und Updates auf allen Geschäftsgeräten aktivieren.
- [ ] TeleSon klärt Rollen, Datenübermittlung, Aufbewahrung und Löschung seiner Vertragsdaten.
- [ ] Testdatensätze vollständig anlegen, PDF senden, verlängern, in Papierkorb verschieben, wiederherstellen und endgültig löschen.

## Festgelegter App-Ablauf

- Normale Kundenaufnahme ohne Pflicht-Unterschrift; zusätzlicher Datenschutz-Nachweis und Unterschrift sind freiwillig.
- E-Mail ist freiwillig; bei einer neuen Kartei wird nur die Dankes-E-Mail angestoßen. Die Nachweis-PDF wird ausschließlich bewusst aus der Kundenkartei versendet.
- App speichert nur Organisationsdaten: Name, Anschrift, Telefon, optionale E-Mail, Sparte, Wiedervorlage, sachliche Notiz und Nachweise.
- Verträge werden ausschließlich in TeleSon-Systemen abgeschlossen.
- Nach Wiedervorlage: 7 Tage Nachfrist; danach Papierkorb; endgültige Löschung nach weiteren 30 Tagen.
- Bei erneuter Dienstleistung wird die Wiedervorlage bewusst verlängert. Keine automatische Verlängerung eines Energievertrags.
- Kundendokumente sind optional, privat und nur bei konkreter Erforderlichkeit hochzuladen; keine Ausweiskopien.
- Push-Mitteilungen zeigen auf dem Sperrbildschirm keine Kundendaten.
- Wochenberichte enthalten keine Kundennamen oder vollständigen Adressen.

## Noch außerhalb der App festzulegen

- Gesetzliche und vertragliche Aufbewahrungsfristen für TeleSon-, Provisions-, Storno-, Steuer- und Vertragsnachweise.
- Verhalten von TeleSon bei einer Löschanfrage.
- Backup-Löschzyklus.
- Verbraucherschlichtungsangabe im Impressum.
- Register- und Steuerangaben nach Gründung.
