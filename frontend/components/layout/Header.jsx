import React from 'react';

const TABS = [
  { id: 'match', label: 'Nuevo partido' },
  { id: 'bets', label: 'Apuestas' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'matches', label: 'Partidos' },
  { id: 'history', label: 'Historial' },
  { id: 'players', label: 'Jugadores' },
];

export default function Header({ active, onChange, brand = 'Padeliticos', hideNavigation = false }) {
  return (
    <header className="header">
      <h1>
        {brand === 'Padeliticos' ? (
          <>Padel<span>iticos</span></>
        ) : brand === 'Super Padelitico' ? (
          <>Super <span>Padelitico</span></>
        ) : (
          <>Padelitico <span>Apuestas</span></>
        )}
      </h1>
      {!hideNavigation && (
        <nav>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-active={active === tab.id || undefined}
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