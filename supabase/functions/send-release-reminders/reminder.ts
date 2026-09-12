export type ReminderCandidate = {
  releaseAt: string
  timezone: string
  reminderHours: number
}

export function reminderScheduledFor(candidate: ReminderCandidate) {
  const releaseAt = new Date(candidate.releaseAt)
  if (!Number.isFinite(releaseAt.getTime()) || !Number.isInteger(candidate.reminderHours) || candidate.reminderHours <= 0) return null
  return new Date(releaseAt.getTime() - candidate.reminderHours * 60 * 60 * 1000)
}

export function isReminderDue(candidate: ReminderCandidate, now: Date, windowMinutes = 60) {
  const scheduledFor = reminderScheduledFor(candidate)
  if (!scheduledFor || !Number.isFinite(now.getTime()) || windowMinutes <= 0) return false
  const elapsed = now.getTime() - scheduledFor.getTime()
  return elapsed >= 0 && elapsed < windowMinutes * 60 * 1000
}

export function formatReminderDate(candidate: ReminderCandidate) {
  const releaseAt = new Date(candidate.releaseAt)
  if (!Number.isFinite(releaseAt.getTime())) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: candidate.timezone || 'UTC',
    }).format(releaseAt)
  } catch {
    return null
  }
}
