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

      <style>{`
        .match-history {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .match-history li {
          padding: 12px 14px;
          background: var(--surface);
          border-radius: var(--radius-md);
          border-left: 3px solid transparent;
        }
        .match-history li[data-result='win'] { border-left-color: var(--team-a); }
        .match-history li[data-result='loss'] { border-left-color: var(--danger); }
        .match-history__meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .match-history__badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .match-history__badge[data-result='win'] {
          background: rgba(94, 200, 194, 0.15);
          color: var(--team-a);
        }
        .match-history__badge[data-result='loss'] {
          background: rgba(226, 96, 79, 0.15);
          color: var(--danger);
        }
        .match-history__lineup {
          display: flex;
          gap: 10px;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .match-history__elo {
          font-size: 13px;
          color: var(--text);
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .match-history__delta {
          font-size: 12px;
          color: var(--danger);
        }
        .match-history__delta[data-positive] {
          color: var(--team-a);
        }
      `}</style>
    </ul>
  );
}
