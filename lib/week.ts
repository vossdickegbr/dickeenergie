import currentWeek from '@/data/current-week.json'
import type { WeekPlan } from '@/lib/types'
import { toLocalDateKey } from '@/lib/utils'

export const weekPlan = currentWeek as WeekPlan

export function getTodayDay(plan: WeekPlan = weekPlan) {
  const today = toLocalDateKey()
  return plan.days.find((day) => day.date === today) ?? plan.days[0]
}
