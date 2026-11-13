export type Route =
  "home" | "notifications" | "privacy" | "terms" | "editor" | "unsubscribe" | "not-found";

/** Paths the app serves. Hosting must rewrite all of them to index.html (see vercel.json). */
export const routePaths: Record<Exclude<Route, "not-found">, string> = {
  home: "/",
  notifications: "/settings/notifications",
  privacy: "/privacy",
  terms: "/terms",
  editor: "/editor",
  unsubscribe: "/unsubscribe",
};

export function getRoute(pathname: string): Route {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = (Object.entries(routePaths) as [Route, string][]).find(
    ([, path]) => path === normalized,
  );
  return match?.[0] ?? "not-found";
}

/** Optional public contact address, configured per deployment. */
export const contactEmail =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || null;

/**
 * Email delivery is switched on per deployment once Resend and the reminder
 * scheduler have passed the live-email gate. Until then the UI says so plainly.
 */
export const emailDeliveryLive = import.meta.env.VITE_EMAIL_DELIVERY_LIVE === "true";
