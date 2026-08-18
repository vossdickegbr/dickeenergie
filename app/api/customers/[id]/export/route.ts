import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { COMPANY_CONFIG } from '@/lib/company-config'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import type { Appointment, Customer, NotificationItem } from '@/lib/types'
import { nowIso } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const A4: [number, number] = [595.28, 841.89]
const margin = 44

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  for (const paragraph of String(text || '').split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && font.widthOfTextAtSize(next, size) > width) { lines.push(line); line = word } else line = next
    }
    if (line) lines.push(line)
    if (!words.length) lines.push('')
  }
  return lines
}

async function createExportPdf(customer: Customer, appointments: Appointment[], notifications: NotificationItem[], documents: unknown[]) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage(A4)
  let y = 790
  const contentWidth = A4[0] - margin * 2
  const dark = rgb(0.07, 0.15, 0.10)
  const green = rgb(0.12, 0.42, 0.23)
  const muted = rgb(0.36, 0.42, 0.38)

  function addPage() { page = pdf.addPage(A4); y = 790 }
  function line(label: string, value: string) {
    const lines = wrap(value || 'Nicht hinterlegt', regular, 9, contentWidth - 145)
    if (y - Math.max(18, lines.length * 13) < 50) addPage()
    page.drawText(label, { x: margin, y, size: 9, font: bold, color: muted })
    lines.forEach((item, index) => page.drawText(item, { x: margin + 140, y: y - index * 13, size: 9, font: regular, color: dark }))
    y -= Math.max(20, lines.length * 13 + 4)
  }
  function heading(text: string) {
    if (y < 90) addPage()
    y -= 10
    page.drawText(text, { x: margin, y, size: 13, font: bold, color: green })
    y -= 23
  }

  page.drawText('DATENAUSKUNFT / KUNDENDATEN-EXPORT', { x: margin, y, size: 15, font: bold, color: green }); y -= 24
  page.drawText(`${COMPANY_CONFIG.legalName} · erstellt ${new Date().toLocaleString('de-DE')}`, { x: margin, y, size: 8.5, font: regular, color: muted }); y -= 30

  heading('Kundenstammdaten')
  line('Interne ID', customer.id)
  line('Name', customer.name)
  line('Telefon', customer.phone)
  line('E-Mail', customer.email ?? '')
  line('Anschrift', `${customer.street} ${customer.houseNumber}, ${customer.postalCode ?? ''} ${customer.city}`.replace(/\s+/g, ' ').trim())
  line('Gebiet', customer.district)
  line('Sparte', customer.serviceType ?? '')
  line('Quelle', customer.source ?? '')
  line('Status', `${customer.status} / ${customer.recordState ?? 'active'}`)
  line('Wiedervorlage', customer.followUpAt ?? '')
  line('Notiz', customer.note ?? '')

  heading('Datenschutz-Nachweis')
  line('Version', customer.privacyReceipt?.version ?? 'Kein Nachweis')
  line('Bestätigt am', customer.privacyReceipt?.acknowledgedAt ?? '')
  line('Bestätigt durch', customer.privacyReceipt?.acknowledgedBy ?? '')
  line('PDF-Prüfsumme', customer.privacyReceipt?.sha256 ?? '')
  line('E-Mail-Status', customer.privacyReceipt?.emailStatus ?? '')

  heading(`Termine (${appointments.length})`)
  if (!appointments.length) line('Einträge', 'Keine Termine gespeichert.')
  appointments.forEach((item, index) => line(`${index + 1}. ${item.title}`, `${item.startsAt} · ${item.status}${item.note ? ` · ${item.note}` : ''}`))

  heading(`Benachrichtigungen (${notifications.length})`)
  if (!notifications.length) line('Einträge', 'Keine Benachrichtigungen gespeichert.')
  notifications.forEach((item, index) => line(`${index + 1}. ${item.title}`, `${item.scheduledAt} · ${item.summary}`))

  heading(`Dokumentmetadaten (${documents.length})`)
  if (!documents.length) line('Einträge', 'Keine Dokumente gespeichert.')
  for (const [index, document] of documents.entries()) {
    const row = document as { file_name?: string; kind?: string; created_at?: string; sha256?: string }
    line(`${index + 1}. ${row.file_name ?? 'Dokument'}`, `${row.kind ?? ''} · ${row.created_at ?? ''} · SHA-256 ${row.sha256 ?? ''}`)
  }

  const pages = pdf.getPages()
  pages.forEach((item, index) => item.drawText(`${COMPANY_CONFIG.legalName} · Seite ${index + 1} von ${pages.length}`, { x: margin, y: 26, size: 7.5, font: regular, color: muted }))
  return pdf.save()
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const client = await createSupabaseServerClient()
    const actor = await requireTeamProfile(client)
    const { data: customerRow, error } = await client.from('app_records').select('payload').eq('id', id).eq('record_type', 'customer').maybeSingle()
    if (error || !customerRow) throw new Error('Kunde nicht gefunden.')
    const customer = customerRow.payload as Customer

    const [{ data: appointmentRows }, { data: notificationRows }, { data: documents }] = await Promise.all([
      client.from('app_records').select('payload').eq('record_type', 'appointment'),
      client.from('app_records').select('payload').eq('record_type', 'notification'),
      client.from('customer_documents').select('id,kind,file_name,mime_type,size_bytes,sha256,created_at').eq('customer_id', id).order('created_at'),
    ])
    const appointments = (appointmentRows ?? []).map((row) => row.payload as Appointment).filter((item) => item.customerId === id)
    const notifications = (notificationRows ?? []).map((row) => row.payload as NotificationItem).filter((item) => item.linkedType === 'customer' && item.linkedId === id)
    const generatedAt = nowIso()
    const exportData = { generatedAt, controller: COMPANY_CONFIG.legalName, customer, appointments, notifications, documents: documents ?? [] }

    const admin = createSupabaseAdminClient()
    await admin.from('audit_log').insert({ actor_profile_id: actor.profileId, action: 'customer.data_exported', entity_type: 'customer', entity_id: id, details: { format: new URL(request.url).searchParams.get('format') === 'json' ? 'json' : 'pdf' } })

    if (new URL(request.url).searchParams.get('format') === 'json') {
      return NextResponse.json(exportData, { headers: { 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="Kundendaten_${id}.json"` } })
    }
    const bytes = await createExportPdf(customer, appointments, notifications, documents ?? [])
    return new Response(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Kundendaten_${id}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Export konnte nicht erstellt werden.' }, { status: 404 })
  }
}
