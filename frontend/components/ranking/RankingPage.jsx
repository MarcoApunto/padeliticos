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
    </div>
  );
}
