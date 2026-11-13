import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import "./App.css";
import {
  calendarDaysUntil,
  demoReleases,
  formatLaunchTime,
  isSafeRetailerUrl,
  loadReleases,
  type Release,
  type RetailerLaunch,
} from "./release-data";
import { catalogLoadFailure } from "./release-model";
import { checkIsEditor } from "./editor-api";
import { SiteFooter } from "./SiteFooter";
import { emailDeliveryLive, routePaths, type Route } from "./routes";
import {
  getCurrentUser,
  getNotificationPreferences,
  listPublishedArticles,
  listSavedReleases,
  removeSavedRelease,
  saveRelease,
  supabase,
  upsertNotificationPreferences,
  type Article,
  type NotificationPreferences,
} from "./supabase-client";

const defaultNotificationPreferences: NotificationPreferences = {
  user_id: "",
  email_enabled: true,
  digest_enabled: true,
  restock_enabled: false,
  reminder_hours: [24, 1],
  timezone: "America/New_York",
  updated_at: "",
};

function formatNotificationTimezone(timezone: string) {
  const displayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "long" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  return displayName ? `${displayName} (${timezone})` : timezone;
}

const usTimezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function formatArticleDate(timestamp: string | null) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(timestamp));
}

function releaseStatus(release: Release) {
  if (release.status) return release.status.replace(/_/g, " ").toUpperCase();
  if (!release.releaseDate) return release.status;
  const days = calendarDaysUntil(release.releaseDate, release.releaseTimezone);
  if (days < 0) return "Released";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function optionalReleaseField(release: Release, field: string) {
  const value = (release as Release & Record<string, unknown>)[field];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function formatReleaseDateTime(release: Release) {
  if (!release.releaseDate) return "Launch time TBC";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: release.releaseTimezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${formatter.format(new Date(release.releaseDate))} (${release.releaseTimezone})`;
}

function formatRetailerDateTime(retailer: RetailerLaunch, release: Release) {
  return retailer.launchAt
    ? (formatLaunchTime(retailer.launchAt, release.releaseTimezone) ?? "Launch time TBC")
    : "Launch time TBC";
}

function formatFreshness(timestamp: string | null) {
  if (!timestamp) return "Verification pending";
  return `Verified ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(timestamp))} UTC`;
}

function describeAuthError(message: string) {
  if (message.toLowerCase().includes("rate limit"))
    return "Supabase temporarily limited sign-in emails. Wait a little while before trying again, or use a different email address.";
  return `Sign-in email could not be sent: ${message}`;
}

function retailerActionLabel(launchType: string, availabilityStatus: string) {
  const type = launchType.toLowerCase();
  const status = availabilityStatus.toLowerCase();
  if (["raffle", "draw"].includes(type)) return "Enter raffle";
  if (
    ["online", "in_store", "restock"].includes(type) &&
    !["sold_out", "cancelled"].includes(status)
  )
    return "Shop";
  return "View launch details";
}

function primaryRetailer(release: Release) {
  return release.retailers.find((retailer) => isSafeRetailerUrl(retailer.url)) ?? null;
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date())
    .toUpperCase();
}

function App({ route }: { route: Extract<Route, "home" | "notifications"> }) {
  const [activeTab, setActiveTab] = useState("All releases");
  const [search, setSearch] = useState("");
  const [saved, setSavedState] = useState<string[]>([]);
  const [releases, setReleases] = useState<Release[]>(demoReleases);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupSent, setSignupSent] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [dialogTrigger, setDialogTrigger] = useState<HTMLElement | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "demo">("demo");
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(route === "notifications");
  const [notificationPreferences, setNotificationPreferences] = useState(
    defaultNotificationPreferences,
  );
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [pendingSaves, setPendingSaves] = useState<string[]>([]);
  const [isEditor, setIsEditor] = useState(false);
  useEffect(() => {
    if (!user) {
      setIsEditor(false);
      return;
    }
    let active = true;
    checkIsEditor().then((result) => {
      if (active) setIsEditor(result);
    });
    return () => {
      active = false;
    };
  }, [user]);
  const saveOperations = useRef<Record<string, number>>({});

  const fetchReleases = () => {
    setLoading(true);
    setLoadError(null);
    loadReleases()
      .then(({ releases: loadedReleases, error, provenance }) => {
        setReleases(loadedReleases);
        setLoadError(error);
        setDataSource(provenance);
        setLoading(false);
      })
      .catch(() => {
        const failure = catalogLoadFailure<Release>();
        setReleases(failure.releases);
        setDataSource(failure.dataSource);
        setLoadError(failure.loadError);
        setLoading(failure.loading);
      });
  };

  useEffect(() => {
    if (!selectedRelease) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRelease(null);
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(".dialog-close")?.focus(),
    );
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      dialogTrigger?.focus();
    };
  }, [dialogTrigger, selectedRelease]);
  useEffect(() => {
    fetchReleases();
    let active = true;
    listPublishedArticles().then(({ articles: loadedArticles }) => {
      if (active) setArticles(loadedArticles);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    getCurrentUser().then(({ user: currentUser, error }) => {
      if (!active) return;
      if (error) setAuthMessage(error);
      setUser(currentUser);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || dataSource !== "live") {
      setSavedState([]);
      return;
    }
    let active = true;
    listSavedReleases(user.id).then(({ savedReleases, error }) => {
      if (!active) return;
      if (error) setAuthMessage(`Saved releases could not be loaded: ${error}`);
      else setSavedState(savedReleases.map((release) => release.release_id));
    });
    return () => {
      active = false;
    };
  }, [dataSource, user]);
  useEffect(() => {
    if (!user || !supabase) {
      setNotificationPreferences(defaultNotificationPreferences);
      return;
    }
    let active = true;
    setPreferencesBusy(true);
    getNotificationPreferences().then(({ preferences, error }) => {
      if (!active) return;
      if (error) setPreferencesMessage(`Notification preferences could not be loaded: ${error}`);
      else if (preferences) setNotificationPreferences(preferences);
      setPreferencesBusy(false);
    });
    return () => {
      active = false;
    };
  }, [user]);
  const sendMagicLink = (email: string) =>
    supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
  const requestMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !authEmail.trim()) return;
    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await sendMagicLink(authEmail.trim());
    setAuthMessage(
      error ? describeAuthError(error.message) : "Check your email for a sign-in link.",
    );
    setAuthBusy(false);
  };
  const requestSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const email = signupEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setSignupError("Enter a valid email address.");
      return;
    }
    setSignupError("");
    setAuthBusy(true);
    const { error } = await sendMagicLink(email);
    setAuthBusy(false);
    if (error) setSignupError(describeAuthError(error.message));
    else setSignupSent(true);
  };
  const signOut = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setPreferencesOpen(false);
    await supabase.auth.signOut();
    setAuthBusy(false);
  };
  const updateNotificationPreferences = async (update: Partial<NotificationPreferences>) => {
    if (!supabase || !user) return;
    const next = { ...notificationPreferences, ...update };
    setNotificationPreferences(next);
    setPreferencesBusy(true);
    setPreferencesMessage("");
    const { error } = await upsertNotificationPreferences(next);
    setPreferencesBusy(false);
    setPreferencesMessage(
      error
        ? `Could not save notification preferences: ${error}`
        : emailDeliveryLive
          ? "Preferences saved."
          : "Preferences saved. Email delivery is not active yet.",
    );
  };
  const toggleSaved = async (release: Release) => {
    if (release.provenance !== "live") {
      setAuthMessage("Demo releases cannot be saved. Connect live data to persist releases.");
      return;
    }
    if (!supabase || !user) {
      setAuthMessage(
        supabase
          ? "Sign in to save releases."
          : "Saving is disabled in demo mode; connect Supabase to persist releases.",
      );
      return;
    }
    const wasSaved = saved.includes(release.id);
    const operation = (saveOperations.current[release.id] ?? 0) + 1;
    saveOperations.current[release.id] = operation;
    setPendingSaves((current) =>
      current.includes(release.id) ? current : [...current, release.id],
    );
    setSavedState((current) =>
      wasSaved ? current.filter((id) => id !== release.id) : [...current, release.id],
    );
    const result = wasSaved
      ? await removeSavedRelease(user.id, release.id)
      : await saveRelease(user.id, release.id);
    if (saveOperations.current[release.id] === operation) {
      setPendingSaves((current) => current.filter((id) => id !== release.id));
      if (result.error) {
        setSavedState((current) =>
          wasSaved ? [...current, release.id] : current.filter((id) => id !== release.id),
        );
        setAuthMessage(
          `Could not ${wasSaved ? "remove" : "save"} ${release.name}: ${result.error}`,
        );
      }
    }
  };
  const setSaved = (update: (current: string[]) => string[]) => {
    const next = update(saved);
    const changedId = [...new Set([...saved, ...next])].find(
      (id) => saved.includes(id) !== next.includes(id),
    );
    const release = releases.find((item) => item.id === changedId);
    if (release) void toggleSaved(release);
    else setSavedState(next);
  };
  const visibleReleases = useMemo(() => {
    const matches = releases.filter((release) =>
      `${release.brand} ${release.name}`.toLowerCase().includes(search.toLowerCase()),
    );
    if (activeTab === "Saved") return matches.filter((release) => saved.includes(release.id));
    if (activeTab === "This week") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      return matches.filter((release) => {
        if (!release.releaseDate) return false;
        const date = new Date(release.releaseDate);
        return date >= today && date < weekEnd;
      });
    }
    return matches;
  }, [activeTab, releases, saved, search]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top">
          <span>SNKR</span>
          <i>signal</i>
        </a>
        <nav>
          <a className="nav-active" href="#releases">
            Releases
          </a>
          {articles.length > 0 && <a href="#news">News</a>}
        </nav>
        <div className="top-actions">
          <span className="region-badge">US ONLY · USD</span>
          <label className="search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sneakers..."
            />
          </label>
          {user ? (
            <>
              {isEditor && (
                <a className="account-control" href={routePaths.editor}>
                  Editor
                </a>
              )}
              <button
                className="account-control"
                onClick={() => setPreferencesOpen((open) => !open)}
                aria-expanded={preferencesOpen}
                aria-controls="notification-preferences"
              >
                {preferencesOpen ? "Close settings" : "Account"}
              </button>
              <button
                className="account-control"
                onClick={signOut}
                disabled={authBusy}
                aria-label="Sign out"
              >
                Sign out
              </button>
            </>
          ) : supabase ? (
            <form className="account-form" onSubmit={requestMagicLink}>
              <label className="sr-only" htmlFor="auth-email">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email to sign in"
                required
              />
              <button type="submit" disabled={authBusy}>
                {authBusy ? "Sending..." : "Sign in"}
              </button>
            </form>
          ) : (
            <span className="inactive-control" aria-label="Sign in unavailable">
              Demo mode
            </span>
          )}
        </div>
      </header>
      {preferencesOpen && user && (
        <section
          className="preferences-panel"
          id="notification-preferences"
          aria-labelledby="preferences-title"
        >
          <div>
            <p className="kicker">YOUR ROTATION</p>
            <h2 id="preferences-title">Notification preferences</h2>
            <p>Choose which emails you get and when. You can turn everything off at any time.</p>
            {!emailDeliveryLive && (
              <div className="delivery-status" role="status">
                <strong>Email delivery</strong>
                <span>
                  Not active yet. These settings are saved for when email delivery goes live.
                </span>
              </div>
            )}
            <button
              className="unsubscribe-all"
              type="button"
              disabled={
                preferencesBusy ||
                (!notificationPreferences.email_enabled &&
                  !notificationPreferences.digest_enabled &&
                  !notificationPreferences.restock_enabled)
              }
              onClick={() =>
                void updateNotificationPreferences({
                  email_enabled: false,
                  digest_enabled: false,
                  restock_enabled: false,
                })
              }
            >
              Turn off all email
            </button>
          </div>
          <div className="preference-options">
            <label>
              <span>
                <strong>Email reminders</strong>
                <small>Get reminded before releases you save.</small>
              </span>
              <input
                type="checkbox"
                checked={notificationPreferences.email_enabled}
                disabled={preferencesBusy}
                onChange={(event) =>
                  void updateNotificationPreferences({ email_enabled: event.target.checked })
                }
              />
            </label>
            <label>
              <span>
                <strong>Weekly digest</strong>
                <small>A weekly roundup of upcoming drops. Coming soon.</small>
              </span>
              <input
                type="checkbox"
                checked={notificationPreferences.digest_enabled}
                disabled={preferencesBusy}
                onChange={(event) =>
                  void updateNotificationPreferences({ digest_enabled: event.target.checked })
                }
              />
            </label>
            <label>
              <span>
                <strong>Restock alerts</strong>
                <small>Hear when saved pairs come back. Coming soon.</small>
              </span>
              <input
                type="checkbox"
                checked={notificationPreferences.restock_enabled}
                disabled={preferencesBusy}
                onChange={(event) =>
                  void updateNotificationPreferences({ restock_enabled: event.target.checked })
                }
              />
            </label>
          </div>
          <fieldset>
            <legend>Reminder timing</legend>
            <label>
              <input
                type="checkbox"
                checked={notificationPreferences.reminder_hours.includes(24)}
                disabled={preferencesBusy}
                onChange={(event) =>
                  void updateNotificationPreferences({
                    reminder_hours: event.target.checked
                      ? [...notificationPreferences.reminder_hours, 24].sort((a, b) => b - a)
                      : notificationPreferences.reminder_hours.filter((hours) => hours !== 24),
                  })
                }
              />{" "}
              24 hours before
            </label>
            <label>
              <input
                type="checkbox"
                checked={notificationPreferences.reminder_hours.includes(1)}
                disabled={preferencesBusy}
                onChange={(event) =>
                  void updateNotificationPreferences({
                    reminder_hours: event.target.checked
                      ? [...notificationPreferences.reminder_hours, 1].sort((a, b) => b - a)
                      : notificationPreferences.reminder_hours.filter((hours) => hours !== 1),
                  })
                }
              />{" "}
              1 hour before
            </label>
            <label className="timezone-setting">
              <strong>Timezone</strong>
              <select
                value={notificationPreferences.timezone}
                disabled={preferencesBusy}
                onChange={(event) =>
                  void updateNotificationPreferences({ timezone: event.target.value })
                }
              >
                {[...new Set([notificationPreferences.timezone, ...usTimezones])].map((zone) => (
                  <option key={zone} value={zone}>
                    {formatNotificationTimezone(zone)}
                  </option>
                ))}
              </select>
              <small>Used for reminder times.</small>
            </label>
          </fieldset>
          {preferencesBusy && (
            <p className="preference-status" role="status">
              Saving preferences...
            </p>
          )}
          {preferencesMessage && (
            <p className="preference-status" role="status">
              {preferencesMessage}
            </p>
          )}
        </section>
      )}

      {route === "notifications" && !user && (
        <section className="preferences-panel signed-out-settings" aria-labelledby="settings-title">
          <div>
            <p className="kicker">YOUR ROTATION</p>
            <h2 id="settings-title">Notification settings</h2>
            <p>
              {supabase
                ? "Sign in with the email you get reminders at to change or turn off your emails. We'll send you a one-time sign-in link."
                : "Account features are not available on this deployment."}
            </p>
            {supabase && (
              <form className="settings-signin" onSubmit={requestMagicLink}>
                <label className="sr-only" htmlFor="settings-email">
                  Email address
                </label>
                <input
                  id="settings-email"
                  type="email"
                  autoComplete="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
                <button type="submit" disabled={authBusy}>
                  {authBusy ? "Sending..." : "Email me a sign-in link"}
                </button>
              </form>
            )}
            {authMessage && (
              <p className="settings-signin-status" role="status">
                {authMessage}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className={`live-dot ${dataSource === "demo" ? "demo-dot" : ""}`} />{" "}
            {dataSource === "live" ? "LIVE DATA" : "DEMO CATALOG"} · US RELEASES · {formatToday()}
          </p>
          <h1>
            The pulse of
            <br />
            <em>sneaker culture.</em>
          </h1>
          <p className="hero-deck">
            Release dates, first looks, and the stories behind the pairs everyone is talking about.
          </p>
          <a className="hero-link" href="#releases">
            Explore upcoming drops <span>↘</span>
          </a>
        </div>
        <div className="hero-art">
          <div className="art-sticker" aria-hidden="true">
            US
            <br />
            DROPS
            <br />
            ONLY
          </div>
          <img
            src="https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=1200&q=90"
            alt="Red and white sneaker in motion"
          />
          <div className="hero-caption">
            <strong>
              DATES · PRICES
              <br />
              WHERE TO BUY
            </strong>
          </div>
        </div>
      </section>

      <section className="content" id="releases">
        <div className="section-heading">
          <div>
            <p className="kicker">STAY AHEAD</p>
            <h2>
              Upcoming releases{" "}
              {!loading && <sup>{releases.length.toString().padStart(2, "0")}</sup>}
            </h2>
          </div>
          <div className="tabs">
            {["All releases", "This week", "Saved"].map((tab) => (
              <button
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
                key={tab}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className={`catalog-source ${dataSource}`} role="status">
          <strong>
            {loading
              ? "CONNECTING"
              : dataSource === "live"
                ? "LIVE SUPABASE CATALOG"
                : "DEMO FALLBACK CATALOG"}
          </strong>
          <span>
            {loading
              ? "Loading published US releases."
              : dataSource === "live"
                ? "Published US releases from the connected database."
                : (loadError ?? "Supabase is not configured. This catalog is sample data.")}
          </span>
          {loadError && supabase && <button onClick={fetchReleases}>Retry connection ↗</button>}
        </div>
        {(authMessage || pendingSaves.length > 0) && (
          <div className="status-message" role="status">
            <p>{authMessage || "Saving release..."}</p>
          </div>
        )}
        {loading && (
          <p className="empty" aria-live="polite">
            Loading releases...
          </p>
        )}
        {!loading && (
          <div className="release-grid">
            {visibleReleases.map((release) => {
              const verified =
                optionalReleaseField(release, "verified") ||
                optionalReleaseField(release, "verificationStatus");
              const isSaved = saved.includes(release.id);
              const retailer = primaryRetailer(release);
              return (
                <article
                  className="release-card"
                  key={release.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${release.brand} ${release.name}`}
                  onClick={(event) => {
                    setDialogTrigger(event.currentTarget);
                    setSelectedRelease(release);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDialogTrigger(event.currentTarget);
                      setSelectedRelease(release);
                    }
                  }}
                >
                  <div className="release-image" style={{ backgroundColor: release.accent }}>
                    {release.image ? (
                      <img
                        src={release.image}
                        alt={`${release.brand} ${release.name} product image`}
                      />
                    ) : (
                      <span className="image-fallback">Product image unavailable</span>
                    )}
                    <button
                      className={`save ${isSaved ? "saved" : ""}`}
                      aria-label={
                        isSaved
                          ? `Remove ${release.name} from saved releases`
                          : `Save ${release.name}`
                      }
                      title={isSaved ? "Remove saved release" : "Save release"}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSaved((current) =>
                          current.includes(release.id)
                            ? current.filter((id) => id !== release.id)
                            : [...current, release.id],
                        );
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {isSaved ? "♥" : "♡"}
                    </button>
                    <span className="release-date">
                      <b>{release.day}</b>
                      {release.month}
                    </span>
                  </div>
                  <div className="release-info">
                    <div>
                      <p className="brand">
                        {release.brand}
                        {verified && <span className="trust-badge"> · {verified}</span>}
                      </p>
                      <h3>{release.name}</h3>
                      <p className="colorway">{release.color}</p>
                    </div>
                    <div className="release-meta">
                      <strong>{release.price}</strong>
                      <span>{releaseStatus(release)}</span>
                    </div>
                  </div>
                  <div className="release-signal">
                    <span>
                      {retailer
                        ? formatRetailerDateTime(retailer, release)
                        : formatReleaseDateTime(release)}
                    </span>
                    <span>{formatFreshness(release.lastVerifiedAt)}</span>
                    {retailer ? (
                      <a
                        href={retailer.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {retailerActionLabel(retailer.launchType, retailer.availabilityStatus)}{" "}
                        <b>↗</b>
                      </a>
                    ) : (
                      <span className="action-unavailable">Launch link unavailable</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!loading && visibleReleases.length === 0 && (
          <p className="empty">
            {activeTab === "Saved"
              ? "No saved releases match your search."
              : activeTab === "This week"
                ? "No releases are scheduled this week."
                : releases.length === 0
                  ? "No upcoming releases are published right now. Check back soon."
                  : "No releases match your search."}
          </p>
        )}
      </section>

      {selectedRelease && (
        <div
          className="release-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedRelease(null);
          }}
        >
          <section
            className="release-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-dialog-title"
            aria-describedby="release-dialog-description"
          >
            <button
              className="dialog-close"
              aria-label="Close release details"
              onClick={() => setSelectedRelease(null)}
            >
              ×
            </button>
            <div className="dialog-image" style={{ backgroundColor: selectedRelease.accent }}>
              {selectedRelease.image ? (
                <img
                  src={selectedRelease.image}
                  alt={`${selectedRelease.brand} ${selectedRelease.name} product image`}
                />
              ) : (
                <span className="image-fallback">Product image unavailable</span>
              )}
            </div>
            <div className="dialog-copy">
              <p className="kicker">RELEASE DETAILS · {dataSource.toUpperCase()}</p>
              <p className="brand">{selectedRelease.brand}</p>
              <h2 id="release-dialog-title">{selectedRelease.name}</h2>
              <p className="dialog-colorway" id="release-dialog-description">
                {selectedRelease.color}
              </p>
              <p className="dialog-launch-time">{formatReleaseDateTime(selectedRelease)}</p>
              <dl className="dialog-details">
                <div>
                  <dt>Lifecycle</dt>
                  <dd>{releaseStatus(selectedRelease)}</dd>
                </div>
                <div>
                  <dt>Verification</dt>
                  <dd>{formatFreshness(selectedRelease.lastVerifiedAt)}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>
                    {selectedRelease.price} {selectedRelease.currency}
                  </dd>
                </div>
              </dl>
              <div className="source-state">
                <p className="kicker">SOURCES</p>
                {selectedRelease.sources.length > 0 ? (
                  <ul>
                    {selectedRelease.sources.map((source) => (
                      <li key={`${source.url}-${source.publisher}`}>
                        <div>
                          <strong>{source.publisher}</strong>
                          <small>
                            {source.sourceType} · Reliability tier {source.reliabilityTier}
                          </small>
                          <small>
                            {source.verificationStatus} ·{" "}
                            {source.capturedAt
                              ? formatFreshness(source.capturedAt)
                              : "Capture time unavailable"}
                          </small>
                        </div>
                        {isSafeRetailerUrl(source.url) ? (
                          <a href={source.url} target="_blank" rel="noreferrer">
                            Open source <span>↗</span>
                          </a>
                        ) : (
                          <span className="action-unavailable">Source link unavailable</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No source metadata is available yet.</p>
                )}
              </div>
              <div className="retailer-state">
                <p className="kicker">OFFICIAL RETAILERS</p>
                {selectedRelease.retailers.length > 0 ? (
                  <>
                    <ul>
                      {selectedRelease.retailers.map((retailer) => (
                        <li key={retailer.url}>
                          <div>
                            <strong>{retailer.name}</strong>
                            <small>{retailer.availabilityStatus.replace("_", " ")}</small>
                            <small>{formatRetailerDateTime(retailer, selectedRelease)}</small>
                          </div>
                          {isSafeRetailerUrl(retailer.url) ? (
                            <a href={retailer.url} target="_blank" rel="noreferrer">
                              {retailerActionLabel(
                                retailer.launchType,
                                retailer.availabilityStatus,
                              )}{" "}
                              <span>↗</span>
                            </a>
                          ) : (
                            <span className="action-unavailable">Launch link unavailable</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="affiliate-note">
                      Some retailer links may earn us a commission.{" "}
                      <a href={`${routePaths.terms}#affiliate-disclosure`}>Learn more</a>
                    </p>
                  </>
                ) : (
                  <>
                    <p>Official launch links are not available yet.</p>
                    <span>COMING SOON</span>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <section className={`lower-content ${articles.length ? "" : "no-news"}`} id="news">
        {articles.length > 0 && (
          <div className="news-column">
            <div className="section-heading compact">
              <div>
                <p className="kicker">THE FEED</p>
                <h2>Fresh from the culture</h2>
              </div>
            </div>
            <div className="article-grid">
              {articles.map((article) => {
                const href =
                  article.source_url && isSafeRetailerUrl(article.source_url)
                    ? article.source_url
                    : null;
                return (
                  <article className="news-card" key={article.id}>
                    <div className="news-card-copy">
                      <p className="kicker">{article.category.toUpperCase()}</p>
                      <h3>
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer">
                            {article.title}
                          </a>
                        ) : (
                          article.title
                        )}
                      </h3>
                      {article.excerpt && <p className="news-excerpt">{article.excerpt}</p>}
                      {formatArticleDate(article.published_at) && (
                        <p className="read-time">{formatArticleDate(article.published_at)}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
        <aside className="newsletter">
          <p className="kicker">NEVER MISS A DROP</p>
          <h2>Get reminded before it drops.</h2>
          <p>
            Create a free account to save releases and choose when we email you: 24 hours or 1 hour
            before launch.
          </p>
          {!supabase ? (
            <p className="newsletter-result" role="status">
              Accounts are not available on this deployment.
            </p>
          ) : user ? (
            <p className="newsletter-result" role="status">
              You're signed in. Tap the heart on any release to save it, and manage reminders in{" "}
              <a href={routePaths.notifications}>notification settings</a>.
            </p>
          ) : signupSent ? (
            <p className="newsletter-result" role="status">
              Check your inbox for a sign-in link to finish creating your account.
            </p>
          ) : (
            <form onSubmit={requestSignup} noValidate>
              <label htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
              <button type="submit" disabled={authBusy}>
                {authBusy ? "Sending..." : "Create free account ↗"}
              </button>
              {signupError && (
                <small className="newsletter-error" role="alert">
                  {signupError}
                </small>
              )}
            </form>
          )}
          <small>
            No spam. Unsubscribe anytime. <a href={routePaths.privacy}>Privacy</a>
          </small>
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}

export default App;
