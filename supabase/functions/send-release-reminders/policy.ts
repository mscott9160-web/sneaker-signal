const BLOCKED_STATUSES = new Set(['postponed', 'cancelled', 'sold_out', 'expired'])

export const MAX_REMINDER_ATTEMPTS = 3

export function validTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || timezone.length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
    return true
  } catch {
    return false
  }
}

export function resolveTimezone(preferenceTimezone: unknown, releaseTimezone: unknown) {
  if (validTimezone(preferenceTimezone)) return preferenceTimezone
  if (validTimezone(releaseTimezone)) return releaseTimezone
  return 'UTC'
}

export function isTransientProviderFailure(error: unknown, status?: number) {
  return error instanceof TypeError || status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500)
}

export function retryBackoffSeconds(attemptCount: number) {
  const attempt = Math.max(1, Math.floor(attemptCount))
  return Math.min(15 * 60, 30 * 2 ** (attempt - 1))
}

export function isEligibleRelease(release: { editorial_status?: string; status?: string; release_at?: string | null }, now: Date) {
  const releaseAt = release.release_at ? new Date(release.release_at) : null
  return release.editorial_status === 'published'
    && release.status === 'confirmed'
    && !BLOCKED_STATUSES.has(release.status)
    && releaseAt !== null
    && Number.isFinite(releaseAt.getTime())
    && releaseAt.getTime() > now.getTime()
}

export function hasSelectedReminderHour(hours: unknown, reminderHours: number) {
  return Array.isArray(hours) && hours.some((hour) => hour === reminderHours && Number.isInteger(hour) && hour > 0)
}

export function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  let difference = leftBytes.length ^ rightBytes.length
  const length = Math.max(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index++) difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  return difference === 0
}

export function isDryRunEnabled(value: string | undefined) {
  return value === 'true'
}