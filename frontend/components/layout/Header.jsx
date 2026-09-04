import React from 'react';

const TABS = [
  { id: 'match', label: 'Nuevo partido' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Historial' },
  { id: 'matches', label: 'Partidos' },
  { id: 'players', label: 'Jugadores' },
];

export default function Header({ active, onChange }) {
  return (
    <header className="header">
      <h1>
        Padel<span>itico</span>
      </h1>
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
        }
        .header nav button {
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          padding: 8px 14px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .header nav button[data-active] {
          background: var(--surface-raised);
          color: var(--accent);
        }
      `}</style>
    </header>
  );
}