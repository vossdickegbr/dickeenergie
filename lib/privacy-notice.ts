import { COMPANY_CONFIG, PRIVACY_NOTICE_VERSION, RETENTION_CONFIG } from '@/lib/company-config'

export interface PrivacySection {
  title: string
  paragraphs: string[]
}

const address = `${COMPANY_CONFIG.street}, ${COMPANY_CONFIG.postalCode} ${COMPANY_CONFIG.city}, ${COMPANY_CONFIG.country}`

export const CUSTOMER_PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. Verantwortlicher und Kontakt',
    paragraphs: [
      `${COMPANY_CONFIG.legalName}, ${address}. Vertreten durch ${COMPANY_CONFIG.representatives.join(' und ')}. Telefon: ${COMPANY_CONFIG.phone}. E-Mail: ${COMPANY_CONFIG.email}.`,
      `Ansprechpartner für Datenschutzanfragen ist ${COMPANY_CONFIG.privacyContactName}. Anfragen können per E-Mail, telefonisch, per WhatsApp oder postalisch gestellt werden.`,
    ],
  },
  {
    title: '2. Zwecke und Umfang der Verarbeitung',
    paragraphs: [
      'Wir verarbeiten nur die Daten, die für die Aufnahme, Organisation und Betreuung einer angefragten Strom- oder Gasberatung erforderlich sind. Dazu gehören insbesondere Name, Anschrift, Telefonnummer, freiwillig angegebene E-Mail-Adresse, gewünschte Sparte (Strom, Gas oder beides), Wiedervorlage- und Kontaktdaten, kurze sachliche Gesprächsnotizen sowie der Nachweis, dass diese Datenschutzinformation bereitgestellt wurde.',
      'Vertragsabschlüsse, Tarifvergleiche und die vollständige Vertragsabwicklung erfolgen nicht in dieser App, sondern ausschließlich über die Systeme der TeleSon Vertriebs GmbH. Optional überlassene Dokumente werden nur gespeichert, wenn dies für die konkrete Beratung erforderlich oder vom Kunden ausdrücklich gewünscht ist.',
    ],
  },
  {
    title: '3. Rechtsgrundlagen',
    paragraphs: [
      'Die Verarbeitung zur Beratung, zur Vorbereitung und Durchführung einer gewünschten Vermittlungsleistung sowie zur anschließenden Betreuung erfolgt auf Grundlage von Art. 6 Abs. 1 Buchst. b DSGVO. Gesetzlich erforderliche Aufbewahrungen erfolgen nach Art. 6 Abs. 1 Buchst. c DSGVO.',
      'Für IT-Sicherheit, Missbrauchsabwehr, interne Nachweisführung und die Geltendmachung oder Abwehr von Ansprüchen kann Art. 6 Abs. 1 Buchst. f DSGVO maßgeblich sein. Freiwillige Werbekontakte, die über die konkret gewünschte Betreuung hinausgehen, erfolgen nur nach einer gesonderten, jederzeit widerruflichen Einwilligung nach Art. 6 Abs. 1 Buchst. a DSGVO.',
    ],
  },
  {
    title: '4. Empfänger und eingesetzte Dienstleister',
    paragraphs: [
      'Soweit für die gewünschte Beratung oder Vermittlung erforderlich, werden Daten an die TeleSon Vertriebs GmbH und über deren Systeme an die jeweils ausgewählten Energieversorger übermittelt. Welche Vertragsdaten dort verarbeitet werden, richtet sich nach dem konkreten Auftrag und den dortigen Datenschutzinformationen.',
      'Für den technischen Betrieb können insbesondere Supabase (Datenbank, Authentifizierung und private Dokumentenspeicherung in der Region EU North 1), Vercel (Hosting der internen App), Resend (E-Mail-Versand), Google/Gmail (geschäftliche Kommunikation), GitHub Pages (öffentliche Website) und - nur bei Nutzung durch den Kunden - WhatsApp/Meta eingesetzt werden. Mit Auftragsverarbeitern werden die erforderlichen Datenschutzvereinbarungen abgeschlossen und Unterauftragnehmer regelmäßig geprüft.',
    ],
  },
  {
    title: '5. Drittlandübermittlungen',
    paragraphs: [
      'Einzelne technische Anbieter oder deren Unterauftragnehmer können ihren Sitz außerhalb des Europäischen Wirtschaftsraums haben. Soweit dadurch ein Drittlandtransfer entsteht, erfolgt er nur auf Grundlage eines Angemessenheitsbeschlusses, geeigneter Garantien wie EU-Standardvertragsklauseln oder einer anderen zulässigen Rechtsgrundlage. Die jeweils aktuelle Anbieterliste kann bei uns angefordert werden.',
    ],
  },
  {
    title: '6. Speicherdauer und Löschung',
    paragraphs: [
      `Die operative Kundenkartei wird nur solange geführt, wie die vereinbarte Betreuung benötigt wird. Ist ein Wiedervorlagedatum abgelaufen und wird die Betreuung nicht verlängert, wird der Datensatz nach einer Nachfrist von ${RETENTION_CONFIG.followUpGraceDays} Tagen in den geschützten Papierkorb verschoben. Dort wird er nach weiteren ${RETENTION_CONFIG.customerTrashDays} Tagen endgültig einschließlich zugehöriger App-Dokumente gelöscht.`,
      'Beendet der Kunde die Betreuung ausdrücklich, kann die aktive Kundenkartei sofort vollständig gelöscht werden. Ausgenommen sind nur Daten, die wir aufgrund gesetzlicher Pflichten oder zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen noch benötigen. Solche Daten werden gesperrt, nicht weiter für Betreuung oder Werbung genutzt und nach Fristablauf gelöscht. Daten in den TeleSon-Systemen unterliegen den dort geltenden Aufbewahrungs- und Löschregeln.',
    ],
  },
  {
    title: '7. Pflichtangaben und freiwillige Angaben',
    paragraphs: [
      'Name, Anschrift, Telefonnummer und die gewünschte Sparte werden benötigt, um die Beratung zuordnen und durchführen zu können. Die E-Mail-Adresse ist freiwillig. Wird sie angegeben, kann die bestätigte Datenschutzinformation auf Wunsch manuell als PDF an diese Adresse gesendet werden. Ein automatischer Versand nach der Bestätigung findet nicht statt. Ohne die erforderlichen Angaben kann die gewünschte Betreuung nicht zuverlässig durchgeführt werden.',
    ],
  },
  {
    title: '8. Rechte der betroffenen Person',
    paragraphs: [
      'Betroffene Personen haben im Rahmen der gesetzlichen Voraussetzungen das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Erteilte Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde, insbesondere bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.',
    ],
  },
  {
    title: '9. Automatisierte Entscheidungen',
    paragraphs: [
      'Eine ausschließlich automatisierte Entscheidung mit rechtlicher oder ähnlich erheblicher Wirkung einschließlich Profiling findet nicht statt. Automatisch erzeugte Erinnerungen und Löschfristen unterstützen nur die Organisation und werden durch berechtigte Nutzer kontrolliert.',
    ],
  },
  {
    title: '10. Bestätigung und freiwillige Unterschrift',
    paragraphs: [
      'Der Erhalt dieser Datenschutzinformation wird durch den persönlichen Link, den E-Mail-Bestätigungscode, Datum, Uhrzeit und die aktive Bestätigung dokumentiert. Eine handschriftliche oder gezeichnete Unterschrift ist hierfür nicht erforderlich und kann freiwillig als zusätzlicher Nachweis geleistet werden. Sie ist keine pauschale Einwilligung in beliebige Datenverarbeitungen, keine Vertragsunterschrift und keine automatische Verlängerung eines Energievertrags.',
    ],
  },
]

export const WEBSITE_PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. Verantwortlicher',
    paragraphs: [
      `${COMPANY_CONFIG.legalName}, ${address}. Vertreten durch ${COMPANY_CONFIG.representatives.join(' und ')}. Telefon: ${COMPANY_CONFIG.phone}. E-Mail: ${COMPANY_CONFIG.email}.`,
    ],
  },
  {
    title: '2. Website- und App-Betrieb',
    paragraphs: [
      'Beim Aufruf der öffentlichen Website oder der geschützten App verarbeiten die Hostinganbieter technisch erforderliche Verbindungsdaten wie IP-Adresse, Zeitpunkt, aufgerufene Ressource, Browser- und Geräteinformationen sowie Sicherheitsereignisse. Dies dient der sicheren und stabilen Bereitstellung auf Grundlage von Art. 6 Abs. 1 Buchst. f DSGVO.',
      'Die öffentliche Website wird über GitHub Pages bereitgestellt. Die interne FieldOps-App kann über Vercel gehostet werden. Kundendaten der internen App werden in einer geschützten Supabase-Datenbank in der Region EU North 1 gespeichert. API-Antworten mit Kundendaten werden nicht im Service-Worker-Cache gespeichert.',
    ],
  },
  {
    title: '3. Technisch erforderliche Speicherungen',
    paragraphs: [
      'Die geschützte App verwendet technisch erforderliche Cookies und lokale Speicherungen für Anmeldung, 2FA-Sitzung, Gerätesperre und den verschlüsselten lokalen PIN-Prüfwert. Diese Funktionen sind notwendig, um den ausdrücklich gewünschten geschützten Dienst bereitzustellen. Marketing- oder Analyse-Cookies werden in der App standardmäßig nicht eingesetzt.',
    ],
  },
  {
    title: '4. Kontaktaufnahme',
    paragraphs: [
      'Bei Kontakt per Formular, E-Mail, Telefon oder WhatsApp verarbeiten wir die mitgeteilten Daten zur Bearbeitung der Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO bei vertragsbezogenen Anfragen, ansonsten Art. 6 Abs. 1 Buchst. f DSGVO. WhatsApp ist ein Dienst von Meta; bei Nutzung können Metadaten durch Meta verarbeitet werden. Alternativ stehen E-Mail und Telefon zur Verfügung.',
    ],
  },
  {
    title: '5. Energieberatung und Kundenverwaltung',
    paragraphs: CUSTOMER_PRIVACY_SECTIONS.slice(1, 10).flatMap((section) => section.paragraphs),
  },
  {
    title: '6. Social-Media-Auftritte und Werbung',
    paragraphs: [
      'Wir können Unternehmensprofile und Werbeinhalte auf Instagram, Facebook, TikTok und LinkedIn betreiben. Beim Besuch dieser Plattformen gelten zusätzlich die Datenschutzbestimmungen der jeweiligen Plattformbetreiber. In unserer eigenen Website werden keine Social-Media-Tracking-Pixel oder eingebetteten Inhalte eingesetzt, solange dies nicht ausdrücklich anders angegeben und erforderlichenfalls zuvor freigegeben wird.',
    ],
  },
  {
    title: '7. Rechte und Aufsichtsbehörde',
    paragraphs: [
      'Es gelten die in Abschnitt 8 der Kundeninformation beschriebenen Betroffenenrechte. Datenschutzanfragen richten Sie bitte an die oben genannten Kontaktdaten. Zuständige Aufsichtsbehörde ist grundsätzlich die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.',
    ],
  },
]

export function privacyNoticePlainText() {
  return CUSTOMER_PRIVACY_SECTIONS.map((section) => `${section.title}\n${section.paragraphs.join('\n\n')}`).join('\n\n')
}

export const PRIVACY_NOTICE_META = {
  version: PRIVACY_NOTICE_VERSION,
  title: 'Datenschutzinformation für Kunden und Interessenten nach Art. 13 DSGVO',
  acknowledgementText: 'Ich bestätige, die Datenschutzinformation der Voss & Dicke GbR in der angezeigten Version erhalten zu haben und vor der Datenerfassung einsehen zu können.',
} as const
