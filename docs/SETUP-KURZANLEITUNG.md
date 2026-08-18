# Kurz-Einrichtung für den ersten Test

## 1. Privates GitHub-Repository

Den Projektordner in ein neues **privates** Repository hochladen. `.env.local`, Backups und echte Kundendaten niemals committen.

## 2. Supabase anlegen

1. Neues Supabase-Projekt erstellen.
2. `supabase/migrations/001_secure_fieldops.sql` vollständig im SQL Editor ausführen.
3. Unter Authentication je einen persönlichen Benutzer für Herrn Voss und Herrn Dicke anlegen.
4. E-Mail-OTP aktivieren und in der Mailvorlage `{{ .Token }}` für den achtstelligen Code verwenden.
5. Die beiden Benutzer-UUIDs in `supabase/seed.example.sql` eintragen und ausführen.

## 3. Firmenpasswort vorbereiten

```bash
npm install
npm run hash:password
```

Das gewünschte Klartextpasswort nur in der Eingabe verwenden. Ausschließlich die ausgegebene Scrypt-Zeile in die Hosting-Umgebungsvariable `COMPANY_PASSWORD_SCRYPT` kopieren.

## 4. Secrets setzen

`.env.example` nach `.env.local` kopieren und alle Pflichtwerte ergänzen. In Vercel dieselben Werte unter **Project Settings → Environment Variables** hinterlegen. Keine Variable mit Secret-Inhalt darf `NEXT_PUBLIC_` heißen.

## 5. E-Mail, Push und Bericht

- E-Mail-OTP mit beiden Profilen auf echten Geräten testen. Beim Antippen eines Profils wird die E-Mail automatisch versendet.
- Resend-Absenderdomain verifizieren und `REPORT_FROM_EMAIL` setzen.
- VAPID-Schlüssel erzeugen und Push auf iPhone, Tablet und PC erlauben.
- `CRON_SECRET` als langen Zufallswert setzen.

## 6. Bereitstellen

Das private Repository mit Vercel verbinden und deployen. Danach prüfen:

1. Firmenlogin
2. Profilauswahl
3. 2FA
4. PIN-Erstellung
5. automatischer Datenbankzugriff
6. D2D-Farbeintrag auf zwei Geräten
7. Termin-Pop-up und Bestätigung durch beide
8. Arbeitszeit-Erinnerung nur beim betroffenen Profil
9. PDF-Test über die Verwaltung
10. erzwungener Cron-Test laut README

## 7. Vor echten Kundendaten

Datenschutzinformation, Rechtsgrundlagen, Aufbewahrungsfristen, Löschprozess, Auftragsverarbeitungsverträge, Backup-Wiederherstellung und externe Sicherheitsprüfung verbindlich abschließen.
