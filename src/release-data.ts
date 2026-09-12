import { createClient } from '@supabase/supabase-js'

export type Release = {
  id: string
  day: string
  month: string
  brand: string
  name: string
  color: string
  price: string
  image: string
  status: string
  accent: string
}

export const demoReleases: Release[] = [
  { id: 'demo-1', day: '17', month: 'JUN', brand: 'NIKE', name: 'Air Max 95 OG', color: 'Neon / Black', price: '$185', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', status: 'Tomorrow', accent: '#e1ff00' },
  { id: 'demo-2', day: '21', month: 'JUN', brand: 'ADIDAS', name: 'Samba OG Wales Bonner', color: 'Cream White', price: '$160', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85', status: 'In 5 days', accent: '#ff6446' },
  { id: 'demo-3', day: '24', month: 'JUN', brand: 'NEW BALANCE', name: '990v6 Made in USA', color: 'Vintage Grey', price: '$200', image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=85', status: 'In 8 days', accent: '#a8c7ff' },
  { id: 'demo-4', day: '28', month: 'JUN', brand: 'SAUCONY', name: 'ProGrid Omni 9', color: 'Silver / Green', price: '$150', image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=85', status: 'In 12 days', accent: '#d4ffbd' },
]

type DatabaseRelease = {
  id: string
  release_at: string | null
  retail_price: number | null
  currency: string
  status: string
  products: DatabaseProduct | DatabaseProduct[] | null
}

type DatabaseProduct = { name: string; colorway: string | null; image_url: string | null; brands: { name: string } | { name: string }[] | null }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function toRelease(row: DatabaseRelease): Release {
  const date = row.release_at ? new Date(row.release_at) : null
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  const brand = product?.brands
  const brandName = brand && Array.isArray(brand) ? brand[0]?.name : brand?.name
  return {
    id: row.id,
    day: date ? String(date.getDate()).padStart(2, '0') : '--',
    month: date ? date.toLocaleString('en-US', { month: 'short' }).toUpperCase() : 'TBD',
    brand: brandName?.toUpperCase() ?? 'UNKNOWN',
    name: product?.name ?? 'Unnamed release',
    color: product?.colorway ?? 'Colorway TBC',
    price: row.retail_price === null ? 'TBC' : new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(row.retail_price),
    image: product?.image_url ?? demoReleases[0].image,
    status: row.status.replace('_', ' '),
    accent: '#ebe7df',
  }
}

export async function loadReleases(): Promise<{ releases: Release[]; error: string | null }> {
  if (!supabase) return { releases: demoReleases, error: null }

  const { data, error } = await supabase
    .from('releases')
    .select('id, release_at, retail_price, currency, status, products(name, colorway, image_url, brands(name))')
    .eq('editorial_status', 'published')
    .eq('region', 'US')
    .order('release_at', { ascending: true })

  if (error) return { releases: demoReleases, error: 'Live releases are unavailable. Showing the demo catalog.' }
  return { releases: (data as DatabaseRelease[]).map(toRelease), error: null }
}