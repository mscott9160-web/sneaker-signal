import { contactEmail, routePaths } from "./routes";

export function SiteFooter() {
  return (
    <footer>
      <a className="wordmark" href={routePaths.home}>
        <span>SNKR</span>
        <i>signal</i>
      </a>
      <span>US release intelligence · © {new Date().getFullYear()}</span>
      <nav className="footer-links" aria-label="Legal and contact">
        <a href={routePaths.privacy}>Privacy</a>
        <a href={routePaths.terms}>Terms</a>
        {contactEmail && <a href={`mailto:${contactEmail}`}>Contact</a>}
      </nav>
    </footer>
  );
}
