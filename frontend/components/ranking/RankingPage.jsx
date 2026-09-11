import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ELO_MAX, ELO_MIN } from '../../utils/elo.js';

export default function RankingPage({ players }) {
  const sorted = [...players].sort((a, b) => b.currentElo - a.currentElo);
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

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

  return (
    <div className="ranking">
      <h2>Ranking</h2>
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
    </div>
  );
}