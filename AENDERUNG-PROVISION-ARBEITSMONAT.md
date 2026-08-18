# Änderung: Kundenzuordnung, Provision und Arbeitsmonat

## Ziel
Die App dokumentiert nicht nur, über welches Profil eine Kundenkartei technisch erstellt wurde, sondern zusätzlich die wirtschaftliche Zuordnung des Abschlusses und die genaue Provision.

## Neue Regeln in der App

- Wirtschaftliche Zuordnung pro Abschluss: **Herr Voss 100 %**, **Herr Dicke 100 %** oder **Gemeinsam 50/50**.
- Die Provision wird als Pflichtbetrag eingegeben und intern centgenau gespeichert.
- Der technische Ersteller (`completedBy`) bleibt als Nachweis erhalten und wird nicht mit der wirtschaftlichen Zuordnung verwechselt.
- Stornierte Kunden erzeugen in den Übersichten einen Provisionsanspruch von 0,00 EUR.
- Legacy-Kunden ohne Provisionsbetrag bleiben lesbar und werden als „Provision fehlt“ markiert.

## Arbeitsmonat

Vorläufig ist der Abrechnungszeitraum auf **16. eines Monats bis einschließlich 15. des Folgemonats** festgelegt. Das Kundenregister kann nach Arbeitsmonat sowie nach Voss, Dicke und 50/50 gefiltert werden. Für jeden Arbeitsmonat werden Provision gesamt und die daraus errechneten Anteile von Voss und Dicke angezeigt.

## Wochenbericht

Der Wochenbereich zeigt live:

- Anspruch Herr Voss
- Anspruch Herr Dicke
- aktive Provision gesamt
- Anzahl der Abschlüsse und 50/50-Abschlüsse

Der PDF-Wochenabschluss enthält zusätzlich eine eigene Seite „Vertrieb & Provision“ mit anonymisierter Einzelauflistung pro Abschluss. Kundennamen und Kontaktangaben werden dort nicht ausgegeben.

## Wochenarchiv

Neue Wochenarchive speichern zusätzlich die Provisionssummen von Voss und Dicke, die Gesamtprovision und die Zahl der 50/50-Abschlüsse. Ältere Archive ohne diese Felder bleiben kompatibel.

## Hinweis

Die angezeigten Beträge sind die aus den in der App eingetragenen Provisionen berechneten internen Ansprüche. Eine Prüfung, ob eine Provision tatsächlich auf dem Geschäftskonto eingegangen ist, ist in dieser Version noch nicht enthalten.
