import { describe, expect, it } from 'vitest'
import type { CollectionStatus } from './supabase-client'

describe('saved release contract', () => {
  it('uses the database collection status vocabulary', () => {
    const statuses: CollectionStatus[] = ['saved', 'bought', 'missed', 'passed']
    expect(statuses).toHaveLength(4)
    expect(new Set(statuses).size).toBe(statuses.length)
  })
})