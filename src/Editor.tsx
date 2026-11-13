import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import "./Editor.css";
import {
  checkIsEditor,
  draftFromRelease,
  editorTimezones,
  emptyDraft,
  launchTypes,
  loadEditorData,
  releaseStatuses,
  saveDraft,
  setReleaseState,
  sourceTier,
  sourceTypes,
  type EditorRelease,
  type EditorialState,
  type Option,
  type ReleaseDraft,
} from "./editor-api";
import { routePaths } from "./routes";
import { getCurrentUser, supabase } from "./supabase-client";

type Access = "loading" | "unconfigured" | "signed-out" | "denied" | "editor";
type Filter = "drafts" | "published" | "archived" | "all";

const filterStates: Record<Filter, EditorialState[] | null> = {
  drafts: ["imported", "needs_review", "approved", "scheduled", "rejected"],
  published: ["published"],
  archived: ["archived"],
  all: null,
};

const label = (value: string) => value.replace(/_/g, " ");

function formatLaunch(release: EditorRelease) {
  if (!release.release_at) return "Date TBC";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: release.release_timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(release.release_at));
}

function bestTier(release: EditorRelease) {
  const tiers = release.release_sources
    .filter((link) => link.verification_status === "verified" && link.sources)
    .map((link) => link.sources!.reliability_tier);
  return tiers.length ? Math.min(...tiers) : null;
}

export function Editor() {
  const [access, setAccess] = useState<Access>(supabase ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [releases, setReleases] = useState<EditorRelease[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [retailers, setRetailers] = useState<Option[]>([]);
  const [filter, setFilter] = useState<Filter>("drafts");
  const [draft, setDraft] = useState<ReleaseDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const data = await loadEditorData();
    setReleases(data.releases);
    setBrands(data.brands);
    setRetailers(data.retailers);
    if (data.error) setError(`Could not load the catalog: ${data.error}`);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const resolve = async (currentUser: User | null) => {
      if (!active) return;
      setUser(currentUser);
      if (!currentUser) return setAccess("signed-out");
      const isEditor = await checkIsEditor();
      if (!active) return;
      setAccess(isEditor ? "editor" : "denied");
      if (isEditor) void refresh();
    };
    getCurrentUser().then(({ user: currentUser }) => resolve(currentUser));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const visible = useMemo(() => {
    const states = filterStates[filter];
    return states
      ? releases.filter((release) => states.includes(release.editorial_status))
      : releases;
  }, [filter, releases]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(filterStates) as Filter[]).map((key) => {
          const states = filterStates[key];
          return [
            key,
            states
              ? releases.filter((release) => states.includes(release.editorial_status)).length
              : releases.length,
          ];
        }),
      ) as Record<Filter, number>,
    [releases],
  );

  const update = <K extends keyof ReleaseDraft>(key: K, value: ReleaseDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const editing = Boolean(draft.release_id);
  const editingRelease = releases.find((release) => release.id === draft.release_id) ?? null;

  const startNew = () => {
    setDraft(emptyDraft);
    setFormError("");
    setNotice("");
  };

  const startEdit = (release: EditorRelease) => {
    setDraft(draftFromRelease(release));
    setFormError("");
    setNotice("");
    document.getElementById("editor-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const submit = async (editorialStatus: "needs_review" | "published") => {
    setBusy(true);
    setFormError("");
    setError("");
    setNotice("");
    const result = await saveDraft(draft, editorialStatus);
    setBusy(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setNotice(
      editorialStatus === "published"
        ? `Published ${draft.product_name}. It's live on the site now.`
        : `Saved ${draft.product_name} as a draft. It isn't public.`,
    );
    setDraft(emptyDraft);
    setFilter(editorialStatus === "published" ? "published" : "drafts");
    await refresh();
  };

  const changeState = async (
    release: EditorRelease,
    change: { editorialStatus?: EditorialState; status?: string },
    needsReason = false,
  ) => {
    let reason: string | undefined;
    if (needsReason) {
      const answer = window.prompt(
        `Why are you archiving ${release.products?.name ?? "this release"}? This is kept in the audit log.`,
      );
      if (answer === null) return;
      reason = answer;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const result = await setReleaseState(release.id, { ...change, reason });
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setNotice(`Updated ${release.products?.name ?? "release"}.`);
      await refresh();
    }
  };

  const requestLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !authEmail.trim()) return;
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}${routePaths.editor}`,
        shouldCreateUser: false,
      },
    });
    setBusy(false);
    setAuthMessage(
      signInError
        ? `Could not send a sign-in link: ${signInError.message}`
        : "Check your email for a sign-in link.",
    );
  };

  const header = (
    <header className="topbar">
      <a className="wordmark" href={routePaths.home}>
        <span>SNKR</span>
        <i>signal</i>
      </a>
      <div className="editor-header-actions">
        <span className="region-badge">EDITOR</span>
        <a className="back-link" href={routePaths.home}>
          View site ↗
        </a>
        {user && supabase && (
          <button className="account-control" onClick={() => void supabase!.auth.signOut()}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );

  if (access !== "editor") {
    return (
      <main className="app-shell">
        {header}
        <section className="editor-gate">
          <p className="kicker">SNEAKER SIGNAL EDITOR</p>
          <h1>Release desk</h1>
          {access === "loading" && <p>Checking your access…</p>}
          {access === "unconfigured" && <p>The editor needs a configured Supabase project.</p>}
          {access === "denied" && (
            <p>
              You're signed in as {user?.email}, but this account isn't an editor. Ask the site
              owner to grant you the editor role.
            </p>
          )}
          {access === "signed-out" && (
            <>
              <p>Sign in with your editor email. We'll send you a one-time link.</p>
              <form className="settings-signin" onSubmit={requestLink}>
                <label className="sr-only" htmlFor="editor-email">
                  Email address
                </label>
                <input
                  id="editor-email"
                  type="email"
                  autoComplete="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
                <button type="submit" disabled={busy}>
                  {busy ? "Sending..." : "Email me a sign-in link"}
                </button>
              </form>
              {authMessage && <p role="status">{authMessage}</p>}
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {header}
      <div className="editor-layout">
        <section className="editor-list" aria-labelledby="editor-list-title">
          <div className="editor-list-heading">
            <div>
              <p className="kicker">CATALOG</p>
              <h1 id="editor-list-title">Release desk</h1>
            </div>
            <button className="editor-primary" onClick={startNew} disabled={busy}>
              + New release
            </button>
          </div>
          <div className="tabs editor-tabs" role="tablist">
            {(Object.keys(filterStates) as Filter[]).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {key[0].toUpperCase() + key.slice(1)} <span>{counts[key]}</span>
              </button>
            ))}
          </div>
          {(error || notice) && (
            <p
              className={error ? "editor-error" : "editor-notice"}
              role={error ? "alert" : "status"}
            >
              {error || notice}
            </p>
          )}
          {visible.length === 0 ? (
            <p className="empty">Nothing here yet.</p>
          ) : (
            <ul className="editor-rows">
              {visible.map((release) => {
                const tier = bestTier(release);
                const name = `${release.products?.brands?.name ?? ""} ${release.products?.name ?? "Unnamed"}`;
                return (
                  <li
                    key={release.id}
                    className={draft.release_id === release.id ? "selected" : ""}
                  >
                    <div className="editor-row-main">
                      <strong>{name}</strong>
                      <small>
                        {release.products?.colorway ?? "Colorway TBC"} · {formatLaunch(release)} ·{" "}
                        {release.retail_price === null ? "Price TBC" : `$${release.retail_price}`}
                      </small>
                      <div className="editor-badges">
                        <span className={`editor-badge state-${release.editorial_status}`}>
                          {label(release.editorial_status)}
                        </span>
                        <span className="editor-badge">{label(release.status)}</span>
                        <span className={`editor-badge ${tier === null ? "warn" : ""}`}>
                          {tier === null ? "no source" : `best source: tier ${tier}`}
                        </span>
                        <span
                          className={`editor-badge ${release.retailer_launches.length ? "" : "warn"}`}
                        >
                          {release.retailer_launches.length} retailer link
                          {release.retailer_launches.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div className="editor-row-actions">
                      <button onClick={() => startEdit(release)} disabled={busy}>
                        Edit
                      </button>
                      {release.editorial_status !== "published" ? (
                        <button
                          onClick={() =>
                            void changeState(release, { editorialStatus: "published" })
                          }
                          disabled={busy}
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            void changeState(release, { editorialStatus: "needs_review" })
                          }
                          disabled={busy}
                        >
                          Unpublish
                        </button>
                      )}
                      {release.editorial_status !== "archived" && (
                        <button
                          onClick={() =>
                            void changeState(release, { editorialStatus: "archived" }, true)
                          }
                          disabled={busy}
                        >
                          Archive
                        </button>
                      )}
                      <label className="sr-only" htmlFor={`status-${release.id}`}>
                        Release status for {name}
                      </label>
                      <select
                        id={`status-${release.id}`}
                        value={release.status}
                        disabled={busy}
                        onChange={(event) =>
                          void changeState(release, { status: event.target.value })
                        }
                      >
                        {[...new Set([release.status, ...releaseStatuses])].map((status) => (
                          <option key={status} value={status}>
                            {label(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form
          id="editor-form"
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("published");
          }}
        >
          <p className="kicker">{editing ? "EDIT RELEASE" : "NEW RELEASE"}</p>
          <h2>
            {editing
              ? `${editingRelease?.products?.brands?.name ?? ""} ${draft.product_name}`
              : "Add a release"}
          </h2>

          <fieldset>
            <legend>Product</legend>
            <label>
              Brand
              <select
                value={draft.brand_slug}
                onChange={(event) => update("brand_slug", event.target.value)}
                disabled={editing}
                required
              >
                <option value="">Choose a brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.slug}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model name
              <input
                value={draft.product_name}
                onChange={(event) => update("product_name", event.target.value)}
                placeholder="Air Max 1 '86"
                required
              />
            </label>
            <div className="editor-pair">
              <label>
                Colorway
                <input
                  value={draft.colorway}
                  onChange={(event) => update("colorway", event.target.value)}
                  placeholder="Big Bubble Red"
                />
              </label>
              <label>
                Style code
                <input
                  value={draft.style_code}
                  onChange={(event) => update("style_code", event.target.value)}
                  placeholder="DQ3989-100"
                />
              </label>
            </div>
            <label>
              Image URL <small>Approved image only, https://</small>
              <input
                type="url"
                value={draft.image_url}
                onChange={(event) => update("image_url", event.target.value)}
                placeholder="https://"
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Launch</legend>
            <div className="editor-pair">
              <label>
                Date and time
                <input
                  type="datetime-local"
                  value={draft.launch_local}
                  onChange={(event) => update("launch_local", event.target.value)}
                />
              </label>
              <label>
                Timezone
                <select
                  value={draft.release_timezone}
                  onChange={(event) => update("release_timezone", event.target.value)}
                >
                  {[...new Set([draft.release_timezone, ...editorTimezones])].map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="editor-pair">
              <label>
                Retail price (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={draft.retail_price}
                  onChange={(event) => update("retail_price", event.target.value)}
                  placeholder="150"
                />
              </label>
              <label>
                Launch type
                <select
                  value={draft.launch_type}
                  onChange={(event) => update("launch_type", event.target.value)}
                >
                  {launchTypes.map((type) => (
                    <option key={type} value={type}>
                      {label(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Status
              <select
                value={draft.status}
                onChange={(event) => update("status", event.target.value)}
              >
                {releaseStatuses.map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
              <small>
                Use tentative until a brand or authorized retailer confirms it. Reminders only go
                out for confirmed releases.
              </small>
            </label>
          </fieldset>

          <fieldset>
            <legend>{editing ? "Add a source" : "Source"}</legend>
            {editingRelease && editingRelease.release_sources.length > 0 && (
              <ul className="editor-sources">
                {editingRelease.release_sources.map((link, index) =>
                  link.sources ? (
                    <li key={`${link.sources.url}-${index}`}>
                      Tier {link.sources.reliability_tier} · {link.sources.publisher} ·{" "}
                      <a href={link.sources.url} target="_blank" rel="noreferrer">
                        open ↗
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
            <label>
              Source type
              <select
                value={draft.source_type}
                onChange={(event) => update("source_type", event.target.value)}
              >
                {sourceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {sourceTier(draft.source_type) === 5 && (
                <small className="editor-warning">
                  Tier 5 sources can't be the only source for a published release.
                </small>
              )}
            </label>
            <div className="editor-pair">
              <label>
                Publisher
                <input
                  value={draft.source_publisher}
                  onChange={(event) => update("source_publisher", event.target.value)}
                  placeholder="Nike SNKRS"
                />
              </label>
              <label>
                Source URL
                <input
                  type="url"
                  value={draft.source_url}
                  onChange={(event) => update("source_url", event.target.value)}
                  placeholder="https://"
                />
              </label>
            </div>
            <small>Only add a source you opened and checked yourself.</small>
          </fieldset>

          <fieldset>
            <legend>Official retailer</legend>
            <div className="editor-pair">
              <label>
                Retailer
                <select
                  value={draft.retailer_id}
                  onChange={(event) => update("retailer_id", event.target.value)}
                >
                  <option value="">None yet</option>
                  {retailers.map((retailer) => (
                    <option key={retailer.id} value={retailer.id}>
                      {retailer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Product link
                <input
                  type="url"
                  value={draft.retailer_url}
                  onChange={(event) => update("retailer_url", event.target.value)}
                  placeholder="https://"
                />
              </label>
            </div>
          </fieldset>

          <label>
            Note for the audit log
            <textarea
              rows={2}
              value={draft.reason}
              onChange={(event) => update("reason", event.target.value)}
              placeholder="Checked the SNKRS calendar on Nov 13"
            />
          </label>

          {formError && (
            <p className="editor-error" role="alert">
              {formError}
            </p>
          )}
          <div className="editor-form-actions">
            <button type="submit" className="editor-primary" disabled={busy}>
              {busy
                ? "Saving…"
                : editingRelease?.editorial_status === "published"
                  ? "Save and keep live"
                  : "Publish"}
            </button>
            <button type="button" onClick={() => void submit("needs_review")} disabled={busy}>
              {editingRelease?.editorial_status === "published"
                ? "Unpublish and save draft"
                : "Save draft"}
            </button>
            {editing && (
              <button type="button" onClick={startNew} disabled={busy}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
