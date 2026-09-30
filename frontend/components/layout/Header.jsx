import React, { useCallback, useEffect, useRef, useState } from 'react';

const TABS = [
  { id: 'match', label: 'Nuevo partido' },
  { id: 'bets', label: 'Apuestas' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'matches', label: 'Partidos' },
  { id: 'history', label: 'Historial' },
  { id: 'players', label: 'Jugadores' },
];

export default function Header({ active, onChange, brand = 'Padeliticos', hideNavigation = false }) {
  const [animationRun, setAnimationRun] = useState(0);
  const [ballStartX, setBallStartX] = useState('-5em');
  const pointerType = useRef(null);
  const brandRef = useRef(null);
  const logoORef = useRef(null);
  const loadAnimationStarted = useRef(false);

  const triggerLogoAnimation = useCallback(() => {
    const brandBounds = brandRef.current?.getBoundingClientRect();
    const oBounds = logoORef.current?.getBoundingClientRect();
    const ballBounds = logoORef.current?.querySelector('svg')?.getBoundingClientRect();
    if (brandBounds && oBounds && ballBounds) {
      const oCenter = oBounds.left + oBounds.width / 2;
      setBallStartX(`${brandBounds.left - oCenter - ballBounds.width / 2 - 4}px`);
    }
    setAnimationRun((run) => run + 1);
  }, []);

  useEffect(() => {
    if (loadAnimationStarted.current) return;
    loadAnimationStarted.current = true;
    triggerLogoAnimation();
  }, [triggerLogoAnimation]);

  return (
    <header className="header">
      <h1>
        <button
          type="button"
          className="header__brand"
          ref={brandRef}
          aria-label={`${brand}; animar logotipo`}
          onPointerDown={(event) => { pointerType.current = event.pointerType; }}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') triggerLogoAnimation();
          }}
          onClick={(event) => {
            if (pointerType.current === 'touch' || event.detail === 0) {
              triggerLogoAnimation();
            }
            pointerType.current = null;
          }}
        >
          {brand === 'Padeliticos' ? (
            <>Padel<span className="header__brand-accent">itic<LogoBallO ref={logoORef} animationRun={animationRun} ballStartX={ballStartX} />s</span></>
          ) : brand === 'Super Padelitico' ? (
            <>Super <span className="header__brand-accent">Padelitic<LogoBallO ref={logoORef} animationRun={animationRun} ballStartX={ballStartX} /></span></>
          ) : (
            <>Padelitic<LogoBallO ref={logoORef} animationRun={animationRun} ballStartX={ballStartX} /> <span className="header__brand-accent">Apuestas</span></>
          )}
        </button>
      </h1>
      {!hideNavigation && (
        <nav aria-label="Secciones principales">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-active={active === tab.id || undefined}
              aria-current={active === tab.id ? 'page' : undefined}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

const LogoBallO = React.forwardRef(function LogoBallO({ animationRun, ballStartX }, ref) {
  return (
    <span
      key={animationRun}
      ref={ref}
      className="header__logo-o"
      data-run={animationRun || undefined}
      style={animationRun ? { '--logo-ball-start-x': ballStartX } : undefined}
    >
      <span className="header__logo-letter">o</span>
      <svg
        className="header__logo-ball"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id="header-ball-clip">
            <circle cx="16" cy="16" r="15" />
          </clipPath>
        </defs>
        <circle cx="16" cy="16" r="15" fill="#93ad2c" />
        <g clipPath="url(#header-ball-clip)">
          <circle cx="14" cy="14" r="15" fill="#c6f135" />
          <path
            d="M25.5 3.2C26.2 10.7 18.7 14.6 12.6 18.7C7.8 22.1 8.5 28.3 11.9 32.4"
            stroke="#e2604f"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
});
