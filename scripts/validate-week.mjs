import { readFile } from 'node:fs/promises'

const raw = await readFile(new URL('../data/current-week.json', import.meta.url), 'utf8')
const week = JSON.parse(raw)
const fail = (message) => { console.error(`current-week.json: ${message}`); process.exitCode = 1 }
if (!week.id || !week.title || !week.district) fail('id, title und district sind Pflichtfelder.')
if (!Array.isArray(week.days) || week.days.length !== 5) fail('Genau fünf Arbeitstage werden erwartet.')
for (const [index, day] of (week.days ?? []).entries()) {
  if (!day.id || !day.date || !day.title) fail(`Tag ${index + 1}: id, date und title fehlen.`)
  if (!Array.isArray(day.streets) || !day.streets.length) fail(`Tag ${index + 1}: mindestens eine Straße ist erforderlich.`)
  if (!Array.isArray(day.mapRoutes) || !day.mapRoutes.length) fail(`Tag ${index + 1}: mindestens eine Kartenroute ist erforderlich.`)
}
if (!process.exitCode) console.log(`Wochenplan gültig: ${week.title} · ${week.days.length} Tage`)
