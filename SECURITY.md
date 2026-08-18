# Security Policy

## Keine Geheimnisse in Git

Folgende Werte dürfen niemals committed werden:

- Firmenpasswort oder Klartext-Hashes aus anderen Systemen
- Supabase Secret/Service-Key
- Resend- oder VAPID-Private-Key
- echte E-Mail-Adressen und Telefonnummern der Profile, sofern das Repository geteilt wird
- Kundendaten, Exporte oder Datenbank-Backups

`.env*` ist über `.gitignore` ausgeschlossen. Vor jedem Push sollte zusätzlich GitHub Secret Scanning aktiviert werden.

## Berechtigungen

Alle normalen Datenzugriffe laufen mit der persönlichen Supabase-Auth-Sitzung. Sensible API-Antworten werden mit `Cache-Control: no-store` ausgeliefert. Row Level Security prüft, ob die `auth.uid()` einem aktiven Eintrag in `team_profiles` entspricht. Der Service-Key wird nur in Serverrouten für Cron, Push-Versand und Rate Limiting verwendet und darf nie mit `NEXT_PUBLIC_` beginnen.

## Login- und OTP-Schutz

Firmenlogin, OTP-Versand und OTP-Prüfung besitzen ein serverseitiges, pseudonymisiertes Rate Limit in `auth_rate_limits`. Die Tabelle ist für `anon` und `authenticated` gesperrt und wird nur über den Server-Service-Key gepflegt. Ein Hosting-WAF bleibt als zusätzliche Schutzschicht sinnvoll.

## Schnell-PIN

Der PIN ist eine lokale Komfortsperre. Er wird mit PBKDF2 und AES-GCM als verschlüsselter Geräteprüfwert gespeichert. Er ist nicht der Datenbank-Schlüssel und kann eine abgelaufene Serversitzung nicht ersetzen. Nach mehreren Fehlversuchen wird der PIN zeitweise gesperrt.

## Meldung einer Schwachstelle

Sicherheitsprobleme nicht als öffentliches GitHub-Issue veröffentlichen. Stattdessen intern an die verantwortliche Person melden und betroffene Schlüssel/Sitzungen sofort widerrufen.

## Vor Produktivbetrieb

- Supabase Auth- und Datenbankprotokolle prüfen
- eingebautes Rate Limiting für Login und OTP prüfen; zusätzlich Hosting-WAF konfigurieren
- MFA- und Wiederherstellungsprozess testen
- Backup-Wiederherstellung testen
- verlorenes Gerät abmelden können
- Datenexport und Löschung testen
- externe Sicherheitsprüfung durchführen
