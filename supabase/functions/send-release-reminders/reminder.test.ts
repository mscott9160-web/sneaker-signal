import { describe, expect, it } from 'vitest'
import { formatReminderDate, isReminderDue, reminderScheduledFor } from './reminder'

describe('release reminder windows', () => {
  const candidate = { releaseAt: '2026-09-13T14:00:00Z', timezone: 'America/Los_Angeles', reminderHours: 24 }

  it('subtracts the configured hours from the release instant', () => {
    expect(reminderScheduledFor(candidate)?.toISOString()).toBe('2026-09-12T14:00:00.000Z')
  })

  it('matches an hourly delivery window', () => {
    expect(isReminderDue(candidate, new Date('2026-09-12T14:30:00Z'))).toBe(true)
    expect(isReminderDue(candidate, new Date('2026-09-12T15:01:00Z'))).toBe(false)
  })

  it('formats the release in the preference timezone', () => {
    expect(formatReminderDate(candidate)).toContain('7:00 AM')
  })

  it('does not throw for an invalid timezone', () => {
    expect(formatReminderDate({ ...candidate, timezone: 'Not/A_Timezone' })).toBeNull()
  })
})
