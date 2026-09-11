import { describe, expect, it } from 'vitest'
import { filterReleases, isVerifiedRelease, type ReleaseRecord } from './release-model'

const releases: ReleaseRecord[] = [
  { id: 1, brand: 'NIKE', name: 'Air Max 95 OG', status: 'confirmed' },
  { id: 2, brand: 'ADIDAS', name: 'Samba OG Wales Bonner', status: 'tentative' },
  { id: 3, brand: 'NEW BALANCE', name: '990v6 Made in USA', status: 'restock' },
]

describe('release model', () => {
  it('filters by brand and product name while ignoring case and surrounding whitespace', () => {
    expect(filterReleases(releases, '  samba  ', [], false)).toEqual([releases[1]])
  })

  it('limits results to saved releases when saved mode is active', () => {
    expect(filterReleases(releases, '', [3], true)).toEqual([releases[2]])
  })

  it('recognizes only confirmed releases and restocks as verified', () => {
    expect(isVerifiedRelease('confirmed')).toBe(true)
    expect(isVerifiedRelease('restock')).toBe(true)
    expect(isVerifiedRelease('tentative')).toBe(false)
    expect(isVerifiedRelease('cancelled')).toBe(false)
  })
})
