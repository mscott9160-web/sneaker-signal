import App from "./App.tsx";
import { getRoute, type Route } from "./routes";
import { NotFoundPage, PrivacyPage, TermsPage } from "./StaticPage";

const titles: Partial<Record<Route, string>> = {
  privacy: "Privacy policy | Sneaker Signal",
  terms: "Terms of use | Sneaker Signal",
  "not-found": "Page not found | Sneaker Signal",
  notifications: "Notification settings | Sneaker Signal",
};

export function Router({ pathname }: { pathname: string }) {
  const route = getRoute(pathname);
  if (titles[route]) document.title = titles[route];
  if (route === "privacy") return <PrivacyPage />;
  if (route === "terms") return <TermsPage />;
  if (route === "not-found") return <NotFoundPage />;
  return <App route={route} />;
}
