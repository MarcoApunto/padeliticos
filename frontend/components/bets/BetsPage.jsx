import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

// Clave de pareja igual que el backend (matchStatsService): ids ordenados + '|'.
function pairKey(players) {
  return players.map((p) => String(p._id)).sort().join('|');
}

// Cuota = 1 / probabilidad. Con probabilidad nula o ínfima se muestra '∞'.
function cuota(probability) {
  if (!probability || probability <= 0) return '∞';
  const value = 1 / probability;
  return value >= 100 ? '∞' : value.toFixed(2);
}

// Tablero de apuestas: todos los partidos SIN resultado de la temporada en
// curso, con la cuota (1 / probabilidad de victoria por Elo), la media de Elo
// de cada equipo y el histórico V/D de esa pareja concreta en partidos jugados.
export default function BetsPage() {
  const [matches, setMatches] = useState([]);
  const [pairStats, setPairStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.getPendingMatches(), api.getPairStats()])
      .then(([pending, stats]) => {
        setMatches(pending);
        setPairStats(stats);
      })
      .catch((err) =>
        setError(err.message || 'No se pudieron cargar los partidos')
      )
      .finally(() => setLoading(false));
  }, [retryKey]);

  if (loading) return <p className="text-muted">Cargando apuestas…</p>;

  if (error) {
    return (
      <div className="bets-page__error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bets-page">
      <h2>Apuestas</h2>
      <p className="text-muted">
        Cuota según la probabilidad de victoria por Elo (base fija de
        pretemporada). A menor cuota, más favorito.
      </p>

      {matches.length === 0 ? (
        <p className="text-muted">No hay partidos pendientes para apostar.</p>
      ) : (
        <ul className="bets-page__list">
          {matches.map((match) => (
            <BetRow key={match._id} match={match} pairStats={pairStats} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BetRow({ match, pairStats }) {
  const favA = (match.teamA.winProbability || 0) >= (match.teamB.winProbability || 0);

  return (
    <li className="bet-row">
      <div className="bet-row__meta">
        {match.round?.season?.name && <span>{match.round.season.name}</span>}
        {match.round?.number != null && <span>Ronda {match.round.number}</span>}
        <span>Partido {match.number}</span>
      </div>
      <div className="bet-row__board">
        <BetSide
          team={match.teamA}
          cuota={cuota(match.teamA.winProbability)}
          favorite={favA}
          record={pairStats[pairKey(match.teamA.players)]}
          teamKey="a"
        />
        <span className="bet-row__vs">vs</span>
        <BetSide
          team={match.teamB}
          cuota={cuota(match.teamB.winProbability)}
          favorite={!favA}
          record={pairStats[pairKey(match.teamB.players)]}
          teamKey="b"
        />
      </div>
    </li>
  );
}

function BetSide({ team, cuota, favorite, record, teamKey }) {
  return (
    <div className="bet-side" data-team={teamKey} data-favorite={favorite || undefined}>
      <div className="bet-side__line">
        <span className="bet-side__name">
          {team.players.map((player) => player.name).join(' + ')}
        </span>
        <span className="bet-side__cuota numeric">{cuota}</span>
      </div>
      <div className="bet-side__meta numeric">
        <span>Elo medio {team.avgElo?.toFixed(2) ?? '—'}</span>
        {record ? (
          <span>
            {record.wins}V · {record.losses}D
          </span>
        ) : (
          <span className="text-muted">Sin historial</span>
        )}
      </div>
    </div>
  );
}