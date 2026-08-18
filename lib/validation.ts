import { z } from 'zod'

export const profileSchema = z.enum(['voss', 'dicke'])
export const audienceSchema = z.union([z.literal('both'), profileSchema])
export const idSchema = z.string().trim().min(1).max(140)
export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const timestampSchema = z.string().min(10).max(48).refine((value) => Number.isFinite(Date.parse(value)), 'Ungültiges Datum')
const optionalTimestamp = timestampSchema.optional()
const optionalText = (max: number) => z.string().trim().max(max).optional()

export const visitInputSchema = z.object({
  id: idSchema.optional(),
  weekId: idSchema,
  dayId: idSchema,
  street: z.string().trim().min(1).max(160),
  houseNumber: z.string().trim().min(1).max(24),
  status: z.enum(['open', 'absent', 'red', 'yellow', 'green']),
  profileId: profileSchema.optional(),
  callbackAt: optionalTimestamp,
  note: optionalText(2_000),
  customerId: idSchema.optional(),
  createdAt: optionalTimestamp,
  updatedAt: optionalTimestamp,
}).strict()

export const privacyReceiptSchema = z.object({
  version: z.string().trim().min(1).max(80),
  acknowledgedAt: timestampSchema,
  acknowledgedBy: z.union([profileSchema, z.literal('customer')]),
  acknowledgementMethod: z.enum(['signature', 'confirmation', 'remote_signature', 'remote_confirmation', 'paper']),
  documentId: idSchema,
  fileName: z.string().trim().min(1).max(240),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  emailStatus: z.enum(['not_requested', 'pending', 'sent', 'failed', 'configuration_required']),
  emailAddress: z.string().trim().email().max(254).optional(),
  emailSentAt: optionalTimestamp,
  emailError: optionalText(500),
  storageStatus: z.enum(['pending', 'stored', 'inline_fallback']).optional(),
  storageError: optionalText(1_000),
  pdfStatus: z.enum(['pending', 'ready', 'failed']).optional(),
  pdfError: optionalText(1_000),
  signatureDataUrl: z.string().max(1_500_000).refine((value) => value.startsWith('data:image/png;base64,'), 'Ungültige Unterschrift').optional(),
  inlinePdfBase64: z.string().max(2_500_000).optional(),
}).strict()


const welcomeEmailReceiptSchema = z.object({
  status: z.enum(['not_requested', 'sent', 'failed', 'configuration_required']),
  emailAddress: z.string().trim().email().max(254).optional(),
  sentAt: optionalTimestamp,
  resendId: optionalText(200),
  error: optionalText(500),
}).strict()

export const customerInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(254).optional(),
  street: z.string().trim().min(1).max(160),
  houseNumber: z.string().trim().min(1).max(24),
  postalCode: z.string().trim().max(12).optional(),
  city: z.string().trim().min(1).max(120),
  district: z.string().trim().min(1).max(120),
  completedAt: timestampSchema,
  completedBy: profileSchema.optional(),
  salesOwner: z.union([profileSchema, z.literal('both')]).optional(),
  commissionAmountCents: z.number().int().min(0).max(100_000_000).optional(),
  weekId: idSchema,
  dayId: idSchema,
  source: z.enum(['d2d', 'online', 'website', 'telephone', 'event']).optional(),
  serviceType: z.enum(['strom', 'gas', 'both']).optional(),
  recordState: z.enum(['draft', 'active', 'deletion_pending']).optional(),
  note: optionalText(2_000),
  followUpAt: z.union([dateKeySchema, timestampSchema]).optional(),
  followUpGraceUntil: z.union([dateKeySchema, timestampSchema]).optional(),
  lastContactAt: optionalTimestamp,
  privacyReceipt: privacyReceiptSchema.optional(),
  welcomeEmail: welcomeEmailReceiptSchema.optional(),
  status: z.enum(['active', 'cancelled']),
  cancellation: z.object({
    date: dateKeySchema,
    reason: z.string().trim().max(2_000),
    category: z.enum(['withdrawal', 'provider_rejected', 'data_error', 'other']),
    createdBy: profileSchema.optional(),
  }).strict().optional(),
  createdAt: optionalTimestamp,
  updatedAt: optionalTimestamp,
}).strict().superRefine((value, context) => {
  if ((value.recordState ?? 'active') !== 'draft' && (value.phone.length < 3 || !/\d/.test(value.phone))) {
    context.addIssue({ code: 'custom', path: ['phone'], message: 'Telefonnummer fehlt' })
  }
  if ((value.recordState ?? 'active') !== 'draft' && (!value.commissionAmountCents || value.commissionAmountCents <= 0)) {
    context.addIssue({ code: 'custom', path: ['commissionAmountCents'], message: 'Provision muss für einen aktiven Abschluss eingetragen werden' })
  }
})

export const customerPrivacyIntakeSchema = z.object({
  customer: customerInputSchema,
  signatureDataUrl: z.string().max(1_500_000).refine((value) => value.startsWith('data:image/png;base64,'), 'Ungültige Unterschrift').optional(),
  acknowledgementAccepted: z.literal(true),
}).strict()

export const customerActionSchema = z.object({
  id: idSchema,
  reason: z.enum(['manual', 'service_ended', 'follow_up_expired', 'incomplete_intake']).optional(),
}).strict()


export const cancellationInputSchema = z.object({
  id: idSchema,
  cancellation: z.object({
    date: dateKeySchema,
    reason: z.string().trim().max(2_000),
    category: z.enum(['withdrawal', 'provider_rejected', 'data_error', 'other']),
    createdBy: profileSchema.optional(),
  }).strict(),
}).strict()

export const appointmentInputSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(180),
  startsAt: timestampSchema,
  endsAt: optionalTimestamp,
  address: optionalText(300),
  phone: z.string().trim().max(40).optional(),
  customerId: idSchema.optional(),
  weekId: idSchema.optional(),
  dayId: idSchema.optional(),
  assignedTo: audienceSchema,
  createdBy: profileSchema.optional(),
  note: optionalText(4_000),
  status: z.enum(['scheduled', 'completed', 'cancelled']),
  reminderMinutes: z.array(z.number().int().min(0).max(43_200)).max(8),
  createdAt: optionalTimestamp,
  updatedAt: optionalTimestamp,
}).strict()

export const notificationInputSchema = z.object({
  id: idSchema.optional(),
  type: z.enum(['appointment', 'follow_up', 'callback', 'week', 'day_close', 'system', 'cancellation', 'worktime']),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(500),
  scheduledAt: timestampSchema,
  linkedType: z.enum(['appointment', 'customer', 'day', 'week']).optional(),
  linkedId: idSchema.optional(),
  audience: audienceSchema,
  ackVossAt: optionalTimestamp,
  ackDickeAt: optionalTimestamp,
  resolvedAt: optionalTimestamp,
  createdAt: optionalTimestamp,
  updatedAt: optionalTimestamp,
}).strict()

export const idOnlySchema = z.object({ id: idSchema }).strict()

export const dayNoteInputSchema = z.object({
  id: idSchema,
  weekId: idSchema,
  dayId: idSchema,
  profileId: profileSchema.optional(),
  drawingDataUrl: z.string().max(2_500_000).refine((value) => value.startsWith('data:image/png;base64,'), 'Ungültige Zeichnung').optional(),
  text: optionalText(8_000),
  reflection: z.record(z.string().max(160), z.string().max(4_000)).optional(),
  updatedAt: optionalTimestamp,
}).strict()

export const archiveInputSchema = z.object({
  id: idSchema,
  weekId: idSchema,
  title: z.string().trim().min(1).max(200),
  district: z.string().trim().min(1).max(160),
  startsOn: dateKeySchema,
  endsOn: dateKeySchema,
  archivedAt: timestampSchema,
  summary: z.object({
    visits: z.number().int().nonnegative(),
    red: z.number().int().nonnegative(),
    yellow: z.number().int().nonnegative(),
    green: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    netContracts: z.number().int().nonnegative(),
    workMinutesVoss: z.number().int().nonnegative(),
    workMinutesDicke: z.number().int().nonnegative(),
    commissionTotalCents: z.number().int().nonnegative().optional(),
    commissionVossCents: z.number().int().nonnegative().optional(),
    commissionDickeCents: z.number().int().nonnegative().optional(),
    sharedCustomers: z.number().int().nonnegative().optional(),
  }).strict(),
  improvementNotes: z.object({
    voss: optionalText(4_000),
    dicke: optionalText(4_000),
    team: optionalText(4_000),
  }).strict(),
  plan: z.object({
    id: idSchema,
    title: z.string().max(200),
    district: z.string().max(160),
    startsOn: dateKeySchema,
    endsOn: dateKeySchema,
    days: z.array(z.object({ id: idSchema, streets: z.array(z.string().max(160)).max(80) }).passthrough()).length(5),
  }).passthrough().optional(),
  report: z.object({ fileName: z.string().max(240), sentAt: optionalTimestamp }).strict().optional(),
}).strict()
