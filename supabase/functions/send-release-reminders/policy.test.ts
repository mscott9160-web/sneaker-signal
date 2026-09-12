import { describe, expect, it } from 'vitest'
import { constantTimeEqual, isDryRunEnabled, isEligibleRelease, hasSelectedReminderHour, isTransientProviderFailure, resolveTimezone, retryBackoffSeconds } from './policy'

describe('reminder delivery policy', () => {
  const now = new Date('2026-09-12T12:00:00Z')

  it('requires a published, confirmed release with a future date', () => {
    expect(isEligibleRelease({ editorial_status: 'published', status: 'confirmed', release_at: '2026-09-13T12:00:00Z' }, now)).toBe(true)
    expect(isEligibleRelease({ editorial_status: 'published', status: 'postponed', release_at: '2026-09-13T12:00:00Z' }, now)).toBe(false)
    expect(isEligibleRelease({ editorial_status: 'published', status: 'confirmed', release_at: '2026-09-11T12:00:00Z' }, now)).toBe(false)
  })

  it('requires an explicitly selected positive reminder hour', () => {
    expect(hasSelectedReminderHour([24, 1], 1)).toBe(true)
    expect(hasSelectedReminderHour([24], 1)).toBe(false)
  })

  it('compares secrets without early length-based equality', () => {
    expect(constantTimeEqual('secret', 'secret')).toBe(true)
    expect(constantTimeEqual('secret', 'other')).toBe(false)
    expect(constantTimeEqual('secret', 'secre')).toBe(false)
  })

  it('only enables dry run with the literal true value', () => {
    expect(isDryRunEnabled('true')).toBe(true)
    expect(isDryRunEnabled(undefined)).toBe(false)
    expect(isDryRunEnabled('1')).toBe(false)
  })

  it('falls back safely from invalid preference timezones', () => {
    expect(resolveTimezone('Not/A_Timezone', 'America/New_York')).toBe('America/New_York')
    expect(resolveTimezone('Not/A_Timezone', 'Also/Invalid')).toBe('UTC')
  })

  it('classifies transient provider failures and caps backoff', () => {
    expect(isTransientProviderFailure(undefined, 429)).toBe(true)
    expect(isTransientProviderFailure(undefined, 400)).toBe(false)
    expect(isTransientProviderFailure(new TypeError('network'))).toBe(true)
    expect(retryBackoffSeconds(1)).toBe(30)
    expect(retryBackoffSeconds(10)).toBe(900)
  })
})