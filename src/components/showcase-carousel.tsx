"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface GalleryCard {
  id: string;
  label: string;
  gradient: string;
  renderArt: () => React.ReactNode;
}

const CARDS: GalleryCard[] = [
  {
    id: "coastal-cliff",
    label: "Coastal overlooking sea",
    gradient: "linear-gradient(165deg, #1b3644 0%, #3a5d6c 42%, #8e6b4f 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <defs>
          <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3c4c" />
            <stop offset="55%" stopColor="#2f5666" />
            <stop offset="100%" stopColor="#587b86" />
          </linearGradient>
          <linearGradient id="rockGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a77d56" />
            <stop offset="55%" stopColor="#775236" />
            <stop offset="100%" stopColor="#422c1d" />
          </linearGradient>
        </defs>
        <rect width="320" height="420" fill="url(#seaGrad)" />
        <path d="M0 70 Q90 62 180 74 T320 66" stroke="#85a6b1" strokeOpacity="0.28" strokeWidth="1.5" fill="none" />
        <path d="M0 115 Q120 105 220 118 T320 112" stroke="#a6c3cb" strokeOpacity="0.22" strokeWidth="1.2" fill="none" />
        <path d="M0 165 Q100 158 210 170 T320 162" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.5" fill="none" />
        <path d="M-10 175 L88 122 L174 195 L235 288 L268 425 L-10 425 Z" fill="url(#rockGrad)" />
        <path d="M18 220 L95 162 L154 225 L195 335 L110 425 L-10 425 Z" fill="#5d3f28" opacity="0.72" />
        <circle cx="94" cy="112" r="9" fill="#d9c6b0" />
        <path d="M84 123 Q95 119 105 130 L101 152 L83 148 Z" fill="#f4ede2" />
      </svg>
    ),
  },
  {
    id: "botanical-studio",
    label: "Botanical studio portrait",
    gradient: "linear-gradient(155deg, #efe4d6 0%, #d9baa0 55%, #b68466 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <defs>
          <radialGradient id="skinGlow" cx="52%" cy="56%" r="55%">
            <stop offset="0%" stopColor="#f3d2bc" />
            <stop offset="65%" stopColor="#d99f7d" />
            <stop offset="100%" stopColor="#9c6449" />
          </radialGradient>
        </defs>
        <rect width="320" height="420" fill="#ebe0d2" />
        <rect x="0" y="0" width="320" height="145" fill="#d8c3ad" opacity="0.65" />
        <ellipse cx="164" cy="242" rx="108" ry="86" fill="url(#skinGlow)" />
        <path d="M55 286 Q165 360 278 270 L320 420 L0 420 Z" fill="#231a16" />
        <ellipse cx="176" cy="238" rx="46" ry="28" fill="#ffffff" opacity="0.72" transform="rotate(-12 176 238)" />
        <path d="M40 245 Q96 244 134 236" stroke="#f07e4a" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M0 248 L62 246" stroke="#644938" strokeWidth="6" strokeLinecap="round" />
        <path d="M120 40 Q145 105 112 135 Q138 112 172 126" stroke="#5b3d2b" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.45" />
      </svg>
    ),
  },
  {
    id: "citrus-flatlay",
    label: "Citrus table arrangement",
    gradient: "linear-gradient(170deg, #f3efe7 0%, #dfdad0 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <rect width="320" height="420" fill="#ede9df" />
        <path d="M175 0 L320 0 L320 420 L110 420 Q135 220 175 0 Z" fill="#faf8f3" />
        <circle cx="132" cy="112" r="88" fill="#c79558" />
        <circle cx="132" cy="112" r="78" fill="#b37e42" />
        <circle cx="110" cy="88" r="34" fill="#df5a2c" />
        <circle cx="110" cy="88" r="28" fill="#f37b4b" />
        <circle cx="164" cy="108" r="32" fill="#d94923" />
        <circle cx="164" cy="108" r="26" fill="#eb6c44" />
        <circle cx="128" cy="144" r="31" fill="#df582b" />
        <circle cx="128" cy="144" r="25" fill="#f27d52" />
        <ellipse cx="222" cy="272" rx="34" ry="29" fill="#ecd248" />
        <ellipse cx="92" cy="296" rx="28" ry="25" fill="#e6c83d" />
        <circle cx="188" cy="346" r="19" fill="#5e7634" />
        <circle cx="268" cy="118" r="21" fill="#637b37" />
      </svg>
    ),
  },
  {
    id: "studio-coffee",
    label: "Guest coffee moment",
    gradient: "linear-gradient(180deg, #dfd7cd 0%, #c6bcb0 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <rect width="320" height="420" fill="#e4ddd4" />
        <rect x="0" y="0" width="128" height="420" fill="#d4ccc1" />
        <path d="M58 420 L86 242 Q105 198 168 198 Q232 198 256 246 L278 420 Z" fill="#1b1d22" />
        <ellipse cx="166" cy="134" rx="52" ry="64" fill="#d8a27e" />
        <path d="M108 130 Q110 56 168 56 Q226 56 226 138 Q226 196 206 218 L196 170 Q204 114 166 102 Q128 112 132 174 L118 206 Q108 172 108 130 Z" fill="#18191d" />
        <path d="M142 132 Q152 128 160 132" stroke="#2c221d" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M178 132 Q188 128 196 132" stroke="#2c221d" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="62" cy="238" r="46" fill="#f7f5f0" stroke="#c8bfb4" strokeWidth="3" />
        <circle cx="62" cy="238" r="32" fill="#e7e1d6" />
        <ellipse cx="170" cy="368" rx="68" ry="34" fill="#354b62" />
        <ellipse cx="170" cy="356" rx="58" ry="22" fill="#efe6c9" />
      </svg>
    ),
  },
  {
    id: "dusk-road",
    label: "Evening transit frame",
    gradient: "linear-gradient(180deg, #b8cce0 0%, #6d859c 48%, #2e3b49 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <defs>
          <linearGradient id="skyMist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c5d7e8" />
            <stop offset="52%" stopColor="#9ab1c6" />
            <stop offset="100%" stopColor="#4c5c6c" />
          </linearGradient>
        </defs>
        <rect width="320" height="420" fill="url(#skyMist)" />
        <path d="M0 245 L320 218 L320 420 L0 420 Z" fill="#2d3844" />
        <path d="M110 236 L142 420 L215 420 L185 232 Z" fill="#3b4856" />
        <path d="M40 240 Q120 110 215 112" stroke="#62788e" strokeWidth="2.5" fill="none" />
        <path d="M22 420 Q72 200 138 148" stroke="#4f6377" strokeWidth="3" fill="none" />
        <rect x="132" y="218" width="54" height="86" rx="18" fill="#171e25" />
        <circle cx="159" cy="198" r="17" fill="#1d252e" />
        <circle cx="159" cy="278" r="14" fill="#fff5d1" />
        <circle cx="159" cy="278" r="24" fill="#fff5d1" opacity="0.28" />
        <circle cx="52" cy="264" r="8" fill="#ffd9a0" opacity="0.75" />
        <circle cx="282" cy="254" r="9" fill="#ffe6b5" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: "artisan-juice",
    label: "Hospitality prep table",
    gradient: "linear-gradient(160deg, #cdb294 0%, #8c6c4d 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <rect width="320" height="420" fill="#b79672" />
        <rect x="0" y="0" width="320" height="175" fill="#d9cab8" opacity="0.55" />
        <path d="M0 165 Q160 152 320 178 L320 420 L0 420 Z" fill="#a88159" />
        <circle cx="96" cy="272" r="26" fill="#eb7c28" />
        <circle cx="136" cy="296" r="28" fill="#f28c2f" />
        <circle cx="146" cy="252" r="24" fill="#e26e20" />
        <ellipse cx="204" cy="182" rx="64" ry="42" fill="#f7f4ee" opacity="0.88" />
        <path d="M148 182 Q204 245 256 182 Z" fill="#f2a23a" opacity="0.78" />
        <rect x="206" y="254" width="66" height="96" rx="14" fill="#ffffff" opacity="0.52" />
        <rect x="212" y="294" width="54" height="50" rx="8" fill="#f09832" opacity="0.85" />
        <path d="M62 44 Q124 88 166 144" stroke="#f0d7c3" strokeWidth="32" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "pavilion-evening",
    label: "Evening pavilion lounge",
    gradient: "linear-gradient(160deg, #27322d 0%, #141a17 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <rect width="320" height="420" fill="#1e2421" />
        <rect x="42" y="48" width="106" height="240" fill="#3b3126" />
        <rect x="172" y="48" width="106" height="240" fill="#2e2720" />
        <circle cx="95" cy="138" r="36" fill="#e9b86b" opacity="0.82" />
        <circle cx="225" cy="138" r="32" fill="#d9ef63" opacity="0.32" />
        <rect x="0" y="308" width="320" height="112" fill="#121614" />
        <path d="M52 346 L268 346" stroke="#6f6659" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "ceramics-display",
    label: "Editorial table ceramics",
    gradient: "linear-gradient(170deg, #f1ede4 0%, #cfc6b8 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <rect width="320" height="420" fill="#e9e3d8" />
        <rect x="0" y="275" width="320" height="145" fill="#d8cfc0" />
        <path d="M98 158 Q160 144 222 158 L242 292 Q160 314 78 292 Z" fill="#f7f4ec" />
        <ellipse cx="160" cy="158" rx="62" ry="16" fill="#dfd7c8" />
        <path d="M158 156 Q142 82 118 42" stroke="#365947" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M162 156 Q186 78 214 52" stroke="#456b56" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="118" cy="42" r="14" fill="#527b63" />
        <circle cx="214" cy="52" r="12" fill="#689275" />
      </svg>
    ),
  },
  {
    id: "architectural-arch",
    label: "Sunlit courtyard colonnade",
    gradient: "linear-gradient(175deg, #dce6d3 0%, #9db39f 100%)",
    renderArt: () => (
      <svg viewBox="0 0 320 420" preserveAspectRatio="xMidYMid slice" className="curved-card-art" aria-hidden="true">
        <rect width="320" height="420" fill="#e4eadf" />
        <path d="M62 420 L62 170 A98 98 0 0 1 258 170 L258 420 Z" fill="#183c34" />
        <path d="M96 420 L96 184 A64 64 0 0 1 224 184 L224 420 Z" fill="#dce6d3" />
        <rect x="0" y="340" width="320" height="80" fill="#c7d3c2" opacity="0.7" />
        <circle cx="160" cy="212" r="36" fill="#d9ef63" opacity="0.88" />
      </svg>
    ),
  },
];

export function ShowcaseCarousel() {
  const [activeIndex, setActiveIndex] = useState(4);
  const [isPaused, setIsPaused] = useState(false);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused) {
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % CARDS.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const stepBy = (delta: number) => {
    setActiveIndex((current) => (current + delta + CARDS.length) % CARDS.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepBy(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepBy(1);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartX.current = event.clientX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) {
      return;
    }
    const delta = event.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) > 40) {
      stepBy(delta < 0 ? 1 : -1);
    }
  };

  return (
    <div
      className="curved-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Potokuadrat visual showcase"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="curved-carousel-track">
        {CARDS.map((card, index) => {
          let offset = (index - activeIndex + CARDS.length) % CARDS.length;
          if (offset > Math.floor(CARDS.length / 2)) {
            offset -= CARDS.length;
          }
          const isVisible = Math.abs(offset) <= 3;

          return (
            <button
              key={card.id}
              type="button"
              className="curved-card"
              data-offset={offset}
              aria-label={card.label}
              aria-hidden={!isVisible}
              tabIndex={isVisible ? 0 : -1}
              style={{ background: card.gradient }}
              onClick={() => setActiveIndex(index)}
            >
              {card.renderArt()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
