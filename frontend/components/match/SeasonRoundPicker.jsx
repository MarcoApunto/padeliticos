import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function SeasonRoundPicker({ onRoundReady }) {
  const [seasons, setSeasons] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [seasonId, setSeasonId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSeasons().then((data) => {
      setSeasons(data);
      if (data[0]) setSeasonId(data[0]._id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!seasonId) return;
    api.getRounds(seasonId).then((data) => {
      setRounds(data);
      setRoundId(data[0]?._id || '');
    });
  }, [seasonId]);

  useEffect(() => {
    if (!roundId) return onRoundReady(null);
    api.getMatches(roundId).then((matches) => {
      const round = rounds.find((r) => r._id === roundId);
      const season = seasons.find((s) => s._id === seasonId);
      onRoundReady({
        ...round,
        matchCount: matches.length,
        kFactor: season?.kFactor ?? 0.5,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  async function createSeason() {
    const name = prompt('Nombre de la nueva temporada (p. ej. "Semana 4")');
    if (!name) return;
    const season = await api.createSeason({ name });
    setSeasons((prev) => [season, ...prev]);
    setSeasonId(season._id);
  }

  async function createRound() {
    if (!seasonId) return;
    const number = rounds.length + 1;
    const round = await api.createRound(seasonId, { number });
    setRounds((prev) => [...prev, round]);
    setRoundId(round._id);
  }

  if (loading) return <p className="text-muted">Cargando temporadas…</p>;

  return (
    <div className="picker">
      <div className="picker__group">
        <label>Temporada</label>
        <div className="picker__row">
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            {seasons.length === 0 && <option value="">Sin temporadas</option>}
            {seasons.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={createSeason}>
            + Nueva
          </button>
        </div>
      </div>

      <div className="picker__group">
        <label>Ronda</label>
        <div className="picker__row">
          <select value={roundId} onChange={(e) => setRoundId(e.target.value)}>
            {rounds.length === 0 && <option value="">Sin rondas</option>}
            {rounds.map((r) => (
              <option key={r._id} value={r._id}>
                Ronda {r.number}
              </option>
            ))}
          </select>
          <button type="button" onClick={createRound} disabled={!seasonId}>
            + Nueva
          </button>
        </div>
      </div>

      <style>{`
        .picker {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .picker__group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .picker__group label {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.03em;
        }
        .picker__row {
          display: flex;
          gap: 8px;
        }
        .picker select {
          background: var(--surface-raised);
          color: var(--text);
          border: 1px solid rgba(237, 235, 222, 0.15);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          font-size: 13px;
        }
        .picker button {
          background: transparent;
          border: 1px solid rgba(237, 235, 222, 0.2);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 12px;
          padding: 8px 10px;
        }
        .picker button:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}
