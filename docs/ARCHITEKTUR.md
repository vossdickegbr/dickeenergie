# Architektur

## Datenfluss beim Öffnen

1. Die PWA startet mit der statischen Oberfläche.
2. `/api/auth/session` prüft die Supabase-Sitzung und ermittelt das persönliche Profil aus `team_profiles`.
3. Ist das Gerät innerhalb des lokalen Entsperrfensters, öffnet die App direkt. Andernfalls wird der Schnell-PIN verlangt.
4. Nach Freigabe ruft `AppDataProvider` automatisch `/api/data/snapshot` auf.
5. Die Serverroute prüft erneut die Auth-Sitzung und lädt die gemeinsamen Datensätze aus `app_records` unter RLS.
6. Änderungen laufen über `/api/data/mutate`; der Server setzt das tatsächlich angemeldete Profil und schreibt Audit-Einträge.
7. Supabase Realtime stößt nach Änderungen sofort einen neuen Snapshot an. Alle 15 Sekunden und beim erneuten Fokus erfolgt zusätzlich ein Abgleich.

## Warum GitHub keine Kundendaten enthält

GitHub enthält nur Quellcode, den austauschbaren Wochenplan und Designressourcen. Kundendaten, Termine, Arbeitszeiten und Benachrichtigungen werden ausschließlich in Supabase gespeichert. API-Antworten werden vom Service Worker ausdrücklich nicht gecacht.

## Zeitautomatik

Vercel Cron arbeitet mit UTC. Deshalb wird der Wochenbericht stündlich angestoßen und prüft innerhalb der Route `Europe/Berlin`. Ein eindeutiger Datenbankschlüssel verhindert doppelten Versand.


## Archivierung

Der Archivdatensatz enthält den zu dieser Woche gehörenden Plan und Kennzahlen. Die eigentlichen Wochen-Datensätze bleiben anhand ihrer `weekId` in der geschützten Datenbank erhalten. Dadurch kann eine alte Woche später geöffnet und die PDF erneut erzeugt werden, ohne Kundendaten in GitHub oder eine öffentliche Datei zu kopieren.
