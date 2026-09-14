import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ELO_MAX, ELO_MIN } from '../../utils/elo.js';

export default function RankingPage({ players }) {
  const [view, setView] = useState('individual');
  const [stats, setStats] = useState({});
  const [pairStats, setPairStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

  const sorted = [...players].sort((a, b) => b.currentElo - a.currentElo);

  useEffect(() => {
    if (players.length === 0) {
      setStats({});
      return undefined;
    }
    let cancelled = false;
    setLoadingStats(true);
    api
      .getPlayerStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // Si falla, el ranking se muestra igualmente sin estadísticas.
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false);
      });
    return () => {
      cancelled = true;
    };
  }, [players]);

  // El ranking de DOBLES solo muestra parejas que han jugado alguna vez juntas:
  // se alimenta de /matches/pair-stats, que agrupa partidos ya jugados por pareja.
  useEffect(() => {
    if (view !== 'doubles') return;
    let cancelled = false;
    api
      .getPairStats()
      .then((data) => {
        if (!cancelled) setPairStats(data);
      })
      .catch(() => {
        // Si falla, se deja la lista vacía de parejas.
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const playersById = Object.fromEntries(players.map((p) => [p._id, p]));

  const pairs = Object.entries(pairStats)
    .map(([key, record]) => {
      const [idA, idB] = key.split('|');
      const playerA = playersById[idA];
      const playerB = playersById[idB];
      if (!playerA || !playerB) return null;
      const avgElo = (playerA.currentElo + playerB.currentElo) / 2;
      // Mostramos primero al de mayor elo, da igual el orden de la clave.
      const [first, second] =
        playerA.currentElo >= playerB.currentElo
          ? [playerA, playerB]
          : [playerB, playerA];
      return {
        key,
        name: `${first.name} + ${second.name}`,
        avgElo,
        record,
        inactive: !playerA.active || !playerB.active,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.avgElo - a.avgElo);

  return (
    <div className="ranking">
      <div className="ranking__header">
        <h2>Ranking</h2>
        <select
          value={view}
          onChange={(event) => setView(event.target.value)}
          aria-label="Tipo de ranking"
        >
          <option value="individual">Elo individual</option>
          <option value="doubles">Elo dobles</option>
        </select>
      </div>

      {view === 'individual' ? (
        <>
          <p className="text-muted">
            Elo acotado entre {ELO_MIN} y {ELO_MAX}, como los rangos de Playtomic.
          </p>
          <ol className="ranking__list">
            {sorted.map((p, i) => {
              const summary = stats[p._id];
              return (
                <li key={p._id} className="ranking__row">
                  <div className="ranking__line">
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
                  </div>
                  {summary && (
                    <span className="ranking__stats numeric">
                      {summary.played} partidos · {summary.wins}V {summary.losses}D
                      {summary.streak > 1 && (
                        <>
                          {' · '}
                          <span
                            className="ranking__streak"
                            data-direction={summary.streakType ? 'win' : 'loss'}
                          >
                            racha {summary.streak}
                            {summary.streakType ? 'V' : 'D'}
                          </span>
                        </>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {loadingStats && <p className="text-muted">Cargando estadísticas…</p>}
        </>
      ) : (
        <>
          <p className="text-muted">
            Parejas que han jugado alguna vez juntas, ordenadas por el Elo medio
            de sus dos jugadores.
          </p>
          {pairs.length === 0 ? (
            <p className="text-muted">
              Todavía no hay ninguna pareja que haya jugado un partido.
            </p>
          ) : (
            <ol className="ranking__list">
              {pairs.map((pair, i) => (
                <li
                  key={pair.key}
                  className="ranking__row"
                  data-inactive={pair.inactive || undefined}
                >
                  <div className="ranking__line">
                    <span className="ranking__pos numeric">{i + 1}</span>
                    <span className="ranking__name">{pair.name}</span>
                    <div className="ranking__bar">
                      <div
                        className="ranking__bar-fill"
                        style={{
                          width: `${((pair.avgElo - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="ranking__elo numeric">{pair.avgElo.toFixed(2)}</span>
                  </div>
                  <span className="ranking__stats numeric">
                    {pair.record.played} partidos · {pair.record.wins}V {pair.record.losses}D
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}