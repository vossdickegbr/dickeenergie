import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { AppSnapshot, ProfileId, WeekPlan } from '@/lib/types'
import { formatDateTime, formatMinutes, PROFILE_LABELS, toLocalDateKey, workMinutes } from '@/lib/utils'
import { commissionShares, salesOwnerOf } from '@/lib/commission'

function wrap(text: string, max = 92) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      if (line) lines.push(line)
      line = word
    } else line = `${line} ${word}`.trim()
  }
  if (line) lines.push(line)
  return lines
}

function dataUrlBytes(value: string) {
  const base64 = value.split(',')[1]
  if (!base64) return null
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export async function buildWeeklyReportPdf(plan: WeekPlan, snapshot: AppSnapshot) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const dark = rgb(0.06, 0.14, 0.09)
  const green = rgb(0.20, 0.49, 0.27)
  const light = rgb(0.94, 0.97, 0.94)
  const red = rgb(0.74, 0.19, 0.18)
  const yellow = rgb(0.88, 0.63, 0.12)

  function pageHeader(page: ReturnType<typeof pdf.addPage>, title: string, subtitle: string) {
    const { width, height } = page.getSize()
    page.drawRectangle({ x: 0, y: height - 82, width, height: 82, color: dark })
    page.drawText('VOSS & DICKE GBR · FIELDOPS', { x: 34, y: height - 35, size: 10, font: bold, color: rgb(0.65, 0.86, 0.66) })
    page.drawText(title, { x: 34, y: height - 58, size: 19, font: bold, color: rgb(1, 1, 1) })
    page.drawText(subtitle, { x: 34, y: height - 74, size: 8.5, font: regular, color: rgb(0.80, 0.86, 0.81) })
  }

  const cover = pdf.addPage([595.28, 841.89])
  const { width, height } = cover.getSize()
  cover.drawRectangle({ x: 0, y: 0, width, height, color: dark })
  cover.drawRectangle({ x: 34, y: 520, width: width - 68, height: 8, color: green })
  cover.drawText('WOCHENABSCHLUSS', { x: 34, y: 700, size: 13, font: bold, color: rgb(0.65, 0.86, 0.66) })
  cover.drawText(plan.title, { x: 34, y: 650, size: 28, font: bold, color: rgb(1, 1, 1) })
  cover.drawText(plan.district, { x: 34, y: 615, size: 22, font: regular, color: rgb(0.85, 0.91, 0.86) })
  cover.drawText(`${plan.startsOn} bis ${plan.endsOn}`, { x: 34, y: 575, size: 12, font: regular, color: rgb(0.75, 0.82, 0.76) })
  const activeCustomers = snapshot.customers.filter((item) => item.weekId === plan.id && item.status === 'active').length
  const cancellations = snapshot.customers.filter((item) => item.weekId === plan.id && item.status === 'cancelled').length
  const visits = snapshot.visits.filter((item) => item.weekId === plan.id && item.status !== 'open')
  const stats = [
    ['Adressen erfasst', String(visits.length)],
    ['Gelb / Rückkehr', String(visits.filter((item) => item.status === 'yellow').length)],
    ['Abschlüsse', String(activeCustomers + cancellations)],
    ['Stornos', String(cancellations)],
    ['Nettoabschlüsse', String(activeCustomers)],
  ]
  stats.forEach(([label, value], index) => {
    const y = 450 - index * 54
    cover.drawText(value, { x: 34, y, size: 25, font: bold, color: rgb(1, 1, 1) })
    cover.drawText(label, { x: 115, y: y + 5, size: 12, font: regular, color: rgb(0.75, 0.82, 0.76) })
  })
  cover.drawText(`Erstellt: ${formatDateTime(new Date().toISOString())}`, { x: 34, y: 42, size: 8.5, font: regular, color: rgb(0.60, 0.68, 0.62) })

  for (const day of plan.days) {
    const page = pdf.addPage([595.28, 841.89])
    pageHeader(page, `Tag ${day.dayNumber} · ${day.weekday}`, `${day.title} · ${day.subtitle}`)
    let y = 730
    page.drawText('TAGESZIEL', { x: 34, y, size: 9, font: bold, color: green }); y -= 18
    for (const line of wrap(day.goalText, 94)) { page.drawText(line, { x: 34, y, size: 9.5, font: regular, color: dark }); y -= 14 }
    y -= 10
    const dayVisits = visits.filter((item) => item.dayId === day.id)
    const cards = [
      ['Erfasst', dayVisits.length, dark],
      ['Rot', dayVisits.filter((item) => item.status === 'red').length, red],
      ['Gelb', dayVisits.filter((item) => item.status === 'yellow').length, yellow],
      ['Grün', dayVisits.filter((item) => item.status === 'green').length, green],
      ['Niemand da', dayVisits.filter((item) => item.status === 'absent').length, rgb(0.35, 0.39, 0.36)],
    ] as const
    cards.forEach(([label, value, color], index) => {
      const x = 34 + index * 104
      page.drawRectangle({ x, y: y - 46, width: 92, height: 46, color: light, borderColor: rgb(0.84, 0.88, 0.84), borderWidth: 0.5 })
      page.drawText(String(value), { x: x + 9, y: y - 27, size: 18, font: bold, color })
      page.drawText(label, { x: x + 9, y: y - 40, size: 7.5, font: regular, color: dark })
    })
    y -= 72
    page.drawText('STRASSEN & HAUSNUMMERN', { x: 34, y, size: 9, font: bold, color: green }); y -= 18
    for (const street of day.streets) {
      const entries = dayVisits.filter((item) => item.street === street)
      page.drawText(street, { x: 34, y, size: 9, font: bold, color: dark })
      const text = entries.length ? entries.map((item) => `${item.houseNumber} ${item.status === 'red' ? 'ROT' : item.status === 'yellow' ? 'GELB' : item.status === 'green' ? 'GRÜN' : 'GRAU'}`).join(' · ') : 'Keine Einträge'
      for (const line of wrap(text, 100)) { page.drawText(line, { x: 165, y, size: 8, font: regular, color: rgb(0.23, 0.28, 0.24) }); y -= 11 }
      y -= 5
      if (y < 140) break
    }
    page.drawText('Arbeitszeiten', { x: 34, y: 104, size: 9, font: bold, color: green })
    ;(['voss', 'dicke'] as ProfileId[]).forEach((profile, index) => {
      const sessions = snapshot.workSessions.filter((item) => item.profileId === profile && item.date === day.date)
      const mins = sessions.reduce((sum, item) => sum + workMinutes(item), 0)
      page.drawText(`${PROFILE_LABELS[profile]}: ${Math.floor(mins / 60)} h ${mins % 60} min`, { x: 34 + index * 250, y: 87, size: 9, font: regular, color: dark })
    })
    page.drawText('Legende: ROT = nicht wiederkommen · GELB = wiederkommen · GRÜN = Abschluss · GRAU = niemand da', { x: 34, y: 35, size: 7.5, font: regular, color: rgb(0.4, 0.45, 0.41) })

    const notes = snapshot.dayNotes.filter((item) => item.dayId === day.id)
    for (const note of notes) {
      if (!note.drawingDataUrl) continue
      const bytes = dataUrlBytes(note.drawingDataUrl)
      if (!bytes) continue
      try {
        const image = await pdf.embedPng(bytes)
        const notePage = pdf.addPage([595.28, 841.89])
        pageHeader(notePage, `Tag ${day.dayNumber} · Handschrift`, `Notizen von ${PROFILE_LABELS[note.profileId]}`)
        const scaled = image.scaleToFit(527, 700)
        notePage.drawImage(image, { x: 34, y: 70, width: scaled.width, height: scaled.height })
      } catch {
        // A damaged drawing should not prevent the complete report.
      }
    }
  }

  const customerPage = pdf.addPage([595.28, 841.89])
  pageHeader(customerPage, 'Abschlüsse & Stornos', 'Datenschutzfreundliche Wochenstatistik ohne Kundennamen oder Kontaktangaben')
  let customerY = 730
  const weekCustomers = snapshot.customers.filter((item) => item.weekId === plan.id).sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const grouped = [
    ['Aktive Kunden', weekCustomers.filter((item) => item.status === 'active' && item.recordState !== 'draft').length, green],
    ['Noch zu ergänzende Entwürfe', weekCustomers.filter((item) => item.recordState === 'draft').length, yellow],
    ['Stornos', weekCustomers.filter((item) => item.status === 'cancelled').length, red],
    ['Strom', weekCustomers.filter((item) => item.serviceType === 'strom').length, dark],
    ['Gas', weekCustomers.filter((item) => item.serviceType === 'gas').length, dark],
    ['Strom und Gas', weekCustomers.filter((item) => item.serviceType === 'both').length, dark],
  ] as const
  grouped.forEach(([label, count, color]) => {
    customerPage.drawRectangle({ x: 34, y: customerY - 38, width: 527, height: 44, color: light, borderColor: rgb(0.84, 0.88, 0.84), borderWidth: 0.5 })
    customerPage.drawText(String(count), { x: 48, y: customerY - 21, size: 19, font: bold, color })
    customerPage.drawText(label, { x: 105, y: customerY - 17, size: 10, font: regular, color: dark })
    customerY -= 56
  })
  customerPage.drawText('Der Wochenbericht enthält bewusst keine Kundennamen, Telefonnummern, E-Mail-Adressen oder vollständigen Anschriften.', { x: 34, y: customerY - 10, size: 8.5, font: regular, color: rgb(0.4, 0.45, 0.41) })

  // Gesonderter Provisionsnachweis: zeigt wöchentlich, wem welcher Abschluss wirtschaftlich
  // zugeordnet ist und welcher Betrag daraus resultiert. Kundennamen bleiben bewusst draußen.
  const commissionCustomers = weekCustomers.filter((item) => item.recordState !== 'draft')
  const commissionTotals = commissionCustomers.reduce((totals, customer) => {
    const shares = commissionShares(customer)
    totals.total += shares.total
    totals.voss += shares.voss
    totals.dicke += shares.dicke
    if (salesOwnerOf(customer) === 'both') totals.shared += 1
    if (!customer.commissionAmountCents) totals.missing += 1
    return totals
  }, { total: 0, voss: 0, dicke: 0, shared: 0, missing: 0 })
  const money = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} EUR`
  const shortOwner = (customer: typeof commissionCustomers[number]) => {
    const owner = salesOwnerOf(customer)
    return owner === 'voss' ? 'Voss 100%' : owner === 'dicke' ? 'Dicke 100%' : 'Gemeinsam 50/50'
  }

  let commissionPage = pdf.addPage([595.28, 841.89])
  let commissionY = 730
  const drawCommissionHeader = (continuation = false) => {
    pageHeader(commissionPage, 'Vertrieb & Provision', continuation ? 'Fortsetzung · wöchentlicher Provisionsnachweis' : 'Wöchentlicher Nachweis der wirtschaftlichen Zuordnung und Ansprüche')
    commissionY = 730
  }
  drawCommissionHeader()

  const commissionCards = [
    ['Herr Voss', commissionTotals.voss, green],
    ['Herr Dicke', commissionTotals.dicke, green],
    ['Provision aktiv', commissionTotals.total, dark],
    ['50/50 Abschlüsse', commissionTotals.shared, yellow],
  ] as const
  commissionCards.forEach(([label, value, color], index) => {
    const x = 34 + index * 132
    commissionPage.drawRectangle({ x, y: commissionY - 54, width: 120, height: 54, color: light, borderColor: rgb(0.84, 0.88, 0.84), borderWidth: 0.5 })
    commissionPage.drawText(typeof value === 'number' && label !== '50/50 Abschlüsse' ? money(value) : String(value), { x: x + 8, y: commissionY - 25, size: label === '50/50 Abschlüsse' ? 15 : 11, font: bold, color })
    commissionPage.drawText(label, { x: x + 8, y: commissionY - 43, size: 7.3, font: regular, color: dark })
  })
  commissionY -= 78
  commissionPage.drawText('Regel: Voss/Dicke = 100 % des gespeicherten Provisionsbetrags; Gemeinsam = 50/50. Stornos und Entwürfe ergeben 0,00 EUR Anspruch.', { x: 34, y: commissionY, size: 7.6, font: regular, color: rgb(0.35, 0.40, 0.36) })
  commissionY -= 22
  if (commissionTotals.missing) {
    commissionPage.drawText(`${commissionTotals.missing} Alt-Datensatz/-sätze ohne gespeicherte Provision werden mit 0,00 EUR ausgewiesen.`, { x: 34, y: commissionY, size: 7.6, font: bold, color: red })
    commissionY -= 20
  }

  const drawTableHead = () => {
    commissionPage.drawRectangle({ x: 34, y: commissionY - 18, width: 527, height: 24, color: dark })
    ;[['Datum', 42], ['Zuordnung', 104], ['Provision', 245], ['Voss', 330], ['Dicke', 407], ['Status', 485]].forEach(([label, x]) => {
      commissionPage.drawText(String(label), { x: Number(x), y: commissionY - 9, size: 7.3, font: bold, color: rgb(1, 1, 1) })
    })
    commissionY -= 31
  }
  drawTableHead()

  for (const customer of commissionCustomers) {
    if (commissionY < 65) {
      commissionPage = pdf.addPage([595.28, 841.89])
      drawCommissionHeader(true)
      drawTableHead()
    }
    const shares = commissionShares(customer)
    const rawCommission = customer.commissionAmountCents ?? 0
    const status = customer.status === 'cancelled' ? 'Storno' : customer.commissionAmountCents ? 'Aktiv' : 'Provision fehlt'
    const date = toLocalDateKey(new Date(customer.completedAt)).slice(5).split('-').reverse().join('.')
    commissionPage.drawRectangle({ x: 34, y: commissionY - 14, width: 527, height: 24, color: commissionY % 2 ? light : rgb(0.98, 0.99, 0.98) })
    commissionPage.drawText(date, { x: 42, y: commissionY - 5, size: 7.2, font: regular, color: dark })
    commissionPage.drawText(shortOwner(customer), { x: 104, y: commissionY - 5, size: 7.2, font: regular, color: dark })
    commissionPage.drawText(money(rawCommission), { x: 245, y: commissionY - 5, size: 7.2, font: regular, color: dark })
    commissionPage.drawText(money(shares.voss), { x: 330, y: commissionY - 5, size: 7.2, font: regular, color: dark })
    commissionPage.drawText(money(shares.dicke), { x: 407, y: commissionY - 5, size: 7.2, font: regular, color: dark })
    commissionPage.drawText(status, { x: 485, y: commissionY - 5, size: 7.0, font: customer.status === 'cancelled' ? bold : regular, color: customer.status === 'cancelled' ? red : dark })
    commissionY -= 27
  }
  if (!commissionCustomers.length) commissionPage.drawText('In dieser Woche wurden keine abrechenbaren Kunden gespeichert.', { x: 34, y: commissionY, size: 10, font: regular, color: dark })
  commissionPage.drawText('Datenschutz: Diese Provisionsseite enthält keine Kundennamen oder Kontaktangaben.', { x: 34, y: 35, size: 7.5, font: regular, color: rgb(0.4, 0.45, 0.41) })


  for (const profile of ['voss', 'dicke'] as ProfileId[]) {
    let activityPage = pdf.addPage([595.28, 841.89])
    pageHeader(activityPage, `Aktivitätsnachweis · ${PROFILE_LABELS[profile]}`, 'Schichten, Pausen, Termine und aufgenommene Kunden')
    let activityY = 730

    const newActivityPage = (continuation = true) => {
      activityPage = pdf.addPage([595.28, 841.89])
      pageHeader(activityPage, `Aktivitätsnachweis · ${PROFILE_LABELS[profile]}`, continuation ? 'Fortsetzung' : 'Schichten, Pausen, Termine und aufgenommene Kunden')
      activityY = 730
    }
    const ensureSpace = (needed = 42) => {
      if (activityY - needed < 48) newActivityPage()
    }
    const drawLine = (time: string, title: string, detail: string, color = dark) => {
      ensureSpace(42)
      activityPage.drawText(time, { x: 34, y: activityY, size: 7.5, font: bold, color: rgb(0.42, 0.47, 0.43) })
      activityPage.drawText(title, { x: 105, y: activityY, size: 8.5, font: bold, color })
      activityY -= 12
      for (const line of wrap(detail, 82)) {
        activityPage.drawText(line, { x: 105, y: activityY, size: 7.7, font: regular, color: dark })
        activityY -= 10
      }
      activityY -= 7
    }

    for (const day of plan.days) {
      const daySessions = snapshot.workSessions.filter((item) => item.profileId === profile && item.date === day.date).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      const dayCustomers = snapshot.customers.filter((item) => item.completedBy === profile && toLocalDateKey(new Date(item.createdAt)) === day.date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const dayAppointments = snapshot.appointments.filter((item) => item.createdBy === profile && toLocalDateKey(new Date(item.createdAt)) === day.date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      if (!daySessions.length && !dayCustomers.length && !dayAppointments.length) continue

      ensureSpace(50)
      activityPage.drawRectangle({ x: 34, y: activityY - 5, width: 527, height: 24, color: light })
      activityPage.drawText(`${day.weekday} · ${day.date}`, { x: 43, y: activityY + 2, size: 10, font: bold, color: green })
      const totalMinutes = daySessions.reduce((sum, item) => sum + workMinutes(item), 0)
      activityPage.drawText(`${formatMinutes(totalMinutes)} · ${dayAppointments.length} Termine · ${dayCustomers.length} Kunden`, { x: 310, y: activityY + 2, size: 7.5, font: regular, color: dark })
      activityY -= 34

      const events: Array<{ at: string; title: string; detail: string; color?: typeof dark }> = []
      daySessions.forEach((session) => {
        events.push({ at: session.startedAt, title: 'Schicht gestartet', detail: `Beginn ${formatDateTime(session.startedAt, { dateStyle: undefined, timeStyle: 'short' })}`, color: green })
        session.pauses.forEach((pause) => {
          events.push({ at: pause.startedAt, title: 'Pause gestartet', detail: pause.endedAt ? `Ende ${formatDateTime(pause.endedAt, { dateStyle: undefined, timeStyle: 'short' })}` : 'Beim Bericht noch laufend', color: yellow })
          if (pause.endedAt) events.push({ at: pause.endedAt, title: 'Arbeit fortgesetzt', detail: 'Pause beendet', color: green })
        })
        if (session.endedAt) events.push({ at: session.endedAt, title: 'Schicht beendet', detail: `Netto ${formatMinutes(workMinutes(session))}`, color: dark })
      })
      dayCustomers.forEach((customer) => events.push({ at: customer.createdAt, title: 'Kunde aufgenommen', detail: `${customer.serviceType === 'strom' ? 'Strom' : customer.serviceType === 'gas' ? 'Gas' : customer.serviceType === 'both' ? 'Strom und Gas' : 'Sparte offen'} · interner Datensatz ${customer.id.slice(-8)}`, color: green }))
      dayAppointments.forEach((appointment) => events.push({ at: appointment.createdAt, title: 'Termin eingetragen', detail: `${appointment.title} · Termin ${formatDateTime(appointment.startsAt)}`, color: rgb(0.22, 0.36, 0.60) }))
      events.sort((a, b) => a.at.localeCompare(b.at)).forEach((event) => drawLine(formatDateTime(event.at, { dateStyle: undefined, timeStyle: 'short' }), event.title, event.detail, event.color))
      activityY -= 5
    }

    if (activityY === 730) activityPage.drawText('In dieser Woche wurden keine Aktivitäten gespeichert.', { x: 34, y: activityY, size: 10, font: regular, color: dark })
  }

  return pdf.save()
}
