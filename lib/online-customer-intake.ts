import 'server-only'

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'
import { COMPANY_CONFIG, PRIVACY_NOTICE_VERSION } from '@/lib/company-config'
import type { OnlineCustomerIntake, OnlineCustomerIntakeCustomer, OnlineCustomerIntakeStatus, PrivacyEmailStatus, PrivacyReceipt, ProfileId } from '@/lib/types'

export interface OnlineCustomerIntakeRow {
  id: string
  reserved_customer_id: string
  created_by: ProfileId
  status: OnlineCustomerIntakeStatus
  token_hash: string
  verification_code_hash: string
  verification_attempts: number
  customer_payload: OnlineCustomerIntakeCustomer
  privacy_notice_version: string
  signature_data_url: string | null
  privacy_receipt: PrivacyReceipt | null
  expires_at: string
  email_sent_at: string | null
  opened_at: string | null
  email_verified_at: string | null
  privacy_accepted_at: string | null
  signed_at: string | null
  completed_at: string | null
  finalized_at: string | null
  delivery_error: string | null
  privacy_email_status: PrivacyEmailStatus | null
  privacy_email_sent_at: string | null
  privacy_email_error: string | null
  final_customer_id: string | null
  created_at: string
  updated_at: string
}

function intakeSecret() {
  const secret = process.env.ONLINE_INTAKE_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('ONLINE_INTAKE_SECRET oder ein Supabase-Server-Schlüssel fehlt.')
  return secret
}

export function generateOnlineIntakeToken() {
  return randomBytes(32).toString('base64url')
}

export function generateOnlineIntakeCode() {
  return randomInt(100000, 1000000).toString()
}

export function hashOnlineIntakeToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function hashOnlineIntakeCode(code: string) {
  return createHmac('sha256', intakeSecret()).update(code).digest('hex')
}

export function verifyOnlineIntakeCode(code: string, expectedHash: string) {
  const actual = Buffer.from(hashOnlineIntakeCode(code), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function mapOnlineIntakeRow(row: Omit<OnlineCustomerIntakeRow, 'token_hash' | 'verification_code_hash' | 'verification_attempts'>): OnlineCustomerIntake {
  return {
    id: row.id,
    reservedCustomerId: row.reserved_customer_id,
    status: row.status,
    customer: row.customer_payload,
    createdBy: row.created_by,
    privacyNoticeVersion: row.privacy_notice_version,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emailSentAt: row.email_sent_at ?? undefined,
    openedAt: row.opened_at ?? undefined,
    emailVerifiedAt: row.email_verified_at ?? undefined,
    privacyAcceptedAt: row.privacy_accepted_at ?? undefined,
    signedAt: row.signed_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    finalizedAt: row.finalized_at ?? undefined,
    deliveryError: row.delivery_error ?? undefined,
    privacyEmailStatus: row.privacy_email_status ?? undefined,
    privacyEmailSentAt: row.privacy_email_sent_at ?? undefined,
    privacyEmailError: row.privacy_email_error ?? undefined,
    privacyReceipt: row.privacy_receipt ? { ...row.privacy_receipt, signatureDataUrl: undefined, inlinePdfBase64: undefined } : undefined,
    finalCustomerId: row.final_customer_id ?? undefined,
  }
}

export function isOnlineIntakeExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now()
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

export async function sendOnlineIntakeLinkEmail(args: {
  customer: OnlineCustomerIntakeCustomer
  token: string
  code: string
  origin: string
  expiresAt: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.CUSTOMER_PRIVACY_FROM_EMAIL ?? process.env.REPORT_FROM_EMAIL
  if (!apiKey || !from) {
    throw new Error('E-Mail-Versand nicht eingerichtet: RESEND_API_KEY oder CUSTOMER_PRIVACY_FROM_EMAIL fehlt.')
  }

  const base = (process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? args.origin).replace(/\/$/, '')
  const link = `${base}/online-datenschutz/${encodeURIComponent(args.token)}`
  const resend = new Resend(apiKey)
  const expiry = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin',
  }).format(new Date(args.expiresAt))
  const name = escapeHtml(args.customer.name)
  const response = await resend.emails.send({
    from,
    to: args.customer.email,
    replyTo: process.env.CUSTOMER_PRIVACY_REPLY_TO ?? COMPANY_CONFIG.email,
    subject: 'Datenschutzinformation bestätigen – Voss & Dicke GbR',
    html: `
      <p>Guten Tag ${name},</p>
      <p>bitte öffnen Sie den persönlichen Link, lesen Sie die Datenschutzinformation und bestätigen Sie den Erhalt mit dem sechsstelligen E-Mail-Code. Eine elektronische Unterschrift ist freiwillig und kann als zusätzlicher Nachweis ergänzt werden.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#143923;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">Datenschutzinformation öffnen</a></p>
      <p>Ihr sechsstelliger Bestätigungscode lautet:</p>
      <p style="font-size:26px;font-weight:800;letter-spacing:5px">${args.code}</p>
      <p>Der Link und der Code sind bis ${expiry} gültig. Geben Sie beides nicht an andere Personen weiter.</p>
      <p>Die Bestätigung betrifft ausschließlich den Erhalt der Datenschutzinformation. Eine freiwillige Unterschrift ist keine pauschale Werbeeinwilligung und keine Unterschrift unter einen Strom- oder Gasliefervertrag.</p>
      <p>Freundliche Grüße<br>Voss &amp; Dicke GbR</p>
    `,
  })
  if (response.error) throw new Error(response.error.message)
  return response.data
}

export const ONLINE_INTAKE_PRIVACY_VERSION = PRIVACY_NOTICE_VERSION
