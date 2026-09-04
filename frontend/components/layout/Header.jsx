import React from 'react';

const TABS = [
  { id: 'match', label: 'Nuevo partido' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'matches', label: 'Partidos' },
  { id: 'history', label: 'Historial' },
  { id: 'players', label: 'Jugadores' },
];

export default function Header({ active, onChange, brand = 'Padeliticos', hideNavigation = false }) {
  return (
    <header className="header">
      <h1>
        {brand}
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

      <style>{`
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          padding-bottom: 24px;
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(237, 235, 222, 0.1);
        }
        .header h1 {
          font-size: 22px;
          font-weight: 700;
        }
        .header h1 span {
          color: var(--accent);
        }
        .header nav {
          display: flex;
          gap: 6px;
          max-width: 100%;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .header nav::-webkit-scrollbar {
          display: none;
        }
        .header nav button {
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          padding: 8px 14px;
          font-size: 13px;
          color: var(--text-muted);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .header nav button[data-active] {
          background: var(--surface-raised);
          color: var(--accent);
        }
        @media (max-width: 480px) {
          .header {
            gap: 12px;
            padding-bottom: 16px;
            margin-bottom: 16px;
          }
          .header nav {
            width: 100%;
          }
          .header nav button {
            padding: 7px 10px;
            font-size: 12px;
          }
        }
      `}</style>
    </header>
  );
}