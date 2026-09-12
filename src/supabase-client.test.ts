import { describe, expect, it } from 'vitest'
import { isMissingAuthSessionError, type CollectionStatus } from './supabase-client'

describe('auth session errors', () => {
  it('treats a missing session as an expected signed-out state', () => {
    expect(isMissingAuthSessionError({ code: 'session_missing', message: 'Auth session missing!' })).toBe(true)
    expect(isMissingAuthSessionError({ message: 'Auth session missing!' })).toBe(true)
    expect(isMissingAuthSessionError({ code: 'network_error', message: 'Failed to fetch' })).toBe(false)
    expect(isMissingAuthSessionError(null)).toBe(false)
  })
})

describe('saved release contract', () => {
  it('uses the database collection status vocabulary', () => {
    const statuses: CollectionStatus[] = ['saved', 'bought', 'missed', 'passed']
    expect(statuses).toHaveLength(4)
    expect(new Set(statuses).size).toBe(statuses.length)
  })
})