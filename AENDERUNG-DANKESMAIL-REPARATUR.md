# Reparatur: Dankes-E-Mail und optionale Datenschutzbestätigung

## Behoben

1. Eine neu angelegte Kundenkartei mit E-Mail-Adresse löst die reine Dankes-E-Mail jetzt direkt im serverseitigen Speichervorgang aus.
2. Der Versandstatus wird in der Kundenkartei gespeichert: Empfänger, Status, Zeitpunkt, Resend-Versand-ID oder konkrete Fehlermeldung.
3. Ein Versandfehler löscht oder blockiert die bereits gespeicherte Kundenkartei nicht.
4. Über „Dankes-E-Mail senden“ kann der Versand bewusst erneut versucht werden.
5. Der bisher rote Bereich „Unterschriebene Kundeninformation“ heißt jetzt „Optionaler Datenschutz-Nachweis“.
6. Fehlt dieser freiwillige Nachweis, erscheint eine neutrale Information und keine rote Fehlermeldung.
7. Die gezeichnete Unterschrift ist im persönlichen und im Online-Ablauf freiwillig.
8. Die Datenschutz-PDF wird gespeichert, aber nie automatisch per E-Mail versendet oder automatisch erneut versucht.
9. Der öffentliche Bestätigungsbutton verspricht keinen automatischen PDF-Versand mehr.
10. Veraltete Rechtstexte und Hinweise zum automatischen PDF-Versand wurden korrigiert.

## Test nach dem Deployment

1. Einen vollständig neuen Testkunden mit E-Mail-Adresse anlegen.
2. Kundenkartei öffnen und unter „Dankes-E-Mail“ den Status prüfen.
3. Bei Status „An Versanddienst übergeben“ die dort gespeicherte Versand-ID in Resend unter „Emails“ prüfen.
4. Bei einer Fehlermeldung die angezeigte Vercel-/Resend-Konfiguration korrigieren und „Dankes-E-Mail senden“ erneut drücken.
5. Kontrollieren, dass ein Kunde ohne optionalen Datenschutz-Nachweis keine rote Fehleranzeige erhält.
