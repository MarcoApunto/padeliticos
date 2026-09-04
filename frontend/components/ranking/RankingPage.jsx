import React from 'react';
import { ELO_MAX, ELO_MIN } from '../../utils/elo.js';

export default function RankingPage({ players }) {
  const sorted = [...players].sort((a, b) => b.currentElo - a.currentElo);

  return (
    <div className="ranking">
      <h2>Ranking</h2>
      <p className="text-muted">
        Elo acotado entre {ELO_MIN} y {ELO_MAX}, como los rangos de Playtomic.
      </p>
      <ol className="ranking__list">
        {sorted.map((p, i) => (
          <li key={p._id} className="ranking__row">
            <span className="ranking__pos numeric">{i + 1}</span>
            <span className="ranking__name">{p.name}</span>
            <div className="ranking__bar">
              <div
                className="ranking__bar-fill"
                style={{
                  width: `${((p.currentElo - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100}%`,
                }}
              />
            </div>
            <span className="ranking__elo numeric">{p.currentElo.toFixed(2)}</span>
          </li>
        ))}
      </ol>

      <style>{`
        .ranking h2 { margin-bottom: 4px; }
        .ranking > p { margin-bottom: 20px; font-size: 13px; }
        .ranking__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ranking__row {
          display: grid;
          grid-template-columns: 24px 1fr 120px 52px;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: var(--surface);
          border-radius: var(--radius-md);
        }
        .ranking__pos {
          color: var(--text-muted);
          font-size: 13px;
        }
        .ranking__name {
          font-size: 14px;
          font-weight: 500;
        }
        .ranking__bar {
          height: 6px;
          border-radius: 4px;
          background: var(--surface-raised);
          overflow: hidden;
        }
        .ranking__bar-fill {
          height: 100%;
          background: var(--accent);
        }
        .ranking__elo {
          text-align: right;
          color: var(--accent);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
