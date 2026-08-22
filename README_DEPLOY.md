# Dicke Energieberatung – Website-Übergabe

Diese ZIP bleibt als direkter Ersatz für den bisherigen Repository-Inhalt aufgebaut. Die übrigen App-/Dokumentationsordner wurden bewusst nicht entfernt.

## Veröffentlichung

1. Den Inhalt dieser ZIP in das bestehende Repository übernehmen.
2. Darauf achten, dass `index.html`, `CNAME`, `css`, `js` und `img` direkt im Veröffentlichungsordner liegen.
3. In GitHub unter **Settings → Pages** prüfen, dass die richtige Branch-Quelle ausgewählt ist.
4. Die neue `CNAME`-Datei enthält `vossunddicke.de`.
5. Beim Domainanbieter die DNS-Einträge auf den tatsächlich verwendeten Hostingweg setzen.
6. **Enforce HTTPS** aktivieren, sobald GitHub Pages die neue Domain akzeptiert.

## Vor dem öffentlichen Start zwingend ergänzen

In `impressum.html` und `datenschutz.html` fehlen noch die endgültige ladungsfähige Geschäftsanschrift und die abschließende rechtliche Prüfung des tatsächlichen Unternehmens-/Hostingstatus.

Nach diesen Platzhaltern suchen:

- `[Straße, Hausnummer]`
- `[PLZ Ort]`
- `[Straße, Hausnummer, PLZ und Ort ergänzen]`

Die Hinweise in den Rechtsseiten erst entfernen, wenn die Angaben tatsächlich geprüft und vollständig sind.

## Öffentliche Kontaktdaten

- Öffentliche Telefonnummer / WhatsApp: noch nicht hinterlegt
- Öffentliche E-Mail: noch nicht hinterlegt
- Domain: `vossunddicke.de`

Die technische Account-Adresse wird auf der Website bewusst nicht verwendet und bleibt ausschließlich in den jeweiligen Account-Einstellungen hinterlegt.

## Technischer Aufbau der Website

- Reines HTML, CSS und JavaScript
- Keine Build-Schritte für die statische Website notwendig
- Keine externen Schriftarten
- Keine externen 3D-Bibliotheken
- Der 3D-Energieeffekt wird lokal per Canvas/JavaScript berechnet
- 3D-Tilt- und Microinteractions ausschließlich als progressive Verbesserung
- `prefers-reduced-motion` wird respektiert
- Keine Analyse- oder Trackingdienste
- Keine Cookies durch die Website selbst
- Responsive Navigation und mobile Kontaktleiste
- Interaktive Kontaktauswahl läuft ausschließlich lokal im Browser

## Neue Website-Assets

- `img/dicke-skyline.webp` – Bonn/Köln/Rhein-Hintergrund
- `img/dicke-brand-landscape.webp` – vollständiges Markenmotiv
- `img/dicke-founder-mark.webp` – persönliches Logo
- `img/bjoern-dicke.webp` – freigestelltes Portrait
- `img/og-image.jpg` – Social-/Open-Graph-Vorschau

## Hinweis zur App

Ordner wie `app/`, `components/`, `lib/`, `supabase/`, große Teile von `docs/` sowie die zugehörigen Next.js-Dateien gehören zur FieldOps-App und wurden bei diesem Website-Umbau nicht inhaltlich migriert. Sie bleiben unverändert im Paket.
