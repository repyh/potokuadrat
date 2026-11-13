import Link from "next/link";
import config from "../../config.json";
import type { CSSProperties } from "react";
import { ShowcaseCarousel } from "@/components/showcase-carousel";

const brandStyle = {
  "--brand-accent": config.brand.accent,
  "--brand-ink": config.brand.ink,
  "--brand-paper": config.brand.paper,
  "--brand-surface": config.brand.surface,
} as CSSProperties;

export default function Home() {
  return (
    <main className="folio-frame" style={brandStyle}>
      <header className="site-navbar">
        <div className="navbar-inner">
          <a className="navbar-brand" href="#top" aria-label={`${config.eventName} home`}>
            <span className="brand-stamp" aria-hidden="true">P</span>
            <span>{config.eventName}</span>
          </a>

          <a href="#login" className="navbar-login-btn">
            Log in
          </a>
        </div>
      </header>

      <div className="folio-page" id="top">
        <section className="welcome-spread" id="organizer" aria-labelledby="welcome-heading">
          <div className="welcome-copy">
            <h1 id="welcome-heading">{config.eventName}</h1>
            <p className="hero-tagline">{config.tagline}</p>
            <p>{config.description}</p>
            <div className="hero-cta-group">
              <Link className="primary-action" href="/showcase">
                Explore showcase
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M4 10h11M10 5l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
            <span className="welcome-footnote">{config.organizerSummary}</span>
          </div>
        </section>

        <section className="showcase-section" id="showcase" aria-label="Featured gallery">
          <ShowcaseCarousel />
        </section>

        <footer className="page-footer">
          <span>{config.eventName}</span>
          <span>Prepared for guests and clients</span>
          <a href="#top">Back to the beginning</a>
        </footer>
      </div>
    </main>
  );
}
