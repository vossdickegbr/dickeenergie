# Projektstatus – finaler Prototypstand

## Fertig im Code

- responsiver Betrieb auf iPhone, iPad, Android, PC und Notebook
- PWA-Installation mit Firmenlogo und eigenem App-Fenster
- Login-Reihenfolge: Firmenzugang → Profil antippen → automatischer E-Mail-Code → Schnell-PIN
- automatische Verbindung zur geschützten Supabase-Datenbank nach erfolgreichem Entsperren
- gemeinsame Live-Daten für Herrn Voss und Herrn Dicke
- D2D-Schnellmodus mit Rot/Gelb/Grün/Grau und automatischer Speicherung
- Grün öffnet direkt die Aufnahme eines abgeschlossenen Kunden
- Gelb öffnet sofort die gemeinsame Termineintragung
- eigenes Register für abgeschlossene Kunden, Wiedervorlagen und Stornos mit zusätzlicher PIN-Abfrage
- Wiedervorlagen mit Anruf, WhatsApp, Navigation, Verschieben und Erledigt-Status
- gemeinsamer Kalender und Benachrichtigungszentrale mit getrennten Bestätigungen
- private Arbeitszeiterinnerungen ab 20:00 Uhr
- Arbeitszeiterfassung mit Pausen
- Partner-Live-Ticker mit Tagesverlauf, Terminen, Kunden und Arbeitsstatus
- Aktivitätsnachweis beider Profile im wöchentlichen PDF-Bericht
- handschriftliche Tagesnotizen
- Wochenarchiv, Wochenvergleich und PDF-Wochenabschluss
- automatischer E-Mail-Versand sonntags um 09:00 Uhr Europe/Berlin
- aktueller Plan ausschließlich in `data/current-week.json`
- Datenbank-RLS, Audit-Log, Rate Limits, Eingabevalidierung und Security Header

## Vor echtem Produktivbetrieb einzurichten

1. Eigenes Supabase-Projekt verbinden und Migration ausführen.
2. Persönliche Auth-Benutzer für Herrn Voss und Herrn Dicke anlegen.
3. E-Mail-OTP für beide Profile und den achtstelligen Code testen.
4. Firmenpasswort lokal hashen und nur als Hosting-Secret hinterlegen.
5. Resend-Absenderdomain, VAPID-Schlüssel und Cron-Secret einrichten.
6. Datenschutzinformation, Aufbewahrungsfristen, Löschprozess und Auftragsverarbeitungsverträge verbindlich festlegen.
7. Backup-Wiederherstellung sowie Geräteverlust und Kontosperrung testen.
8. Vor echten Kundendaten eine unabhängige Sicherheits- und Datenschutzprüfung durchführen.

## Bewusste Grenze des ersten Entwurfs

Der Schnell-PIN ist eine lokale Komfortsperre für ein bereits authentifiziertes, vertrauenswürdiges Gerät. Die eigentliche Zugriffsentscheidung liegt bei Supabase Auth und den Datenbankrichtlinien. Für eine zusätzliche hochsichere Gerätesperre sollte vor dem Produktivbetrieb Passkey/WebAuthn oder ein serverseitig registriertes Geräteverfahren ergänzt werden.

Kundendaten, Datenbankinhalte, Exporte und echte Zugangsdaten gehören niemals in GitHub. Das Repository enthält ausschließlich Anwendungscode, Beispieldaten des Wochenplans und Konfigurationsvorlagen ohne Secrets.
