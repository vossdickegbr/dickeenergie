import 'server-only'

import { Resend } from 'resend'
import { COMPANY_CONFIG } from '@/lib/company-config'
import type { Customer, WelcomeEmailReceipt } from '@/lib/types'
import { nowIso } from '@/lib/utils'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

function publicWebsiteUrl() {
  const raw = process.env.PUBLIC_WEBSITE_URL ?? 'https://vossunddicke.de'
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') throw new Error('Die Website-Adresse muss HTTPS verwenden.')
    return url.toString().replace(/\/$/, '')
  } catch {
    throw new Error('PUBLIC_WEBSITE_URL ist keine gültige HTTPS-Adresse.')
  }
}

export function welcomeEmailFailure(error: unknown, emailAddress?: string): WelcomeEmailReceipt {
  const message = error instanceof Error ? error.message : 'Unbekannter Versandfehler.'
  const configurationError = message.includes('RESEND_API_KEY') || message.includes('Absenderadresse') || message.includes('PUBLIC_WEBSITE_URL')
  return {
    status: configurationError ? 'configuration_required' : 'failed',
    emailAddress,
    error: message.slice(0, 500),
  }
}

export async function sendCustomerWelcomeEmail(customer: Customer): Promise<WelcomeEmailReceipt> {
  const emailAddress = customer.email?.trim().toLowerCase()
  if (!emailAddress) return { status: 'not_requested' }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.CUSTOMER_WELCOME_FROM_EMAIL
    ?? process.env.CUSTOMER_PRIVACY_FROM_EMAIL
    ?? process.env.REPORT_FROM_EMAIL
  if (!apiKey || !from) {
    throw new Error('E-Mail-Versand nicht eingerichtet: RESEND_API_KEY oder Absenderadresse fehlt.')
  }

  const website = publicWebsiteUrl()
  const name = escapeHtml(customer.name)
  const resend = new Resend(apiKey)
  const response = await resend.emails.send({
    from,
    to: emailAddress,
    replyTo: process.env.CUSTOMER_PRIVACY_REPLY_TO ?? COMPANY_CONFIG.email,
    subject: 'Vielen Dank für Ihr Vertrauen – Voss & Dicke GbR',
    text: [
      `Guten Tag ${customer.name},`,
      '',
      'vielen Dank, dass Sie sich für die Voss & Dicke GbR entschieden haben.',
      'Wir freuen uns darauf, Sie persönlich und zuverlässig bei Ihren Anliegen rund um Strom und Gas zu begleiten.',
      '',
      `Weitere Informationen über uns finden Sie unter ${website}`,
      '',
      'Bei Fragen können Sie einfach auf diese E-Mail antworten.',
      '',
      'Freundliche Grüße',
      'Voss & Dicke GbR',
    ].join('\n'),
    html: `
      <p>Guten Tag ${name},</p>
      <p>vielen Dank, dass Sie sich für die Voss &amp; Dicke GbR entschieden haben.</p>
      <p>Wir freuen uns darauf, Sie persönlich und zuverlässig bei Ihren Anliegen rund um Strom und Gas zu begleiten.</p>
      <p>Weitere Informationen über uns finden Sie auf unserer Website:</p>
      <p><a href="${website}" style="display:inline-block;padding:12px 18px;background:#143923;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">Zur Website von Voss &amp; Dicke</a></p>
      <p>Bei Fragen können Sie einfach auf diese E-Mail antworten.</p>
      <p>Freundliche Grüße<br>Voss &amp; Dicke GbR</p>
    `,
  })
  if (response.error) throw new Error(response.error.message)

  return {
    status: 'sent',
    emailAddress,
    sentAt: nowIso(),
    resendId: response.data?.id,
  }
}
