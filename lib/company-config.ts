function setting(name: string, fallback: string) {
  const value = process.env[name]
  return value?.trim() || fallback
}

export const COMPANY_CONFIG = {
  legalName: setting('NEXT_PUBLIC_COMPANY_LEGAL_NAME', 'Voss & Dicke GbR'),
  legalForm: 'Gesellschaft bürgerlichen Rechts (GbR)',
  street: setting('NEXT_PUBLIC_COMPANY_STREET', 'Immenburgstraße 33'),
  postalCode: setting('NEXT_PUBLIC_COMPANY_POSTAL_CODE', '53121'),
  city: setting('NEXT_PUBLIC_COMPANY_CITY', 'Bonn'),
  country: 'Deutschland',
  phone: setting('NEXT_PUBLIC_COMPANY_PHONE', ''),
  email: setting('NEXT_PUBLIC_COMPANY_EMAIL', ''),
  website: setting('NEXT_PUBLIC_COMPANY_WEBSITE', 'https://vossunddicke.de'),
  representatives: ['Kevin Voss', 'Björn Dicke'] as const,
  privacyContactName: 'Kevin Voss',
  registerStatus: setting('NEXT_PUBLIC_COMPANY_REGISTER_STATUS', 'Eintragung in das Gesellschaftsregister geplant; Registernummer wird nach Gründung ergänzt.'),
  vatStatus: setting('NEXT_PUBLIC_COMPANY_VAT_STATUS', 'Umsatzsteuer-Identifikationsnummer wird nach Erteilung ergänzt.'),
  businessPurpose: 'Persönliche, telefonische und digitale Beratung sowie Vermittlung von Strom- und Gaslieferverträgen als Vertriebspartner der TeleSon Vertriebs GmbH.',
} as const

export const PRIVACY_NOTICE_VERSION = setting('NEXT_PUBLIC_PRIVACY_NOTICE_VERSION', '1.0-2026-07-21')

export const RETENTION_CONFIG = {
  followUpGraceDays: 7,
  customerTrashDays: 30,
  visitTrashDays: 30,
  securityLogDays: 180,
  emailLogDays: 180,
} as const

export const CUSTOMER_DOCUMENT_BUCKET = 'customer-documents'
