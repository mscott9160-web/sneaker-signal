import { useMemo, useState } from 'react'
import './App.css'

type Release = {
  id: number
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

const releases: Release[] = [
  { id: 1, day: '17', month: 'JUN', brand: 'NIKE', name: 'Air Max 95 OG', color: 'Neon / Black', price: '$185', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', status: 'Tomorrow', accent: '#e1ff00' },
  { id: 2, day: '21', month: 'JUN', brand: 'ADIDAS', name: 'Samba OG Wales Bonner', color: 'Cream White', price: '$160', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85', status: 'In 5 days', accent: '#ff6446' },
  { id: 3, day: '24', month: 'JUN', brand: 'NEW BALANCE', name: '990v6 Made in USA', color: 'Vintage Grey', price: '$200', image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=85', status: 'In 8 days', accent: '#a8c7ff' },
  { id: 4, day: '28', month: 'JUN', brand: 'SAUCONY', name: 'ProGrid Omni 9', color: 'Silver / Green', price: '$150', image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=85', status: 'In 12 days', accent: '#d4ffbd' },
]

const articles = [
  { tag: 'CULTURE', title: 'Why everyone is suddenly wearing the “wrong” sneaker', time: '4 min read', image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1000&q=85' },
  { tag: 'FIRST LOOK', title: 'The next generation of the Air Jordan 1 is here', time: '2 min read', image: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?auto=format&fit=crop&w=1000&q=85' },
]

function App() {
  const [activeTab, setActiveTab] = useState('All releases')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState<number[]>([])
  const [subscribed, setSubscribed] = useState(false)
  const visibleReleases = useMemo(() => {
    const matches = releases.filter((release) => `${release.brand} ${release.name}`.toLowerCase().includes(search.toLowerCase()))
    if (activeTab === 'Saved') return matches.filter((release) => saved.includes(release.id))
    return matches
  }, [activeTab, saved, search])

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

      <section className="content" id="releases"><div className="section-heading"><div><p className="kicker">STAY AHEAD</p><h2>Upcoming releases <sup>04</sup></h2></div><div className="tabs">{['All releases', 'This week', 'Saved'].map((tab) => <button className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div></div>
        <div className="release-grid">{visibleReleases.map((release) => <article className="release-card" key={release.id}><div className="release-image" style={{ backgroundColor: release.accent }}><img src={release.image} alt={release.name} /><button className={`save ${saved.includes(release.id) ? 'saved' : ''}`} aria-label="Save release" onClick={() => setSaved((current) => current.includes(release.id) ? current.filter((id) => id !== release.id) : [...current, release.id])}>{saved.includes(release.id) ? '♥' : '♡'}</button><span className="release-date"><b>{release.day}</b>{release.month}</span></div><div className="release-info"><div><p className="brand">{release.brand}</p><h3>{release.name}</h3><p className="colorway">{release.color}</p></div><div className="release-meta"><strong>{release.price}</strong><span>{release.status}</span></div></div></article>)}</div>
        {visibleReleases.length === 0 && <p className="empty">No saved releases match your search.</p>}
      </section>

      <section className="lower-content" id="news"><div className="news-column"><div className="section-heading compact"><div><p className="kicker">THE FEED</p><h2>Fresh from the culture</h2></div><a href="#news" className="view-all">View all <span>↗</span></a></div><div className="article-grid">{articles.map((article) => <article className="news-card" key={article.title}><img src={article.image} alt="" /><div className="news-card-copy"><p className="kicker">{article.tag}</p><h3>{article.title}</h3><p className="read-time">{article.time} <span>→</span></p></div></article>)}</div></div><aside className="newsletter"><p className="kicker">NOISE, FILTERED</p><h2>Get the good stuff.</h2><p>A tight edit of the week's best drops, stories, and things worth knowing. In your inbox every Friday.</p><button onClick={() => setSubscribed(true)}>{subscribed ? 'You’re on the list ✓' : 'Subscribe free ↗'}</button><small>No spam. Just sneakers.</small></aside></section>
      <footer><span className="wordmark"><span>SNKR</span><i>signal</i></span><span>Built for the rotation · © 2025</span><span>Instagram &nbsp; X &nbsp; Contact</span></footer>
    </main>
  )
}

export default App
