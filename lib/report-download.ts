'use client'

import type { AppSnapshot, WeekPlan } from '@/lib/types'
import { buildWeeklyReportPdf } from '@/lib/report'

export async function downloadWeeklyReport(plan: WeekPlan, snapshot: AppSnapshot) {
  const bytes = await buildWeeklyReportPdf(plan, snapshot)
  const part = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([part], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Wochenabschluss_${plan.startsOn}_${plan.district.replace(/[^a-z0-9]+/gi, '-')}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_500)
}
