import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import { demoReleases, formatLaunchTime, isSafeRetailerUrl, loadReleases, type Release, type RetailerLaunch } from './release-data'
import { getCurrentUser, listSavedReleases, removeSavedRelease, saveRelease, supabase } from './supabase-client'

const articles = [
  { tag: 'CULTURE', title: 'Why everyone is suddenly wearing the “wrong” sneaker', time: '4 min read', image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1000&q=85' },
  { tag: 'FIRST LOOK', title: 'The next generation of the Air Jordan 1 is here', time: '2 min read', image: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?auto=format&fit=crop&w=1000&q=85' },
]

function releaseStatus(release: Release) {
  if (release.status) return release.status.replace(/_/g, ' ').toUpperCase()
  if (!release.releaseDate) return release.status
  const days = Math.ceil((new Date(release.releaseDate).getTime() - Date.now()) / 86400000)
  if (days <= 0) return 'Available now'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

function optionalReleaseField(release: Release, field: string) {
  const value = (release as Release & Record<string, unknown>)[field]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null
}

function formatReleaseDateTime(release: Release) {
  if (!release.releaseDate) return 'Launch time TBC'
  return new Intl.DateTimeFormat('en-US', { timeZone: release.releaseTimezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(release.releaseDate))
}

function formatRetailerDateTime(retailer: RetailerLaunch, release: Release) {
  return retailer.launchAt ? formatLaunchTime(retailer.launchAt, release.releaseTimezone) ?? 'Launch time TBC' : 'Launch time TBC'
}

function formatFreshness(timestamp: string | null) {
  if (!timestamp) return 'Verification pending'
  return `Verified ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp))}`
}

function retailerActionLabel(launchType: string, availabilityStatus: string) {
  const type = launchType.toLowerCase()
  const status = availabilityStatus.toLowerCase()
  if (['raffle', 'draw'].includes(type)) return 'Enter raffle'
  if (['online', 'in_store', 'restock'].includes(type) && !['sold_out', 'cancelled'].includes(status)) return 'Shop'
  return 'View launch details'
}

function primaryRetailer(release: Release) {
  return release.retailers.find((retailer) => isSafeRetailerUrl(retailer.url)) ?? null
}

function formatToday() {
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()
}

function App() {
  const [activeTab, setActiveTab] = useState('All releases')
  const [search, setSearch] = useState('')
  const [saved, setSavedState] = useState<string[]>([])
  const [releases, setReleases] = useState<Release[]>(demoReleases)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false)
  const [newsletterError, setNewsletterError] = useState('')
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [dialogTrigger, setDialogTrigger] = useState<HTMLElement | null>(null)
  const [dataSource, setDataSource] = useState<'live' | 'demo'>('demo')
  const [user, setUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [pendingSaves, setPendingSaves] = useState<string[]>([])
  const saveOperations = useRef<Record<string, number>>({})

  const fetchReleases = () => {
    setLoading(true)
    setLoadError(null)
    loadReleases().then(({ releases: loadedReleases, error, provenance }) => {
      setReleases(loadedReleases)
      setLoadError(error)
      setDataSource(provenance)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (!selectedRelease) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRelease(null)
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.dialog-close')?.focus())
    return () => { document.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = previousOverflow; dialogTrigger?.focus() }
  }, [dialogTrigger, selectedRelease])
  useEffect(() => {
    fetchReleases()
  }, [])
  useEffect(() => {
    if (!supabase) return
    let active = true
    getCurrentUser().then(({ user: currentUser, error }) => {
      if (!active) return
      if (error) setAuthMessage(error)
      setUser(currentUser)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!user || dataSource !== 'live') { setSavedState([]); return }
    let active = true
    listSavedReleases(user.id).then(({ savedReleases, error }) => {
      if (!active) return
      if (error) setAuthMessage(`Saved releases could not be loaded: ${error}`)
      else setSavedState(savedReleases.map((release) => release.release_id))
    })
    return () => { active = false }
  }, [dataSource, user])
  const requestMagicLink = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !authEmail.trim()) return
    setAuthBusy(true); setAuthMessage('')
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail.trim() })
    setAuthMessage(error ? error.message : 'Check your email for a sign-in link.')
    setAuthBusy(false)
  }
  const signOut = async () => { if (!supabase) return; setAuthBusy(true); await supabase.auth.signOut(); setAuthBusy(false) }
  const toggleSaved = async (release: Release) => {
    if (release.provenance !== 'live') { setAuthMessage('Demo releases cannot be saved. Connect live data to persist releases.'); return }
    if (!supabase || !user) { setAuthMessage(supabase ? 'Sign in to save releases.' : 'Saving is disabled in demo mode; connect Supabase to persist releases.'); return }
    const wasSaved = saved.includes(release.id)
    const operation = (saveOperations.current[release.id] ?? 0) + 1
    saveOperations.current[release.id] = operation
    setPendingSaves((current) => current.includes(release.id) ? current : [...current, release.id])
    setSavedState((current) => wasSaved ? current.filter((id) => id !== release.id) : [...current, release.id])
    const result = wasSaved ? await removeSavedRelease(user.id, release.id) : await saveRelease(user.id, release.id)
    if (saveOperations.current[release.id] === operation) {
      setPendingSaves((current) => current.filter((id) => id !== release.id))
      if (result.error) {
        setSavedState((current) => wasSaved ? [...current, release.id] : current.filter((id) => id !== release.id))
        setAuthMessage(`Could not ${wasSaved ? 'remove' : 'save'} ${release.name}: ${result.error}`)
      }
    }
  }
  const setSaved = (update: (current: string[]) => string[]) => {
    const next = update(saved)
    const changedId = [...new Set([...saved, ...next])].find((id) => saved.includes(id) !== next.includes(id))
    const release = releases.find((item) => item.id === changedId)
    if (release) void toggleSaved(release)
    else setSavedState(next)
  }
  const visibleReleases = useMemo(() => {
    const matches = releases.filter((release) => `${release.brand} ${release.name}`.toLowerCase().includes(search.toLowerCase()))
    if (activeTab === 'Saved') return matches.filter((release) => saved.includes(release.id))
    if (activeTab === 'This week') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7)
      return matches.filter((release) => { if (!release.releaseDate) return false; const date = new Date(release.releaseDate); return date >= today && date < weekEnd })
    }
    return matches
  }, [activeTab, releases, saved, search])

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top"><span>SNKR</span><i>signal</i></a>
        <nav><a className="nav-active" href="#releases">Releases</a><a href="#news">News</a><span className="inactive-nav" aria-disabled="true">Brands</span></nav>
        <div className="top-actions"><span className="region-badge">US ONLY · USD</span><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sneakers..." /></label>{user ? <button className="account-control" onClick={signOut} disabled={authBusy} aria-label="Sign out">Sign out</button> : supabase ? <form className="account-form" onSubmit={requestMagicLink}><label className="sr-only" htmlFor="auth-email">Email address</label><input id="auth-email" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email to sign in" required /><button type="submit" disabled={authBusy}>{authBusy ? 'Sending...' : 'Sign in'}</button></form> : <span className="inactive-control" aria-label="Sign in unavailable">Demo mode</span>}</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy"><p className="eyebrow"><span className={`live-dot ${dataSource === 'demo' ? 'demo-dot' : ''}`} /> {dataSource === 'live' ? 'LIVE DATA' : 'DEMO CATALOG'} · US RELEASES · {formatToday()}</p><h1>The pulse of<br /><em>sneaker culture.</em></h1><p className="hero-deck">Release dates, first looks, and the stories behind the pairs everyone is talking about.</p><a className="hero-link" href="#releases">Explore today's drops <span>↘</span></a></div>
        <div className="hero-art"><div className="art-sticker">NEW<br />THIS<br />WEEK</div><img src="https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=1200&q=90" alt="Red and white sneaker in motion" /><div className="hero-caption"><span>01 / 04</span><strong>THE SUMMER<br />ROTATION</strong></div></div>
      </section>

      <section className="content" id="releases"><div className="section-heading"><div><p className="kicker">STAY AHEAD</p><h2>Upcoming releases <sup>{releases.length.toString().padStart(2, '0')}</sup></h2></div><div className="tabs">{['All releases', 'This week', 'Saved'].map((tab) => <button className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div></div>
        {(loadError || authMessage || pendingSaves.length > 0) && <div className="status-message" role="status"><p>{authMessage || loadError || 'Saving release...'}</p>{loadError && <button onClick={fetchReleases}>Retry connection ↗</button>}</div>}
        {loading && <p className="empty" aria-live="polite">Loading releases...</p>}
        {!loading && <div className="release-grid">{visibleReleases.map((release) => { const verified = optionalReleaseField(release, 'verified') || optionalReleaseField(release, 'verificationStatus'); const isSaved = saved.includes(release.id); const retailer = primaryRetailer(release); return <article className="release-card" key={release.id} role="button" tabIndex={0} aria-label={`View details for ${release.brand} ${release.name}`} onClick={(event) => { setDialogTrigger(event.currentTarget); setSelectedRelease(release) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDialogTrigger(event.currentTarget); setSelectedRelease(release) } }}><div className="release-image" style={{ backgroundColor: release.accent }}>{release.image ? <img src={release.image} alt={`${release.brand} ${release.name} product image`} /> : <span className="image-fallback">Product image unavailable</span>}<button className={`save ${isSaved ? 'saved' : ''}`} aria-label={isSaved ? `Remove ${release.name} from saved releases` : `Save ${release.name}`} title={isSaved ? 'Remove saved release' : 'Save release'} onClick={(event) => { event.stopPropagation(); setSaved((current) => current.includes(release.id) ? current.filter((id) => id !== release.id) : [...current, release.id]) }} onKeyDown={(event) => event.stopPropagation()}>{isSaved ? '♥' : '♡'}</button><span className="release-date"><b>{release.day}</b>{release.month}</span></div><div className="release-info"><div><p className="brand">{release.brand}{verified && <span className="trust-badge"> · {verified}</span>}</p><h3>{release.name}</h3><p className="colorway">{release.color}</p></div><div className="release-meta"><strong>{release.price}</strong><span>{releaseStatus(release)}</span></div></div><div className="release-signal"><span>{retailer ? formatRetailerDateTime(retailer, release) : formatReleaseDateTime(release)}</span><span>{formatFreshness(release.lastVerifiedAt)}</span>{retailer ? <a href={retailer.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{retailerActionLabel(retailer.launchType, retailer.availabilityStatus)} <b>↗</b></a> : <span className="action-unavailable">Launch link unavailable</span>}</div></article> })}</div>}
        {!loading && visibleReleases.length === 0 && <p className="empty">{activeTab === 'Saved' ? 'No saved releases match your search.' : activeTab === 'This week' ? 'No releases are scheduled this week.' : 'No releases match your search.'}</p>}
      </section>

      {selectedRelease && <div className="release-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRelease(null) }}><section className="release-dialog" role="dialog" aria-modal="true" aria-labelledby="release-dialog-title" aria-describedby="release-dialog-description"><button className="dialog-close" aria-label="Close release details" onClick={() => setSelectedRelease(null)}>×</button><div className="dialog-image" style={{ backgroundColor: selectedRelease.accent }}>{selectedRelease.image ? <img src={selectedRelease.image} alt={`${selectedRelease.brand} ${selectedRelease.name} product image`} /> : <span className="image-fallback">Product image unavailable</span>}</div><div className="dialog-copy"><p className="kicker">RELEASE DETAILS · {dataSource.toUpperCase()}</p><p className="brand">{selectedRelease.brand}</p><h2 id="release-dialog-title">{selectedRelease.name}</h2><p className="dialog-colorway" id="release-dialog-description">{selectedRelease.color}</p><p className="dialog-launch-time">{formatReleaseDateTime(selectedRelease)}</p><dl className="dialog-details"><div><dt>Lifecycle</dt><dd>{releaseStatus(selectedRelease)}</dd></div><div><dt>Verification</dt><dd>{formatFreshness(selectedRelease.lastVerifiedAt)}</dd></div><div><dt>Price</dt><dd>{selectedRelease.price}</dd></div><div><dt>Source</dt><dd>{selectedRelease.sources[0]?.publisher ?? 'Source pending'}</dd></div></dl><div className="retailer-state"><p className="kicker">OFFICIAL RETAILERS</p>{selectedRelease.retailers.length > 0 ? <ul>{selectedRelease.retailers.map((retailer) => <li key={retailer.url}><div><strong>{retailer.name}</strong><small>{retailer.availabilityStatus.replace('_', ' ')}</small><small>{formatRetailerDateTime(retailer, selectedRelease)}</small></div>{isSafeRetailerUrl(retailer.url) ? <a href={retailer.url} target="_blank" rel="noreferrer">{retailerActionLabel(retailer.launchType, retailer.availabilityStatus)} <span>↗</span></a> : <span className="action-unavailable">Launch link unavailable</span>}</li>)}</ul> : <><p>Official launch links are not available yet.</p><span>COMING SOON</span></>}</div></div></section></div>}

      <section className="lower-content" id="news"><div className="news-column"><div className="section-heading compact"><div><p className="kicker">THE FEED</p><h2>Fresh from the culture</h2></div><span className="view-all muted-control">Editorial preview</span></div><div className="article-grid">{articles.map((article) => <article className="news-card" key={article.title}><img src={article.image} alt="" /><div className="news-card-copy"><p className="kicker">{article.tag}</p><h3>{article.title}</h3><p className="read-time">{article.time} <span>→</span></p></div></article>)}</div></div><aside className="newsletter"><p className="kicker">NOISE, FILTERED</p><h2>Get the good stuff.</h2><p>A tight edit of the week's best drops, stories, and things worth knowing. In your inbox every Friday.</p>{newsletterSubmitted ? <p className="newsletter-result" role="status">Email captured locally. Newsletter delivery is not connected yet.</p> : <form onSubmit={(event) => { event.preventDefault(); if (!/^\S+@\S+\.\S+$/.test(newsletterEmail)) { setNewsletterError('Enter a valid email address.'); return } setNewsletterError(''); setNewsletterSubmitted(true) }}><label htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="you@example.com" required /><button type="submit">Save my email ↗</button>{newsletterError && <small className="newsletter-error">{newsletterError}</small>}</form>}<small>No spam. Just sneakers.</small></aside></section>
      <footer><span className="wordmark"><span>SNKR</span><i>signal</i></span><span>Built for the rotation · © {new Date().getFullYear()}</span><span>Instagram &nbsp; X &nbsp; Contact</span></footer>
    </main>
  )
}

export default App
