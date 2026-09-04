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
    </div>
  );
}
