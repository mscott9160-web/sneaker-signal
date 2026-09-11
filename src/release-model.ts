export type ReleaseRecord = {
  id: number
  brand: string
  name: string
  status: string
}

export const VERIFIED_STATUSES = ['confirmed', 'restock'] as const

export function filterReleases(releases: ReleaseRecord[], search: string, savedIds: number[], savedOnly: boolean) {
  const query = search.trim().toLowerCase()
  const matches = releases.filter((release) => `${release.brand} ${release.name}`.toLowerCase().includes(query))
  return savedOnly ? matches.filter((release) => savedIds.includes(release.id)) : matches
}

export function isVerifiedRelease(status: string) {
  return VERIFIED_STATUSES.includes(status as (typeof VERIFIED_STATUSES)[number])
}
