import { createClient } from '@supabase/supabase-js'

export type Release = {
  id: string
  releaseDate: string | null
  day: string
  month: string
  brand: string
  name: string
  color: string
  price: string
  image: string | null
  status: string
  accent: string
  retailers: RetailerLaunch[]
  provenance: 'live' | 'demo'
  releaseTimezone: string
  launchType: string
  lastVerifiedAt: string | null
  publishedAt: string | null
  sources: ReleaseSource[]
}

export type RetailerLaunch = {
  name: string
  url: string
  launchAt: string | null
  launchType: string
  availabilityStatus: string
  lastCheckedAt: string | null
}

export type ReleaseSource = {
  sourceType: string
  publisher: string
  url: string
  reliabilityTier: number
  capturedAt: string
  fieldCoverage: string[]
  verificationStatus: string
}

export const demoReleases: Release[] = [
  { id: 'demo-1', releaseDate: '2026-09-13', day: '13', month: 'SEP', brand: 'NIKE', name: 'Air Max 95 OG', color: 'Neon / Black', price: '$185', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', status: '', accent: '#e1ff00', retailers: [], provenance: 'demo', releaseTimezone: 'America/New_York', launchType: 'online', lastVerifiedAt: null, publishedAt: null, sources: [] },
  { id: 'demo-2', releaseDate: '2026-09-17', day: '17', month: 'SEP', brand: 'ADIDAS', name: 'Samba OG Wales Bonner', color: 'Cream White', price: '$160', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85', status: '', accent: '#ff6446', retailers: [], provenance: 'demo', releaseTimezone: 'America/New_York', launchType: 'online', lastVerifiedAt: null, publishedAt: null, sources: [] },
  { id: 'demo-3', releaseDate: '2026-09-20', day: '20', month: 'SEP', brand: 'NEW BALANCE', name: '990v6 Made in USA', color: 'Vintage Grey', price: '$200', image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=85', status: '', accent: '#a8c7ff', retailers: [], provenance: 'demo', releaseTimezone: 'America/New_York', launchType: 'online', lastVerifiedAt: null, publishedAt: null, sources: [] },
  { id: 'demo-4', releaseDate: '2026-09-24', day: '24', month: 'SEP', brand: 'SAUCONY', name: 'ProGrid Omni 9', color: 'Silver / Green', price: '$150', image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=85', status: '', accent: '#d4ffbd', retailers: [], provenance: 'demo', releaseTimezone: 'America/New_York', launchType: 'online', lastVerifiedAt: null, publishedAt: null, sources: [] },
]

export type DatabaseRelease = {
  id: string
  release_at: string | null
  retail_price: number | null
  currency: string
  status: string
  release_timezone: string
  launch_type: string
  last_verified_at: string | null
  published_at: string | null
  products: DatabaseProduct | DatabaseProduct[] | null
  retailer_launches: DatabaseRetailerLaunch[] | null
  release_sources: DatabaseReleaseSource[] | null
}

type DatabaseProduct = { name: string; colorway: string | null; image_url: string | null; brands: { name: string } | { name: string }[] | null }
type DatabaseRetailerLaunch = { launch_url: string; launch_at: string | null; launch_type: string; availability_status: string; last_checked_at: string | null; retailers: { name: string } | { name: string }[] | null }
type DatabaseReleaseSource = { field_coverage: string[]; verification_status: string; sources: { source_type: string; publisher: string; url: string; reliability_tier: number; captured_at: string } | { source_type: string; publisher: string; url: string; reliability_tier: number; captured_at: string }[] | null }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export function toRelease(row: DatabaseRelease): Release {
  const dateParts = formatReleaseDateParts(row.release_at, row.release_timezone)
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  const brand = product?.brands
  const brandName = brand && Array.isArray(brand) ? brand[0]?.name : brand?.name
  return {
    id: row.id,
    releaseDate: row.release_at,
    day: dateParts.day,
    month: dateParts.month,
    brand: brandName?.toUpperCase() ?? 'UNKNOWN',
    name: product?.name ?? 'Unnamed release',
    color: product?.colorway ?? 'Colorway TBC',
    price: row.retail_price === null ? 'TBC' : new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(row.retail_price),
    image: product?.image_url ?? null,
    status: row.status.replace('_', ' '),
    accent: '#ebe7df',
    provenance: 'live',
    releaseTimezone: row.release_timezone,
    launchType: row.launch_type,
    lastVerifiedAt: row.last_verified_at,
    publishedAt: row.published_at,
    retailers: (row.retailer_launches ?? []).map((launch) => ({
      name: Array.isArray(launch.retailers) ? launch.retailers[0]?.name ?? 'Official retailer' : launch.retailers?.name ?? 'Official retailer',
      url: launch.launch_url,
      launchAt: launch.launch_at,
      launchType: launch.launch_type,
      availabilityStatus: launch.availability_status,
      lastCheckedAt: launch.last_checked_at,
    })),
    sources: (row.release_sources ?? []).flatMap((link) => {
      const source = Array.isArray(link.sources) ? link.sources[0] : link.sources
      return source ? [{
        sourceType: source.source_type,
        publisher: source.publisher,
        url: source.url,
        reliabilityTier: source.reliability_tier,
        capturedAt: source.captured_at,
        fieldCoverage: link.field_coverage,
        verificationStatus: link.verification_status,
      }] : []
    }),
  }
}

export type ReleaseLoadResult = { releases: Release[]; error: string | null; provenance: 'live' | 'demo' }

export function isSafeRetailerUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export async function loadReleases(): Promise<ReleaseLoadResult> {
  if (!supabase) return { releases: demoReleases, error: 'Live releases are not configured. Showing the demo catalog.', provenance: 'demo' }

  const { data, error } = await supabase
    .from('releases')
    .select('id, release_at, release_timezone, retail_price, currency, launch_type, status, last_verified_at, published_at, products(name, colorway, image_url, brands(name)), retailer_launches(launch_url, launch_at, launch_type, availability_status, last_checked_at, retailers(name)), release_sources(field_coverage, verification_status, sources(source_type, publisher, url, reliability_tier, captured_at))')
    .eq('editorial_status', 'published')
    .eq('region', 'US')
    .order('release_at', { ascending: true })

  if (error) return { releases: demoReleases, error: 'Live releases are unavailable. Showing the demo catalog.', provenance: 'demo' }
  return { releases: (data as DatabaseRelease[]).map(toRelease), error: null, provenance: 'live' }
}

export function formatReleaseDateParts(releaseAt: string | null, timeZone: string) {
  if (!releaseAt) return { day: '--', month: 'TBD' }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, day: '2-digit', month: 'short' }).formatToParts(new Date(releaseAt))
  return { day: parts.find((part) => part.type === 'day')?.value ?? '--', month: parts.find((part) => part.type === 'month')?.value.toUpperCase() ?? 'TBD' }
}

export function formatLaunchTime(launchAt: string | null, timeZone: string) {
  if (!launchAt) return null
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(launchAt))
}