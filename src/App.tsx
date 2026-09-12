import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { demoReleases, loadReleases, type Release } from './release-data'

const articles = [
  { tag: 'CULTURE', title: 'Why everyone is suddenly wearing the “wrong” sneaker', time: '4 min read', image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1000&q=85' },
  { tag: 'FIRST LOOK', title: 'The next generation of the Air Jordan 1 is here', time: '2 min read', image: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?auto=format&fit=crop&w=1000&q=85' },
]

function releaseStatus(release: Release) {
  if (!release.releaseDate) return release.status
  const days = Math.ceil((new Date(release.releaseDate).getTime() - Date.now()) / 86400000)
  if (days <= 0) return 'Available now'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

function App() {
  const [activeTab, setActiveTab] = useState('All releases')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState<string[]>([])
  const [releases, setReleases] = useState<Release[]>(demoReleases)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [dialogTrigger, setDialogTrigger] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!selectedRelease) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRelease(null)
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.querySelector<HTMLButtonElement>('.dialog-close')?.focus()
    return () => { document.removeEventListener('keydown', handleKeyDown); dialogTrigger?.focus() }
  }, [dialogTrigger, selectedRelease])
  useEffect(() => {
    loadReleases().then(({ releases: loadedReleases, error }) => {
      setReleases(loadedReleases)
      setLoadError(error)
      setLoading(false)
    })
  }, [])
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
        <nav><a className="nav-active" href="#releases">Releases</a><a href="#news">News</a><a href="#brands">Brands</a></nav>
        <div className="top-actions"><span className="region-badge">US ONLY · USD</span><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sneakers..." /></label><button className="profile" aria-label="Open profile">JD</button></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> THE DAILY DROP · US RELEASES · 16 JUN 2025</p><h1>The pulse of<br /><em>sneaker culture.</em></h1><p className="hero-deck">Release dates, first looks, and the stories behind the pairs everyone is talking about.</p><a className="hero-link" href="#releases">Explore today's drops <span>↘</span></a></div>
        <div className="hero-art"><div className="art-sticker">NEW<br />THIS<br />WEEK</div><img src="https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=1200&q=90" alt="Red and white sneaker in motion" /><div className="hero-caption"><span>01 / 04</span><strong>THE SUMMER<br />ROTATION</strong></div></div>
      </section>

      <section className="content" id="releases"><div className="section-heading"><div><p className="kicker">STAY AHEAD</p><h2>Upcoming releases <sup>{releases.length.toString().padStart(2, '0')}</sup></h2></div><div className="tabs">{['All releases', 'This week', 'Saved'].map((tab) => <button className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div></div>
        {loadError && <p className="empty">{loadError}</p>}
        {!loading && <div className="release-grid">{visibleReleases.map((release) => <article className="release-card" key={release.id} role="button" tabIndex={0} aria-label={`View details for ${release.brand} ${release.name}`} onClick={(event) => { setDialogTrigger(event.currentTarget); setSelectedRelease(release) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDialogTrigger(event.currentTarget); setSelectedRelease(release) } }}><div className="release-image" style={{ backgroundColor: release.accent }}><img src={release.image} alt={release.name} /><button className={`save ${saved.includes(release.id) ? 'saved' : ''}`} aria-label="Save release" onClick={(event) => { event.stopPropagation(); setSaved((current) => current.includes(release.id) ? current.filter((id) => id !== release.id) : [...current, release.id]) }}>{saved.includes(release.id) ? '♥' : '♡'}</button><span className="release-date"><b>{release.day}</b>{release.month}</span></div><div className="release-info"><div><p className="brand">{release.brand}</p><h3>{release.name}</h3><p className="colorway">{release.color}</p></div><div className="release-meta"><strong>{release.price}</strong><span>{releaseStatus(release)}</span></div></div></article>)}</div>}
        {!loading && visibleReleases.length === 0 && <p className="empty">{activeTab === 'Saved' ? 'No saved releases match your search.' : activeTab === 'This week' ? 'No releases are scheduled this week.' : 'No releases match your search.'}</p>}
      </section>

      {selectedRelease && <div className="release-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRelease(null) }}><section className="release-dialog" role="dialog" aria-modal="true" aria-labelledby="release-dialog-title"><button className="dialog-close" aria-label="Close release details" onClick={() => setSelectedRelease(null)}>×</button><div className="dialog-image" style={{ backgroundColor: selectedRelease.accent }}><img src={selectedRelease.image} alt={selectedRelease.name} /></div><div className="dialog-copy"><p className="kicker">RELEASE DETAILS</p><p className="brand">{selectedRelease.brand}</p><h2 id="release-dialog-title">{selectedRelease.name}</h2><p className="dialog-colorway">{selectedRelease.color}</p><dl className="dialog-details"><div><dt>Release date</dt><dd>{selectedRelease.day} {selectedRelease.month}</dd></div><div><dt>Price</dt><dd>{selectedRelease.price}</dd></div><div><dt>Status</dt><dd>{selectedRelease.status}</dd></div></dl><div className="retailer-state"><p className="kicker">OFFICIAL RETAILERS</p>{selectedRelease.retailers.length > 0 ? <ul>{selectedRelease.retailers.map((retailer) => <li key={retailer.url}><a href={retailer.url} target="_blank" rel="noreferrer">{retailer.name}<span>↗</span></a></li>)}</ul> : <><p>Official launch links are not available yet.</p><span>COMING SOON</span></>}</div></div></section></div>}

      <section className="lower-content" id="news"><div className="news-column"><div className="section-heading compact"><div><p className="kicker">THE FEED</p><h2>Fresh from the culture</h2></div><a href="#news" className="view-all">View all <span>↗</span></a></div><div className="article-grid">{articles.map((article) => <article className="news-card" key={article.title}><img src={article.image} alt="" /><div className="news-card-copy"><p className="kicker">{article.tag}</p><h3>{article.title}</h3><p className="read-time">{article.time} <span>→</span></p></div></article>)}</div></div><aside className="newsletter"><p className="kicker">NOISE, FILTERED</p><h2>Get the good stuff.</h2><p>A tight edit of the week's best drops, stories, and things worth knowing. In your inbox every Friday.</p><button onClick={() => setSubscribed(true)}>{subscribed ? 'You’re on the list ✓' : 'Subscribe free ↗'}</button><small>No spam. Just sneakers.</small></aside></section>
      <footer><span className="wordmark"><span>SNKR</span><i>signal</i></span><span>Built for the rotation · © 2025</span><span>Instagram &nbsp; X &nbsp; Contact</span></footer>
    </main>
  )
}

export default App
