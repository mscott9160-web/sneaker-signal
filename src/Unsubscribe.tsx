import { useState } from "react";
import { SiteFooter } from "./SiteFooter";
import { routePaths } from "./routes";
import { unsubscribeWithToken } from "./supabase-client";

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type State = "ready" | "working" | "done" | "not-found" | "error";

/**
 * Landing page for the unsubscribe link in every email. It needs no sign-in, but it
 * asks for one click instead of unsubscribing on page load: email security scanners
 * open every link in a message, and that must not unsubscribe anyone.
 */
export function Unsubscribe({ search }: { search: string }) {
  const token = new URLSearchParams(search).get("token");
  const validToken = token !== null && tokenPattern.test(token);
  const [state, setState] = useState<State>("ready");

  const confirm = async () => {
    if (!validToken) return;
    setState("working");
    const result = await unsubscribeWithToken(token);
    setState(result.error ? "error" : result.found ? "done" : "not-found");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href={routePaths.home}>
          <span>SNKR</span>
          <i>signal</i>
        </a>
        <a className="back-link" href={routePaths.home}>
          ← Back to releases
        </a>
      </header>
      <section className="static-page unsubscribe-page" aria-live="polite">
        <p className="kicker">EMAIL PREFERENCES</p>
        {!validToken ? (
          <>
            <h1>This unsubscribe link isn't valid</h1>
            <p>
              It may have been cut off when it was copied. Open the link from the email again, or
              sign in to <a href={routePaths.notifications}>notification settings</a> to turn off
              email.
            </p>
          </>
        ) : state === "done" ? (
          <>
            <h1>You're unsubscribed</h1>
            <p>
              We won't send you any more Sneaker Signal emails, including reminders. Your saved
              releases are still there.
            </p>
            <p>
              Changed your mind? Turn emails back on in{" "}
              <a href={routePaths.notifications}>notification settings</a>.
            </p>
          </>
        ) : state === "not-found" ? (
          <>
            <h1>We couldn't find that subscription</h1>
            <p>
              The account may have been deleted. If you're still getting emails, sign in to{" "}
              <a href={routePaths.notifications}>notification settings</a> to turn them off.
            </p>
          </>
        ) : (
          <>
            <h1>Unsubscribe from Sneaker Signal emails?</h1>
            <p>
              This turns off every email we send you: release reminders, the digest and restock
              alerts.
            </p>
            <button
              className="unsubscribe-confirm"
              onClick={() => void confirm()}
              disabled={state === "working"}
            >
              {state === "working" ? "Unsubscribing…" : "Unsubscribe"}
            </button>
            {state === "error" && (
              <p className="editor-error" role="alert">
                Something went wrong and you're still subscribed. Please try again in a minute.
              </p>
            )}
            <p className="static-updated">
              Want fewer emails instead of none? Use{" "}
              <a href={routePaths.notifications}>notification settings</a>.
            </p>
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
