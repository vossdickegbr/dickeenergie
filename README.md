# Voss & Dicke FieldOps

Interne, installierbare D2D-Arbeitsapp für **Voss & Dicke GbR**. Der Entwurf ist für iPhone/iPad, Android, PC und Notebook responsiv aufgebaut und verbindet den schnellen Außendienstmodus mit Kundenregister, gemeinsamem Kalender, Benachrichtigungen, Arbeitszeiterfassung, Wochenarchiv und automatischem Sonntagsbericht.

## Wichtig vor dem Start

- Kundendaten werden **nicht in GitHub** gespeichert.
- Nach einer gültigen Anmeldung lädt die App die Daten automatisch aus einer geschützten Supabase-PostgreSQL-Datenbank.
- Der Service Worker cached nur die App-Oberfläche und statische Dateien, niemals `/api`-Antworten oder Kundendaten.
- Echte Passwörter, 2FA-Kontakte, Datenbankschlüssel, Mail- und Push-Schlüssel gehören ausschließlich in Umgebungsvariablen.
- Der Code ist eine technisch abgesicherte Grundlage, aber keine pauschale Rechtsberatung oder Garantie vollständiger DSGVO-Konformität. Vor Produktivbetrieb müssen Datenschutzinformationen, Löschfristen, Auftragsverarbeitungsverträge, Berechtigungskonzept und interne Prozesse geprüft werden.

## Login-Ablauf

1. Firmen-Benutzername und Firmenpasswort
2. Profilauswahl: **Herr Voss** oder **Herr Dicke**
3. Profil antippen; der persönliche Einmalcode wird automatisch an die hinterlegte E-Mail-Adresse gesendet
4. Auf einem neuen Gerät einmalig einen sechsstelligen Schnell-PIN erstellen; auf bekannten Geräten den vorhandenen PIN eingeben
5. Danach bleibt die Serversitzung bestehen. Innerhalb des Entsperrfensters öffnet die App direkt; nach einer Sperre reicht der PIN.
6. Ein bewusstes Abmelden beendet die Serversitzung. Danach sind Firmenlogin, Profil und 2FA erneut erforderlich.

Der Schnell-PIN ist nur eine lokale Gerätesperre und ersetzt die serverseitige Anmeldung nicht.

## Enthaltene Funktionen

- animierte persönliche Begrüßung mit Firmenlogo
- Startseite mit wechselnden D2D-Impulsen, 8 Erfolgsschritten, 5 Abschlussschritten und 3-Phasen-Regel
- „Arbeitstag starten“ mit Stadtteil, Terminen, Rückläufern und erster Straße
- D2D-Schnellmodus: Hausnummer → Rot/Gelb/Grün/Grau
- Grün öffnet automatisch das Registerformular für abgeschlossene Kunden
- Gelb öffnet direkt die Eintragung eines gemeinsamen Rückkehrtermins
- eigenes, zusätzlich per Schnell-PIN geschütztes Register für abgeschlossene Kunden, Wiedervorlagen und Stornos
- direkter Anruf-, WhatsApp- und Navigationsbutton
- gemeinsamer Kalender für beide Profile
- internes Benachrichtigungszentrum mit getrennten Bestätigungen beider Nutzer
- private Arbeitszeit-Erinnerungen ab 20:00 Uhr nur für den betroffenen Nutzer
- Arbeitszeit, Pausen und Wochenstunden je Profil
- Partner-Live-Ticker mit Aktiv/Pause/Offline, Tagesverlauf, Terminen und aufgenommenen Kunden
- Aktivitätsnachweis beider Profile im wöchentlichen PDF-Bericht
- handschriftliche Tagesnotizen mit Stift, Radierer und Rückgängig
- Wochenplan aus `data/current-week.json`
- Original-PDF und Logo bereits als Grundlage eingebunden
- automatischer Wochenbericht am Sonntag um 09:00 Uhr `Europe/Berlin`
- PDF mit Straßen, Hausnummern, Statusfarben, Arbeitszeiten, Abschlüssen, Stornos und Handschrift
- Wochenarchiv mit eingebettetem Plan, Farbverlauf je Straße und erneut erzeugbarer PDF
- installierbare PWA mit App-Symbol
- responsive Desktop-/Notebook-Ansicht mit Seitenmenü sowie mobilem Menü oben links und Zurück-Button unten links

## Technischer Aufbau

- Next.js 16 App Router und TypeScript
- Supabase Auth für E-Mail-OTP
- Supabase PostgreSQL mit Row Level Security und Realtime-Synchronisierung
- serverseitige API-Routen für alle Arbeits- und Kundendaten
- Service Worker für PWA-Shell und Web Push
- Resend für den PDF-Mailversand
- Vercel Cron oder kompatibler Scheduler für Erinnerungen und Wochenbericht
- `pdf-lib` für die PDF-Erstellung

## Lokale Einrichtung

### 1. Abhängigkeiten

```bash
npm install
cp .env.example .env.local
```

Node.js 24 wird entsprechend `package.json` erwartet.

### 2. Supabase-Projekt vorbereiten

1. Ein eigenes Supabase-Projekt anlegen, idealerweise in einer passenden EU-Region.
2. `supabase/migrations/001_secure_fieldops.sql` im SQL Editor ausführen.
3. Danach `supabase/migrations/002_customer_privacy_and_documents.sql` ausführen. Diese Migration erstellt die private Dokumentablage und den nicht öffentlichen Storage-Bucket.
4. In Supabase Authentication zwei Benutzer anlegen: einen für Herrn Voss und einen für Herrn Dicke.
5. E-Mail-OTP aktivieren und die Vorlage auf den achtstelligen Token `{{ .Token }}` einstellen.
6. Die beiden `auth.users`-UUIDs in `supabase/seed.example.sql` einsetzen und das SQL ausführen.

Die Datenbankrichtlinien erlauben nur den beiden aktiven Datensätzen in `team_profiles` den Zugriff. Beide sehen die gemeinsamen Arbeitsdaten, Bestätigungen und Termine. Änderungen werden per Supabase Realtime übertragen; ein 15-Sekunden-Abgleich bleibt als Rückfallebene aktiv.

### 3. Firmenpasswort hashen

```bash
npm run hash:password
```

Den ausgegebenen Wert als `COMPANY_PASSWORD_SCRYPT` in `.env.local` eintragen. Das Klartextpasswort wird nicht im Repository gespeichert.

### 4. Umgebungsvariablen setzen

Mindestens erforderlich:

```env
COMPANY_USERNAME=VossDickeGbR
COMPANY_PASSWORD_SCRYPT=<scrypt-ausgabe>
COMPANY_GATE_SECRET=<mindestens-32-zufällige-zeichen>

VOSS_EMAIL=
DICKE_EMAIL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Für Mailversand und Push zusätzlich:

```env
REPORT_RECIPIENT=vossdickegbr@gmail.com
RESEND_API_KEY=
REPORT_FROM_EMAIL=Voss & Dicke App <app@eure-domain.de>
CUSTOMER_PRIVACY_FROM_EMAIL=Voss & Dicke GbR <datenschutz@eure-domain.de>
CUSTOMER_PRIVACY_REPLY_TO=vossdickegbr@gmail.com
CRON_SECRET=

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@eure-domain.de
```

VAPID-Schlüssel können zum Beispiel mit `npx web-push generate-vapid-keys` erzeugt werden.

### 5. Starten

```bash
npm run dev
```

Produktionsprüfung:

```bash
npm run check
```


## Kundenaufnahme, Dankes-E-Mail und optionaler Datenschutz-Nachweis

Die normale Kundenaufnahme speichert die Kundenkartei ohne zusätzliche Unterschrift. Ist eine E-Mail-Adresse hinterlegt, wird genau einmal eine reine Dankes-E-Mail mit Link zu `https://vossunddicke.de` angestoßen. Der Resend-Status und die Versand-ID werden in der Kundenkartei gespeichert; ein fehlgeschlagener Versand kann dort bewusst erneut ausgelöst werden.

Ein zusätzlicher Datenschutz-Nachweis ist freiwillig:

1. Datenschutzinformation anzeigen und die optionale Bestätigung aktivieren.
2. Auf Wunsch zusätzlich mit Finger, Maus oder Stift unterschreiben.
3. Die App erzeugt eine versionierte PDF mit SHA-256-Prüfsumme und speichert sie geschützt.

Die Datenschutz-PDF wird niemals automatisch per E-Mail verschickt. In der Kundenkartei kann sie geschützt heruntergeladen oder bewusst manuell versendet werden. Die freiwillige Unterschrift ist nur ein zusätzlicher Nachweis, keine pauschale Werbeeinwilligung und kein Strom- oder Gasvertrag.

Beim separaten Online-Datenschutzablauf werden persönlicher Link und sechsstelliger E-Mail-Code nur versendet, wenn dieser optionale Ablauf ausdrücklich ausgewählt wurde. Auch dort bleibt die Unterschrift freiwillig.

Nach Ablauf der Wiedervorlage beginnt eine siebentägige Nachfrist. Ohne dokumentierte Verlängerung wandert die Kartei anschließend in den Papierkorb und wird nach 30 Tagen endgültig einschließlich ihrer privaten App-Dokumente gelöscht. Gesetzlich zwingend aufzubewahrende Unterlagen und Daten in TeleSon-Systemen folgen den dort geltenden Regeln.

Die öffentliche Datenschutzerklärung und das Impressum sind unter `/datenschutz` und `/impressum` erreichbar. Die PDF-Fassungen liegen in `public/legal/`.

## Wöchentlichen Plan austauschen

Der aktive Plan liegt in:

```text
data/current-week.json
```

Sonntags muss nur diese Datei ersetzt werden. Das Schema bleibt gleich; Login, Kunden, Termine, Benachrichtigungen und Archive werden nicht verändert.

Prüfen:

```bash
npm run validate:week
```

Es gibt bewusst nur diese eine Plan-Datei. Der Service Worker speichert keine zweite Kopie. Eine spätere Ausbaustufe kann den geprüften Admin-Import direkt serverseitig aktivieren; im ersten Entwurf ersetzt du die Datei im Repository.

## Sonntagsbericht

`vercel.json` ruft `/api/cron/weekly-report` stündlich auf. Die Route prüft selbst die lokale Zeit in `Europe/Berlin` und arbeitet nur sonntags um 09:00 Uhr. Dadurch bleibt die Ausführung auch bei Sommer-/Winterzeit korrekt. Die Tabelle `weekly_reports` enthält einen eindeutigen Idempotenzschlüssel, damit eine Woche nicht doppelt versendet wird.

Ein manueller Test ist mit gültigem Cron-Secret möglich:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://eure-domain.de/api/cron/weekly-report?force=1"
```

## Push-Benachrichtigungen

Nach Erlaubnis im Browser registriert die App ein Push-Abonnement für das aktuell angemeldete Profil. Auf dem Sperrbildschirm werden nur allgemeine Hinweise angezeigt, keine Namen, Telefonnummern oder vollständigen Adressen.

- gemeinsame Termine und Wiedervorlagen: beide Profile
- Bestätigung: getrennt durch Herrn Voss und Herrn Dicke
- Arbeitszeit-Erinnerung ab 20:00 Uhr: nur das betroffene Profil
- unbestätigte fällige Hinweise werden wiederholt gepusht

## PWA installieren

- Chrome/Edge/Android: In der App **„App installieren“** antippen.
- iPhone/iPad: Safari → Teilen → **„Zum Home-Bildschirm“**.
- PC/Notebook: Installation über die Browser-Adressleiste oder den Button in der App.

## Sicherheitsmodell

- Supabase Auth-Sitzung vor jedem Datenzugriff
- RLS auf allen Nutzdatentabellen; anonyme Zugriffe sind entzogen
- normale API-Routen verwenden den angemeldeten Benutzer, nicht den Service-Key
- Service-Key nur in Cron-, Push- und Rate-Limit-Servercode
- serverseitig gehashtes Firmenpasswort mit `scrypt`
- HttpOnly-Firmen-Gate-Cookie
- 2FA-Kontakte ausschließlich serverseitig
- serverseitiges Rate Limiting für Firmenlogin, OTP-Versand und OTP-Prüfung
- strikte Eingabevalidierung und Größenbegrenzung vor Datenbankänderungen
- CSP, Clickjacking-Schutz, Referrer- und Permissions-Policy
- Audit-Log für wichtige Änderungen
- Stornos werden nicht durch Löschen versteckt
- keine Kundendaten im GitHub-Repository
- keine Kundendaten im PWA-Cache und `no-store` für alle API-Antworten
- GitHub Actions prüfen Typen, Lint, Wochenplan und Build

Der genaue Stand und die noch offenen Produktionsschritte sind in [PROJEKTSTATUS.md](PROJEKTSTATUS.md) dokumentiert.

Die vollständige Einrichtung ist zusätzlich in [docs/SETUP-KURZANLEITUNG.md](docs/SETUP-KURZANLEITUNG.md) zusammengefasst. Weitere Hinweise stehen in [SECURITY.md](SECURITY.md) und [docs/DATENSCHUTZ-CHECKLISTE.md](docs/DATENSCHUTZ-CHECKLISTE.md).

## Projektstruktur

```text
app/                         Next.js Oberfläche und API-Routen
components/auth/             Login, Profilauswahl, 2FA, PIN
components/app/              Dashboard und Arbeitsbereiche
data/current-week.json       austauschbarer aktiver Wochenplan
lib/                         Auth, Datenbank, PDF, Push, Zeitlogik
public/                      Logo, Icons, Service Worker, Referenz-PDF
supabase/migrations/         Datenbankschema und RLS
vercel.json                  Cron-Zeitpläne
```

## Nächste sinnvolle Produktionsschritte

1. echte Supabase-Umgebung und beide Benutzer verbinden
2. E-Mail-OTP mit beiden realen Kontakten und dem achtstelligen Code testen
3. Push auf allen verwendeten iPhones, Tablets und Rechnern testen
4. Datenlösch- und Aufbewahrungsfristen festlegen
5. verschlüsselte Backups und Wiederherstellungstest einrichten
6. Admin-Wochenimport serverseitig aktivieren
7. Penetrationstest und Datenschutzprüfung vor dem Einsatz mit echten Kundendaten

## Produktionspflichten außerhalb des Codes

Vor Verarbeitung echter Kundendaten müssen mindestens die Auftragsverarbeitungsverträge und Anbieterprüfungen für Supabase, Vercel, Resend und den geschäftlichen E-Mail-Dienst abgeschlossen beziehungsweise dokumentiert sein. Der E-Mail-Absender für Resend muss zu einer verifizierten eigenen Domain gehören; die Gmail-Adresse kann als Antwortadresse genutzt werden. Register-, Steuer- und spätere Geschäftsnummern werden über die `NEXT_PUBLIC_COMPANY_*`-Variablen aktualisiert.

Die ladungsfähige Geschäftsanschrift gehört in ein geschäftliches Impressum und kann nicht allein deshalb weggelassen werden, weil sie zugleich privat genutzt wird. Vor dem Livegang sollten die Rechtstexte und das Löschkonzept einmal fachlich geprüft werden.
