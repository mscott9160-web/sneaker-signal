import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { formatReminderDate, isReminderDue, reminderScheduledFor } from './reminder.ts'
import { constantTimeEqual, hasSelectedReminderHour, isDryRunEnabled, isEligibleRelease, isTransientProviderFailure, MAX_REMINDER_ATTEMPTS, resolveTimezone, retryBackoffSeconds } from './policy.ts'

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const safeError = (status: number) => json({ error: status === 401 ? 'Unauthorized' : 'Reminder delivery unavailable.' }, status)

type Candidate = {
  user_id: string
  release_id: string
  reminder_hours: number
  timezone: string
  release_at: string
  product: { name: string } | { name: string }[] | null
}

type ReleaseRow = {
  id: string
  product_id: string
  release_at: string
  release_timezone: string
}

type ProductRow = {
  id: string
  name: string
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const functionSecret = Deno.env.get('REMINDER_FUNCTION_SECRET')
  if (!functionSecret) return safeError(503)

  const suppliedSecret = request.headers.get('x-reminder-secret')
  if (!suppliedSecret || !constantTimeEqual(suppliedSecret, functionSecret)) return safeError(401)

  const dryRun = isDryRunEnabled(Deno.env.get('DRY_RUN'))
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '')
  if ((!resendKey || !fromEmail || !appUrl) && !dryRun) return safeError(503)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SNEAKER_SIGNAL_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return safeError(503)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const now = new Date()
  const { data: savedReleases, error: savedReleaseError } = await admin
    .from('saved_releases')
    .select('user_id, release_id')
    .eq('collection_status', 'saved')

  if (savedReleaseError) return json({ error: 'Could not load reminder candidates.' }, 500)

  const releaseIds = [...new Set((savedReleases ?? []).map((row) => row.release_id))]
  const { data: releases, error: releaseError } = releaseIds.length === 0
    ? { data: [], error: null }
    : await admin
      .from('releases')
      .select('id, product_id, release_at, release_timezone')
      .in('id', releaseIds)
      .eq('editorial_status', 'published')
      .eq('status', 'confirmed')
      .eq('region', 'US')
      .not('release_at', 'is', null)

  if (releaseError) return json({ error: 'Could not load reminder candidates.' }, 500)

  const productIds = [...new Set((releases ?? []).map((release) => release.product_id))]
  const { data: products, error: productError } = productIds.length === 0
    ? { data: [], error: null }
    : await admin.from('products').select('id, name').in('id', productIds)

  if (productError) return json({ error: 'Could not load reminder candidates.' }, 500)

  const releasesById = new Map((releases ?? []).map((release: ReleaseRow) => [release.id, release]))
  const productsById = new Map((products ?? []).map((product: ProductRow) => [product.id, product]))
  const candidates = (savedReleases ?? []).flatMap((savedRelease) => {
    const release = releasesById.get(savedRelease.release_id)
    if (!release) return []
    return [{
      user_id: savedRelease.user_id,
      release_id: savedRelease.release_id,
      releases: { ...release, products: productsById.get(release.product_id) ?? null },
    }]
  })

  const { data: preferenceRows, error: preferenceError } = await admin
    .from('notification_preferences')
    .select('user_id, email_enabled, reminder_hours, timezone')
    .eq('email_enabled', true)
  if (preferenceError) return json({ error: 'Could not load reminder preferences.' }, 500)
  const preferencesByUser = new Map((preferenceRows ?? []).map((preference) => [preference.user_id, preference]))

  let sent = 0
  let skipped = 0
  for (const row of (candidates ?? []) as unknown as Array<Candidate & { releases: { release_at: string; release_timezone: string; products: Candidate['product'] } }>) {
    const release = row.releases
    if (!isEligibleRelease(release, now)) { skipped++; continue }
    const preferences = preferencesByUser.get(row.user_id)
    if (!preferences) { skipped++; continue }
    const product = Array.isArray(release.products) ? release.products[0] : release.products
    for (const reminderHours of preferences.reminder_hours ?? []) {
      if (!hasSelectedReminderHour(preferences.reminder_hours, reminderHours)) { skipped++; continue }
      const candidate = { releaseAt: release.release_at, timezone: resolveTimezone(preferences.timezone, release.release_timezone), reminderHours }
      if (!isReminderDue(candidate, now)) { skipped++; continue }
      const scheduledFor = reminderScheduledFor(candidate)
      if (!scheduledFor) { skipped++; continue }

      if (dryRun) { skipped++; continue }
      const { data: delivery, error: claimError } = await admin.rpc('claim_release_reminder_delivery', {
        p_user_id: row.user_id,
        p_release_id: row.release_id,
        p_reminder_hours: reminderHours,
        p_scheduled_for: scheduledFor.toISOString(),
        p_lease_until: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      }).maybeSingle()
      if (claimError || !delivery) { skipped++; continue }

      const { data: userData } = await admin.auth.admin.getUserById(row.user_id)
      const email = userData.user?.email
      if (!email) {
        await admin.from('release_reminder_deliveries').update({ status: 'dead_letter', error_message: 'recipient_missing', lease_until: null }).eq('id', delivery.id)
        console.warn('reminder delivery skipped', { category: 'recipient_missing' })
        skipped++
        continue
      }
      const releaseName = product?.name ?? 'Saved sneaker release'
      const releaseDate = formatReminderDate(candidate) ?? release.release_at
      const preferencesUrl = `${appUrl}/settings/notifications`
      let response: Response
      try {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromEmail, to: [email], subject: `${releaseName} releases soon`, text: `${releaseName} releases ${releaseDate}. Manage notification preferences: ${preferencesUrl}` }),
        })
      } catch {
        const nextAttemptAt = new Date(Date.now() + retryBackoffSeconds(delivery.attempt_count ?? 1) * 1000).toISOString()
        await admin.from('release_reminder_deliveries').update({ status: (delivery.attempt_count ?? 1) >= MAX_REMINDER_ATTEMPTS ? 'dead_letter' : 'pending', error_message: 'provider_network', next_attempt_at: nextAttemptAt, lease_until: null }).eq('id', delivery.id)
        console.warn('reminder delivery failed', { category: 'provider_network' })
        continue
      }
      const result = await response.json().catch(() => ({})) as { id?: string }
      if (!response.ok) {
        const transient = isTransientProviderFailure(undefined, response.status)
        const nextAttemptAt = new Date(Date.now() + retryBackoffSeconds(delivery.attempt_count ?? 1) * 1000).toISOString()
        await admin.from('release_reminder_deliveries').update({ status: transient && (delivery.attempt_count ?? 1) < MAX_REMINDER_ATTEMPTS ? 'pending' : 'dead_letter', error_message: transient ? 'provider_transient' : 'provider_rejected', next_attempt_at: nextAttemptAt, lease_until: null }).eq('id', delivery.id)
        console.warn('reminder delivery rejected', { category: transient ? 'provider_transient' : 'provider_rejected' })
        continue
      }
      await admin.from('release_reminder_deliveries').update({ status: 'sent', provider_id: result.id ?? null, sent_at: new Date().toISOString(), next_attempt_at: null, lease_until: null }).eq('id', delivery.id)
      sent++
    }
  }

  return json({ dry_run: dryRun, sent, skipped })
})
