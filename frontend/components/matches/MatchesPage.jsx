import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function MatchesPage() {
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setError(null);
    api.getSeasons().then(setSeasons).catch((err) => {
      setError(err.message || 'No se pudieron cargar las temporadas');
    });
  }, [retryKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getAllMatches(seasonId ? { seasonId } : {})
      .then(setMatches)
      .catch((err) => {
        setMatches([]);
        setError(err.message || 'No se pudieron cargar los partidos');
      })
      .finally(() => setLoading(false));
  }, [seasonId, retryKey]);

  return (
    <div className="matches-page">
      <div className="matches-page__header">
        <h2>Partidos</h2>
        <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
          <option value="">Todas las temporadas</option>
          {seasons.map((season) => (
            <option key={season._id} value={season._id}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-muted">Cargando partidos…</p>}

      {!loading && error && (
        <div className="matches-page__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && matches.length === 0 && (
        <p className="text-muted">Todavía no se ha jugado ningún partido.</p>
      )}

      {!loading && !error && matches.length > 0 && (
        <ul className="matches-page__list">
          {matches.map((match) => (
            <MatchRow key={match._id} match={match} />
          ))}
        </ul>
      )}

      <style>{`
        .matches-page__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        .matches-page__header select {
          min-width: 0;
          background: var(--surface-raised);
          color: var(--text);
          border: 1px solid rgba(237, 235, 222, 0.15);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          font-size: 13px;
        }
        .matches-page__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .matches-page__error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: var(--surface);
          border: 1px solid var(--danger);
          border-radius: var(--radius-md);
          color: var(--danger);
        }
        .matches-page__error p { margin: 0; }
        .matches-page__error button {
          flex-shrink: 0;
          padding: 8px 12px;
          border: 1px solid var(--danger);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}

function MatchRow({ match }) {
  const seasonName = match.round?.season?.name;
  const played = match.playedAt
    ? new Date(match.playedAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      })
    : null;

  return (
    <li className="match-row">
      <div className="match-row__meta">
        <span>
          {seasonName ? `${seasonName} · ` : ''}Ronda {match.round?.number} · Partido {match.number}
        </span>
        {played && <span>{played}</span>}
      </div>

      <div className="match-row__teams">
        <TeamSide team={match.teamA} won={match.winner === 1} side="a" />
        <div className="match-row__vs">
          <span className="numeric">
            {Math.round((match.teamA.winProbability || 0) * 100)}% –{' '}
            {Math.round((match.teamB.winProbability || 0) * 100)}%
          </span>
        </div>
        <TeamSide team={match.teamB} won={match.winner === 2} side="b" />
      </div>

      <style>{`
        .match-row {
          padding: 14px 16px;
          background: var(--surface);
          border-radius: var(--radius-lg);
        }
        .match-row__meta {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 10px;
        }
        .match-row__teams {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
        }
        .match-row__vs {
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
        }
        @media (max-width: 560px) {
          .match-row__teams {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .match-row__vs {
            text-align: left;
          }
        }
      `}</style>
    </li>
  );
}

function TeamSide({ team, won, side }) {
  return (
    <div className="team-side" data-team={side} data-won={won || undefined}>
      <div className="team-side__names">
        {team.players.map((player) => player.name).join(' + ')}
        {won && <span className="team-side__crown">🏆</span>}
      </div>
      <div className="team-side__elos numeric">
        {team.players.map((player, index) => (
          <span key={player._id}>
            {team.eloBefore?.[index]?.toFixed(2)}
            {team.eloAfter ? ` → ${team.eloAfter[index].toFixed(2)}` : ''}
          </span>
        ))}
      </div>

      <style>{`
        .team-side {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 10px;
          border-radius: var(--radius-md);
          border: 1.5px solid transparent;
        }
        .team-side[data-team='a'] { border-color: var(--team-a-dim); }
        .team-side[data-team='b'] { border-color: var(--team-b-dim); }
        .team-side[data-won][data-team='a'] {
          border-color: var(--team-a);
          background: rgba(94, 200, 194, 0.08);
        }
        .team-side[data-won][data-team='b'] {
          border-color: var(--team-b);
          background: rgba(232, 147, 90, 0.08);
        }
        .team-side__names {
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .team-side__crown {
          font-size: 12px;
        }
        .team-side__elos {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
