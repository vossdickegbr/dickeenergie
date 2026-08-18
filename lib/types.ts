export type ProfileId = 'voss' | 'dicke'
export type CustomerAttribution = ProfileId | 'both'
export type AddressStatus = 'open' | 'absent' | 'red' | 'yellow' | 'green'

export type CustomerServiceType = 'strom' | 'gas' | 'both'
export type CustomerRecordState = 'draft' | 'active' | 'deletion_pending'
export type PrivacyEmailStatus = 'not_requested' | 'pending' | 'sent' | 'failed' | 'configuration_required'
export type WelcomeEmailStatus = 'not_requested' | 'sent' | 'failed' | 'configuration_required'

export interface PrivacyReceipt {
  version: string
  acknowledgedAt: string
  acknowledgedBy: ProfileId | 'customer'
  acknowledgementMethod: 'signature' | 'confirmation' | 'remote_signature' | 'remote_confirmation' | 'paper'
  documentId: string
  fileName: string
  sha256: string
  emailStatus: PrivacyEmailStatus
  emailAddress?: string
  emailSentAt?: string
  emailError?: string
  storageStatus?: 'pending' | 'stored' | 'inline_fallback'
  storageError?: string
  pdfStatus?: 'pending' | 'ready' | 'failed'
  pdfError?: string
  signatureDataUrl?: string
  inlinePdfBase64?: string
}

export interface WelcomeEmailReceipt {
  status: WelcomeEmailStatus
  emailAddress?: string
  sentAt?: string
  resendId?: string
  error?: string
}

export interface CustomerDocumentMeta {
  id: string
  customerId: string
  kind: 'privacy_notice' | 'customer_attachment'
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
  createdAt: string
}
export type AppSection =
  | 'home'
  | 'today'
  | 'week'
  | 'customers'
  | 'calendar'
  | 'notifications'
  | 'archive'
  | 'trash'
  | 'partnerActivity'
  | 'admin'

export interface WeekGoal {
  contracts: string
  tariffChecks: string
  note: string
}

export interface DayGoal {
  label: string
  value: string
  caption: string
}

export interface ScheduleItem {
  time: string
  label: string
  detail: string
}

export interface MapRoute {
  label: string
  stops: string[]
}

export interface WeekDay {
  id: string
  dayNumber: number
  weekday: string
  date: string
  title: string
  subtitle: string
  goalText: string
  goals: DayGoal[]
  schedule: ScheduleItem[]
  analysis: {
    chance: string
    risk: string
    tactic: string
  }
  start: string
  end: string
  housePointEstimate: string
  streets: string[]
  reserveStreets?: string[]
  routeNote: string
  fieldRule: string
  mapRoutes: MapRoute[]
}

export interface WeekPlan {
  id: string
  title: string
  district: string
  startsOn: string
  endsOn: string
  workingHours: string
  teamSize: number
  weeklyGoal: WeekGoal
  motto: string
  sourcePdf: string
  days: WeekDay[]
  dailyClosing: {
    metrics: string[]
    reflection: string[]
  }
}

export interface AddressVisit {
  id: string
  weekId: string
  dayId: string
  street: string
  houseNumber: string
  status: AddressStatus
  profileId: ProfileId
  createdAt: string
  updatedAt: string
  callbackAt?: string
  note?: string
  customerId?: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  street: string
  houseNumber: string
  postalCode?: string
  city: string
  district: string
  completedAt: string
  completedBy: ProfileId
  /** Wirtschaftliche Zuordnung des Abschlusses. Legacy-Datensätze fallen auf completedBy zurück. */
  salesOwner?: CustomerAttribution
  /** Erwartete Provision in Euro-Cent. */
  commissionAmountCents?: number
  weekId: string
  dayId: string
  source?: 'd2d' | 'online' | 'website' | 'telephone' | 'event'
  serviceType?: CustomerServiceType
  recordState?: CustomerRecordState
  note?: string
  followUpAt?: string
  followUpGraceUntil?: string
  lastContactAt?: string
  privacyReceipt?: PrivacyReceipt
  welcomeEmail?: WelcomeEmailReceipt
  status: 'active' | 'cancelled'
  cancellation?: {
    date: string
    reason: string
    category: 'withdrawal' | 'provider_rejected' | 'data_error' | 'other'
    createdBy: ProfileId
  }
  createdAt: string
  updatedAt: string
}



export type OnlineCustomerIntakeStatus =
  | 'email_pending'
  | 'email_sent'
  | 'opened'
  | 'completed'
  | 'finalized'
  | 'expired'
  | 'failed'

export interface OnlineCustomerIntakeCustomer {
  name: string
  phone: string
  email: string
  street: string
  houseNumber: string
  postalCode: string
  city: string
  district: string
  serviceType: CustomerServiceType
  salesOwner?: CustomerAttribution
  commissionAmountCents?: number
  followUpAt: string
  weekId: string
  dayId: string
  source: 'online'
}

export interface OnlineCustomerIntake {
  id: string
  reservedCustomerId: string
  status: OnlineCustomerIntakeStatus
  customer: OnlineCustomerIntakeCustomer
  createdBy: ProfileId
  privacyNoticeVersion: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  emailSentAt?: string
  openedAt?: string
  emailVerifiedAt?: string
  privacyAcceptedAt?: string
  signedAt?: string
  completedAt?: string
  finalizedAt?: string
  deliveryError?: string
  privacyEmailStatus?: PrivacyEmailStatus
  privacyEmailSentAt?: string
  privacyEmailError?: string
  signatureDataUrl?: string
  privacyReceipt?: PrivacyReceipt
  finalCustomerId?: string
}

export interface Appointment {
  id: string
  title: string
  startsAt: string
  endsAt?: string
  address?: string
  phone?: string
  customerId?: string
  weekId?: string
  dayId?: string
  assignedTo: 'both' | ProfileId
  createdBy: ProfileId
  note?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  reminderMinutes: number[]
  createdAt: string
  updatedAt: string
}

export interface NotificationItem {
  id: string
  type:
    | 'appointment'
    | 'follow_up'
    | 'callback'
    | 'week'
    | 'day_close'
    | 'system'
    | 'cancellation'
    | 'worktime'
  title: string
  summary: string
  scheduledAt: string
  linkedType?: 'appointment' | 'customer' | 'day' | 'week'
  linkedId?: string
  audience: 'both' | ProfileId
  ackVossAt?: string
  ackDickeAt?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface WorkSession {
  id: string
  profileId: ProfileId
  date: string
  startedAt: string
  endedAt?: string
  pauses: Array<{ startedAt: string; endedAt?: string }>
  correctionNote?: string
  updatedAt: string
}

export interface DayNote {
  id: string
  weekId: string
  dayId: string
  profileId: ProfileId
  drawingDataUrl?: string
  text?: string
  reflection?: Record<string, string>
  updatedAt: string
}

export interface WeekArchive {
  id: string
  weekId: string
  title: string
  district: string
  startsOn: string
  endsOn: string
  archivedAt: string
  summary: {
    visits: number
    red: number
    yellow: number
    green: number
    cancelled: number
    netContracts: number
    workMinutesVoss: number
    workMinutesDicke: number
    commissionTotalCents?: number
    commissionVossCents?: number
    commissionDickeCents?: number
    sharedCustomers?: number
  }
  improvementNotes: {
    voss?: string
    dicke?: string
    team?: string
  }
  plan?: WeekPlan
  report?: {
    fileName: string
    sentAt?: string
  }
}

export interface DeletedVisit {
  id: string
  kind: 'deleted_visit'
  visit: AddressVisit
  related: {
    customers: Customer[]
    appointments: Appointment[]
    notifications: NotificationItem[]
  }
  deletedAt: string
  deletedBy: ProfileId
  createdAt: string
  updatedAt: string
}


export interface DeletedCustomer {
  id: string
  kind: 'deleted_customer'
  customer: Customer
  related: {
    visits: AddressVisit[]
    appointments: Appointment[]
    notifications: NotificationItem[]
    documents: CustomerDocumentMeta[]
  }
  deletedAt: string
  deletedBy: ProfileId | 'system'
  purgeAfter: string
  reason: 'manual' | 'service_ended' | 'follow_up_expired' | 'incomplete_intake'
  createdAt: string
  updatedAt: string
}

export interface AppSnapshot {
  visits: AddressVisit[]
  customers: Customer[]
  appointments: Appointment[]
  notifications: NotificationItem[]
  workSessions: WorkSession[]
  dayNotes: DayNote[]
  archives: WeekArchive[]
  deletedVisits: DeletedVisit[]
  deletedCustomers: DeletedCustomer[]
  onlineCustomerIntakes: OnlineCustomerIntake[]
}
