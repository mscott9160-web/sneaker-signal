import { describe, expect, it } from 'vitest'
import { demoReleases, formatLaunchTime, formatReleaseDateParts, isSafeRetailerUrl, loadReleases, toRelease, type DatabaseRelease } from './release-data'

const liveRow: DatabaseRelease = {
  id: 'live-1',
  release_at: '2026-09-13T12:00:00Z',
  retail_price: 185,
  currency: 'USD',
  status: 'confirmed',
  release_timezone: 'America/New_York',
  launch_type: 'online',
  last_verified_at: '2026-09-12T12:00:00Z',
  published_at: '2026-09-12T13:00:00Z',
  products: {
    name: 'Air Max 95 OG',
    colorway: 'Neon / Black',
    image_url: 'https://example.com/shoe.jpg',
    brands: { name: 'Nike' },
  },
  retailer_launches: [{
    launch_url: 'https://nike.example/launch',
    launch_at: '2026-09-13T12:00:00Z',
    launch_type: 'online',
    availability_status: 'confirmed',
    last_checked_at: '2026-09-12T12:00:00Z',
    retailers: { name: 'Nike' },
  }],
  release_sources: [{
    field_coverage: ['release_at', 'retail_price'],
    verification_status: 'verified',
    sources: {
      source_type: 'brand',
      publisher: 'Nike Launch',
      url: 'https://nike.example/source',
      reliability_tier: 1,
      captured_at: '2026-09-12T12:00:00Z',
    },
  }],
}

describe('release data', () => {
  it('formats dates and launch times in the stored release timezone', () => {
    expect(formatReleaseDateParts('2026-09-13T02:00:00Z', 'America/New_York')).toEqual({ day: '12', month: 'SEP' })
    expect(formatLaunchTime('2026-09-13T12:00:00Z', 'America/New_York')).toBe('8:00 AM EDT')
  })

  it('accepts only well-formed HTTPS retailer URLs', () => {
    expect(isSafeRetailerUrl('https://nike.example/launch')).toBe(true)
    expect(isSafeRetailerUrl('http://nike.example/launch')).toBe(false)
    expect(isSafeRetailerUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeRetailerUrl('not a URL')).toBe(false)
  })

  it('returns demo releases with demo provenance when live data is not configured', async () => {
    const result = await loadReleases()
    expect(result.releases).toEqual(demoReleases)
    expect(result.provenance).toBe('demo')
    expect(result.error).toMatch(/^Live releases (are not configured|are unavailable)\./)
  })

  it('maps live rows, nested metadata, provenance fields, and status labels', () => {
    expect(toRelease(liveRow)).toEqual(expect.objectContaining({
      id: 'live-1',
      releaseDate: liveRow.release_at,
      brand: 'NIKE',
      name: 'Air Max 95 OG',
      price: '$185.00',
      status: 'confirmed',
      provenance: 'live',
      releaseTimezone: 'America/New_York',
      lastVerifiedAt: liveRow.last_verified_at,
      publishedAt: liveRow.published_at,
    }))
    expect(toRelease(liveRow).retailers).toEqual([{
      name: 'Nike',
      url: 'https://nike.example/launch',
      launchAt: '2026-09-13T12:00:00Z',
      launchType: 'online',
      availabilityStatus: 'confirmed',
      lastCheckedAt: '2026-09-12T12:00:00Z',
    }])
    expect(toRelease(liveRow).sources).toEqual([{
      sourceType: 'brand',
      publisher: 'Nike Launch',
      url: 'https://nike.example/source',
      reliabilityTier: 1,
      capturedAt: '2026-09-12T12:00:00Z',
      fieldCoverage: ['release_at', 'retail_price'],
      verificationStatus: 'verified',
    }])
  })

  it('handles null product, retailer, source, image, price, and date fields', () => {
    const mapped = toRelease({
      ...liveRow,
      release_at: null,
      retail_price: null,
      products: null,
      retailer_launches: [{ ...liveRow.retailer_launches![0], retailers: null }],
      release_sources: [{ ...liveRow.release_sources![0], sources: null }],
    })

    expect(mapped).toEqual(expect.objectContaining({
      releaseDate: null,
      day: '--',
      month: 'TBD',
      brand: 'UNKNOWN',
      name: 'Unnamed release',
      color: 'Colorway TBC',
      price: 'TBC',
      image: null,
    }))
    expect(mapped.retailers[0].name).toBe('Official retailer')
    expect(mapped.sources).toEqual([])
  })
})