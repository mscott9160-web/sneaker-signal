import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type CollectionStatus = 'saved' | 'bought' | 'missed' | 'passed'

export type SavedRelease = {
  user_id: string
  release_id: string
  collection_status: CollectionStatus
  created_at: string
}

type Database = {
  public: {
    Tables: {
      saved_releases: {
        Row: SavedRelease
        Insert: Pick<SavedRelease, 'user_id' | 'release_id'> & { collection_status?: CollectionStatus }
        Update: Partial<Pick<SavedRelease, 'collection_status'>>
        Relationships: []
      }
    },
    Views: Record<string, never>,
    Functions: Record<string, never>,
    Enums: Record<string, never>,
    CompositeTypes: Record<string, never>
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient<Database> | null = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null

export async function getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
  if (!supabase) return { user: null, error: 'Supabase is not configured.' }

  const { data, error } = await supabase.auth.getUser()
  return { user: data.user, error: error?.message ?? null }
}

export async function listSavedReleases(userId: string): Promise<{ savedReleases: SavedRelease[]; error: string | null }> {
  if (!supabase) return { savedReleases: [], error: 'Supabase is not configured.' }

  const { data, error } = await supabase
    .from('saved_releases')
    .select('user_id, release_id, collection_status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { savedReleases: data ?? [], error: error?.message ?? null }
}

export async function saveRelease(userId: string, releaseId: string, collectionStatus: CollectionStatus = 'saved') {
  if (!supabase) return { savedRelease: null, error: 'Supabase is not configured.' }

  const { data, error } = await supabase
    .from('saved_releases')
    .upsert({ user_id: userId, release_id: releaseId, collection_status: collectionStatus })
    .select('user_id, release_id, collection_status, created_at')
    .single()

  return { savedRelease: data, error: error?.message ?? null }
}

export async function removeSavedRelease(userId: string, releaseId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' }

  const { error } = await supabase
    .from('saved_releases')
    .delete()
    .eq('user_id', userId)
    .eq('release_id', releaseId)

  return { error: error?.message ?? null }
}
