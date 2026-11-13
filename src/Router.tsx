import { lazy, Suspense } from "react";
import App from "./App.tsx";
import { getRoute, type Route } from "./routes";
import { NotFoundPage, PrivacyPage, TermsPage } from "./StaticPage";
import { Unsubscribe } from "./Unsubscribe";

// Only editors need the editor bundle.
const Editor = lazy(() => import("./Editor").then((module) => ({ default: module.Editor })));

const titles: Partial<Record<Route, string>> = {
  privacy: "Privacy policy | Sneaker Signal",
  terms: "Terms of use | Sneaker Signal",
  "not-found": "Page not found | Sneaker Signal",
  notifications: "Notification settings | Sneaker Signal",
  editor: "Release desk | Sneaker Signal",
  unsubscribe: "Unsubscribe | Sneaker Signal",
};

export function Router({ pathname, search }: { pathname: string; search: string }) {
  const route = getRoute(pathname);
  if (titles[route]) document.title = titles[route];
  if (route === "privacy") return <PrivacyPage />;
  if (route === "terms") return <TermsPage />;
  if (route === "not-found") return <NotFoundPage />;
  if (route === "unsubscribe") return <Unsubscribe search={search} />;
  if (route === "editor")
    return (
      <Suspense fallback={<p className="empty">Loading editor…</p>}>
        <Editor />
      </Suspense>
    );
  return <App route={route} />;
}
