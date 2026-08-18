import 'server-only'
import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { Resend } from 'resend'
import { COMPANY_CONFIG, CUSTOMER_DOCUMENT_BUCKET, PRIVACY_NOTICE_VERSION } from '@/lib/company-config'
import { CUSTOMER_PRIVACY_SECTIONS, PRIVACY_NOTICE_META } from '@/lib/privacy-notice'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { Customer, CustomerDocumentMeta, PrivacyEmailStatus, PrivacyReceipt, ProfileId } from '@/lib/types'
import { nowIso, PROFILE_LABELS } from '@/lib/utils'

const A4: [number, number] = [595.28, 841.89]
const margin = 44


export function readableStorageError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('customer_documents') || lower.includes('relation') && lower.includes('does not exist')) {
    return 'Die Supabase-Datenschutztabellen fehlen. Bitte die Datei supabase/migrations/003_customer_privacy_repair.sql einmal im Supabase SQL Editor ausführen.'
  }
  if (lower.includes('bucket') || lower.includes('not found')) {
    return 'Der private Dokumentenspeicher ist noch nicht eingerichtet. Bitte die Supabase-Datenschutzmigration ausführen.'
  }
  return message
}

export async function ensureCustomerDocumentBucket(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin.storage.getBucket(CUSTOMER_DOCUMENT_BUCKET)
  if (!error && data) return
  const { error: createError } = await admin.storage.createBucket(CUSTOMER_DOCUMENT_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
  })
  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw new Error(readableStorageError(createError.message))
  }
}

function decodePngDataUrl(value: string) {
  const encoded = value.split(',')[1]
  if (!encoded) throw new Error('Unterschrift fehlt.')
  return Uint8Array.from(Buffer.from(encoded, 'base64'))
}

export function safeFilePart(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Kunde'
}


export function provisionalPrivacyReceipt(customer: Customer, signatureDataUrl: string | undefined, actorProfileId: ProfileId): PrivacyReceipt {
  const documentId = `privacy-${customer.id}-${Date.now()}`
  const fileName = `Datenschutzinformation_${safeFilePart(customer.name)}_${PRIVACY_NOTICE_VERSION}.pdf`
  const acknowledgedAt = nowIso()
  const provisionalProof = signatureDataUrl ?? `${customer.id}|${PRIVACY_NOTICE_VERSION}|${acknowledgedAt}|${actorProfileId}`
  return {
    version: PRIVACY_NOTICE_VERSION,
    acknowledgedAt,
    acknowledgedBy: actorProfileId,
    acknowledgementMethod: signatureDataUrl ? 'signature' : 'confirmation',
    documentId,
    fileName,
    sha256: createHash('sha256').update(provisionalProof).digest('hex'),
    emailStatus: 'not_requested',
    emailAddress: customer.email,
    storageStatus: 'pending',
    pdfStatus: 'pending',
    signatureDataUrl,
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = []
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    if (line) lines.push(line)
    if (!words.length) lines.push('')
  }
  return lines
}

function addHeader(page: PDFPage, bold: PDFFont, regular: PDFFont, title: string, subtitle: string) {
  const { width, height } = page.getSize()
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: rgb(0.04, 0.13, 0.08) })
  page.drawText('VOSS & DICKE GBR', { x: margin, y: height - 34, size: 10, font: bold, color: rgb(0.65, 0.86, 0.44) })
  page.drawText(title, { x: margin, y: height - 58, size: 17, font: bold, color: rgb(1, 1, 1) })
  page.drawText(subtitle, { x: margin, y: height - 77, size: 8.5, font: regular, color: rgb(0.80, 0.86, 0.81) })
}

export async function buildSignedCustomerPrivacyPdf(customer: Customer, signatureDataUrl: string | undefined, actorProfileId: ProfileId | 'customer') {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const dark = rgb(0.06, 0.14, 0.09)
  const green = rgb(0.18, 0.46, 0.26)
  const muted = rgb(0.36, 0.42, 0.38)
  const light = rgb(0.94, 0.97, 0.94)
  const contentWidth = A4[0] - margin * 2

  let page = pdf.addPage(A4)
  addHeader(page, bold, regular, PRIVACY_NOTICE_META.title, `Version ${PRIVACY_NOTICE_VERSION}`)
  let y = 720

  page.drawText('Empfangs- und Bereitstellungsnachweis', { x: margin, y, size: 13, font: bold, color: green }); y -= 26
  const identityLines = [
    ['Kunde', customer.name],
    ['Anschrift', `${customer.street} ${customer.houseNumber}, ${customer.postalCode ?? ''} ${customer.city}`.replace(/\s+/g, ' ').trim()],
    ['Sparte', customer.serviceType === 'strom' ? 'Strom' : customer.serviceType === 'gas' ? 'Gas' : customer.serviceType === 'both' ? 'Strom und Gas' : 'Noch festzulegen'],
    ['Bestätigt durch', actorProfileId === 'customer' ? 'Kunde über persönlichen Online-Link' : PROFILE_LABELS[actorProfileId]],
    ['Zeitpunkt', new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })],
  ] as const
  identityLines.forEach(([label, value]) => {
    page.drawText(label, { x: margin, y, size: 8.5, font: bold, color: muted })
    page.drawText(value, { x: 150, y, size: 9, font: regular, color: dark })
    y -= 18
  })
  y -= 8
  page.drawRectangle({ x: margin, y: y - 76, width: contentWidth, height: 76, color: light, borderColor: rgb(0.78, 0.84, 0.79), borderWidth: 0.8 })
  const ackLines = wrapText(PRIVACY_NOTICE_META.acknowledgementText, regular, 9, contentWidth - 24)
  let ackY = y - 20
  for (const line of ackLines) { page.drawText(line, { x: margin + 12, y: ackY, size: 9, font: regular, color: dark }); ackY -= 13 }
  y -= 102

  if (signatureDataUrl) {
    const signature = await pdf.embedPng(decodePngDataUrl(signatureDataUrl))
    const signatureScale = signature.scaleToFit(contentWidth - 12, 115)
    page.drawText('Freiwillige Unterschrift des Kunden', { x: margin, y, size: 9, font: bold, color: muted }); y -= 12
    page.drawRectangle({ x: margin, y: y - 125, width: contentWidth, height: 125, color: rgb(1, 1, 1), borderColor: rgb(0.70, 0.77, 0.72), borderWidth: 1 })
    page.drawImage(signature, { x: margin + 6, y: y - 119, width: signatureScale.width, height: signatureScale.height })
    y -= 148
    page.drawText('Hinweis: Die freiwillige Unterschrift ist nur ein zusätzlicher Nachweis und keine Vertrags- oder Werbeeinwilligung.', { x: margin, y, size: 8, font: regular, color: muted })
  } else {
    page.drawText('Bestätigung ohne Unterschrift', { x: margin, y, size: 9, font: bold, color: muted }); y -= 16
    const confirmation = actorProfileId === 'customer'
      ? 'Der Erhalt wurde über den persönlichen Link, den sechsstelligen E-Mail-Code und die aktive Bestätigung dokumentiert. Eine Unterschrift wurde nicht abgegeben und war nicht erforderlich.'
      : 'Der Erhalt der Datenschutzinformation wurde im persönlichen Beratungsvorgang aktiv bestätigt und dokumentiert. Eine freiwillige Unterschrift wurde nicht abgegeben und war nicht erforderlich.'
    for (const line of wrapText(confirmation, regular, 8.8, contentWidth)) {
      page.drawText(line, { x: margin, y, size: 8.8, font: regular, color: muted }); y -= 12
    }
  }

  for (const section of CUSTOMER_PRIVACY_SECTIONS) {
    const headingHeight = 22
    const paraLines = section.paragraphs.flatMap((paragraph) => [...wrapText(paragraph, regular, 9.2, contentWidth), ''])
    const required = headingHeight + paraLines.length * 13
    if (y - required < 62) {
      page = pdf.addPage(A4)
      addHeader(page, bold, regular, 'Datenschutzinformation', `${section.title} · Version ${PRIVACY_NOTICE_VERSION}`)
      y = 715
    } else y -= 28

    page.drawText(section.title, { x: margin, y, size: 11.5, font: bold, color: green })
    y -= 20
    for (const line of paraLines) {
      if (y < 58) {
        page = pdf.addPage(A4)
        addHeader(page, bold, regular, 'Datenschutzinformation', `Fortsetzung · Version ${PRIVACY_NOTICE_VERSION}`)
        y = 715
      }
      if (line) page.drawText(line, { x: margin, y, size: 9.2, font: regular, color: dark })
      y -= 13
    }
  }

  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    current.drawText(`${COMPANY_CONFIG.legalName} · ${COMPANY_CONFIG.email} · Seite ${index + 1} von ${pages.length}`, {
      x: margin, y: 28, size: 7.2, font: regular, color: muted,
    })
  })

  return pdf.save()
}

async function sendPrivacyEmail(customer: Customer, bytes: Uint8Array, fileName: string): Promise<{
  status: PrivacyEmailStatus
  sentAt?: string
  error?: string
}> {
  if (!customer.email) return { status: 'not_requested' }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.CUSTOMER_PRIVACY_FROM_EMAIL ?? process.env.REPORT_FROM_EMAIL
  if (!apiKey || !from) return { status: 'configuration_required', error: 'RESEND_API_KEY oder CUSTOMER_PRIVACY_FROM_EMAIL fehlt.' }

  const resend = new Resend(apiKey)
  const response = await resend.emails.send({
    from,
    to: customer.email,
    replyTo: process.env.CUSTOMER_PRIVACY_REPLY_TO ?? COMPANY_CONFIG.email,
    subject: 'Ihre Datenschutzinformation - Voss & Dicke GbR',
    html: `<p>Guten Tag ${customer.name},</p><p>vielen Dank, dass Sie sich für die Beratung der Voss & Dicke GbR entschieden haben.</p><p>Im Anhang erhalten Sie die von Ihnen bestätigte Datenschutzinformation für Ihre Unterlagen.</p><p>Freundliche Grüße<br>Voss & Dicke GbR</p>`,
    attachments: [{ filename: fileName, content: Buffer.from(bytes) }],
  })
  if (response.error) return { status: 'failed', error: response.error.message }
  return { status: 'sent', sentAt: nowIso() }
}

export async function createAndStorePrivacyReceipt(customer: Customer, signatureDataUrl: string | undefined, actorProfileId: ProfileId | 'customer') {
  const bytes = await buildSignedCustomerPrivacyPdf(customer, signatureDataUrl, actorProfileId)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const documentId = `privacy-${customer.id}-${Date.now()}`
  const fileName = `Datenschutzinformation_${safeFilePart(customer.name)}_${PRIVACY_NOTICE_VERSION}.pdf`
  const storagePath = `${customer.id}/privacy/${documentId}.pdf`

  let storageStatus: 'stored' | 'inline_fallback' = 'stored'
  let storageError: string | undefined
  let stored = false

  try {
    const admin = createSupabaseAdminClient()
    await ensureCustomerDocumentBucket(admin)

    const { error: uploadError } = await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).upload(storagePath, Buffer.from(bytes), {
      contentType: 'application/pdf',
      cacheControl: '0',
      upsert: false,
    })
    if (uploadError) throw new Error(`Datenschutz-PDF konnte nicht gespeichert werden: ${readableStorageError(uploadError.message)}`)

    const { error: metaError } = await admin.from('customer_documents').insert({
      id: documentId,
      customer_id: customer.id,
      kind: 'privacy_notice',
      file_name: fileName,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      size_bytes: bytes.length,
      sha256,
      created_by: actorProfileId === 'customer' ? null : actorProfileId,
      created_at: nowIso(),
    })
    if (metaError) {
      await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).remove([storagePath])
      throw new Error(readableStorageError(metaError.message))
    }
    stored = true
  } catch (error) {
    // Die Kundenaufnahme darf nicht vollständig scheitern, nur weil der
    // zusätzliche Dokumentenspeicher noch nicht fertig konfiguriert ist.
    // Die signierte PDF bleibt in diesem Fall ausschließlich im durch RLS geschützten
    // Kundendatensatz abrufbar und kann später in den privaten Storage migriert werden.
    storageStatus = 'inline_fallback'
    storageError = error instanceof Error ? error.message : 'Dokumentenspeicher vorübergehend nicht verfügbar.'
  }

  const meta: CustomerDocumentMeta = {
    id: documentId,
    customerId: customer.id,
    kind: 'privacy_notice',
    fileName,
    mimeType: 'application/pdf',
    sizeBytes: bytes.length,
    sha256,
    createdAt: nowIso(),
  }
  const receipt: PrivacyReceipt = {
    version: PRIVACY_NOTICE_VERSION,
    acknowledgedAt: nowIso(),
    acknowledgedBy: actorProfileId,
    acknowledgementMethod: actorProfileId === 'customer'
      ? (signatureDataUrl ? 'remote_signature' : 'remote_confirmation')
      : (signatureDataUrl ? 'signature' : 'confirmation'),
    documentId,
    fileName,
    sha256,
    // Die PDF wird bewusst nicht automatisch per E-Mail verschickt.
    // Ein Versand erfolgt nur nach einer manuellen Aktion in der Kundenkartei.
    emailStatus: 'not_requested',
    emailAddress: customer.email,
    storageStatus,
    storageError,
    pdfStatus: 'ready',
    inlinePdfBase64: stored ? undefined : Buffer.from(bytes).toString('base64'),
  }
  return { receipt, meta, bytes }
}

export async function getCustomerDocument(documentId: string, customerId: string) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.from('customer_documents')
    .select('id,customer_id,kind,file_name,storage_path,mime_type,size_bytes,sha256,created_at')
    .eq('id', documentId).eq('customer_id', customerId).maybeSingle()
  if (error || !data) throw new Error('Dokument nicht gefunden.')
  const { data: file, error: downloadError } = await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).download(data.storage_path)
  if (downloadError || !file) throw new Error('Dokument konnte nicht geladen werden.')
  return { meta: data, bytes: new Uint8Array(await file.arrayBuffer()) }
}

export async function resendStoredPrivacyReceipt(customer: Customer) {
  if (!customer.privacyReceipt) throw new Error('Keine bestätigte Datenschutzinformation vorhanden.')
  if (!customer.email) throw new Error('Beim Kunden ist keine E-Mail-Adresse hinterlegt.')
  const bytes = customer.privacyReceipt.inlinePdfBase64
    ? new Uint8Array(Buffer.from(customer.privacyReceipt.inlinePdfBase64, 'base64'))
    : customer.privacyReceipt.signatureDataUrl
      ? await buildSignedCustomerPrivacyPdf(customer, customer.privacyReceipt.signatureDataUrl, customer.privacyReceipt.acknowledgedBy)
      : (await getCustomerDocument(customer.privacyReceipt.documentId, customer.id)).bytes
  return sendPrivacyEmail(customer, bytes, customer.privacyReceipt.fileName)
}

export async function deleteCustomerDocuments(customerId: string) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.from('customer_documents').select('id,storage_path').eq('customer_id', customerId)
  if (error) throw error
  const paths = (data ?? []).map((item) => item.storage_path as string)
  if (paths.length) {
    const { error: storageError } = await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).remove(paths)
    if (storageError) throw storageError
  }
  const { error: deleteError } = await admin.from('customer_documents').delete().eq('customer_id', customerId)
  if (deleteError) throw deleteError
}
