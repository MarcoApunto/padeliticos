import React from 'react';

export default function MatchHistoryList({ entries }) {
  const ordered = [...entries].reverse();

  if (ordered.length === 0) {
    return <p className="text-muted">Este jugador aún no ha jugado ningún partido.</p>;
  }

  return (
    <ul className="match-history">
      {ordered.map((entry) => {
        const { match } = entry;
        const delta = entry.eloAfter - entry.eloBefore;
        return (
          <li key={entry._id} data-result={match?.won ? 'win' : 'loss'}>
            <div className="match-history__meta">
              <span className="match-history__season">
                {match?.round?.season?.name || entry.season?.name}
                {match?.round ? ` · Ronda ${match.round.number}` : ''}
                {match?.number ? ` · Partido ${match.number}` : ''}
              </span>
              <span className="match-history__badge" data-result={match?.won ? 'win' : 'loss'}>
                {match?.won ? 'Victoria' : 'Derrota'}
              </span>
            </div>
            <div className="match-history__lineup">
              <span>
                Con <strong>{match?.partner?.name || '—'}</strong>
              </span>
              <span className="text-muted">
                vs {match?.opponents?.map((opponent) => opponent.name).join(' + ') || '—'}
              </span>
            </div>
            <div className="match-history__elo numeric">
              {entry.eloBefore.toFixed(2)} → {entry.eloAfter.toFixed(2)}
              <span className="match-history__delta" data-positive={delta >= 0 || undefined}>
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(2)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
