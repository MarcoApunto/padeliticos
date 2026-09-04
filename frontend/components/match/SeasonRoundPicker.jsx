import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ELO_K_FACTOR } from '../../utils/elo.js';

export default function SeasonRoundPicker({ onRoundReady }) {
  const [seasons, setSeasons] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [seasonId, setSeasonId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [savingSeason, setSavingSeason] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getSeasons()
      .then((data) => {
        setSeasons(data);
        if (data[0]) setSeasonId(data[0]._id);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar las temporadas'))
      .finally(() => setLoading(false));
  }, [retryKey]);

  useEffect(() => {
    if (!seasonId) return;
    setError(null);
    api
      .getRounds(seasonId)
      .then((data) => {
        setRounds(data);
        setRoundId(data[0]?._id || '');
      })
      .catch((err) => {
        setRounds([]);
        setRoundId('');
        onRoundReady(null);
        setError(err.message || 'No se pudieron cargar las rondas');
      });
  }, [seasonId, retryKey, onRoundReady]);

  useEffect(() => {
    if (!roundId) return onRoundReady(null);
    api
      .getMatches(roundId)
      .then((matches) => {
        const round = rounds.find((r) => r._id === roundId);
        onRoundReady({
          ...round,
          matchCount: matches.length,
          kFactor: ELO_K_FACTOR,
        });
      })
      .catch((err) => {
        onRoundReady(null);
        setError(err.message || 'No se pudieron cargar los partidos');
      });
  }, [roundId, retryKey, rounds, seasons, seasonId, onRoundReady]);

  async function createSeason() {
    const name = newSeasonName.trim();
    if (!name) return;
    setSavingSeason(true);
    setError(null);
    try {
      const season = await api.createSeason({ name });
      setSeasons((prev) => [season, ...prev]);
      setSeasonId(season._id);
      setNewSeasonName('');
      setCreatingSeason(false);
      setNotice(`Temporada "${season.name}" creada correctamente.`);
    } catch (err) {
      setError(err.message || 'No se pudo crear la temporada');
    } finally {
      setSavingSeason(false);
    }
  }

  async function createRound() {
    if (!seasonId) return;
    const number = rounds.length + 1;
    try {
      const round = await api.createRound(seasonId, { number });
      setRounds((prev) => [...prev, round]);
      setRoundId(round._id);
      setError(null);
      setNotice(`Ronda ${round.number} creada correctamente.`);
    } catch (err) {
      setError(err.message || 'No se pudo crear la ronda');
    }
  }

  if (loading) return <p className="text-muted">Cargando temporadas…</p>;

  if (error) {
    return (
      <div className="picker-error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="picker">
      {notice && (
        <div className="picker-notice" role="status">
          <div>
            <strong>Guardado correcto</strong>
            <span>{notice}</span>
          </div>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
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
          {!creatingSeason && (
            <button type="button" onClick={() => setCreatingSeason(true)}>
              + Nueva
            </button>
          )}
          {creatingSeason && (
            <form
              className="picker__new-form"
              onSubmit={(event) => {
                event.preventDefault();
                createSeason();
              }}
            >
              <input
                autoFocus
                aria-label="Nombre de la nueva temporada"
                placeholder="Ej. Semana 4"
                value={newSeasonName}
                onChange={(event) => setNewSeasonName(event.target.value)}
              />
              <button type="submit" disabled={!newSeasonName.trim() || savingSeason}>
                {savingSeason ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingSeason(false);
                  setNewSeasonName('');
                }}
              >
                Cancelar
              </button>
            </form>
          )}
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
          flex: 1;
          min-width: 160px;
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
          flex: 1;
          min-width: 0;
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
        .picker__new-form {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .picker__new-form input {
          width: 140px;
          min-width: 0;
          background: var(--surface-raised);
          color: var(--text);
          border: 1px solid rgba(237, 235, 222, 0.15);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          font-size: 13px;
        }
        .picker__new-form button[type='submit'] {
          border-color: var(--accent);
          color: var(--accent);
        }
        .picker__new-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .picker-notice {
          position: fixed;
          z-index: 10;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: min(360px, calc(100vw - 28px));
          padding: 14px 16px;
          background: var(--surface-raised);
          border: 1px solid var(--team-a);
          border-radius: var(--radius-md);
          color: var(--text);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }
        .picker-notice div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .picker-notice strong { color: var(--team-a); font-size: 13px; }
        .picker-notice span { font-size: 12px; }
        .picker-notice button {
          margin-left: auto;
          padding: 4px 8px;
          border: none;
          color: var(--text-muted);
          font-size: 18px;
          line-height: 1;
        }
        @media (max-width: 480px) {
          .picker {
            flex-direction: column;
            gap: 14px;
          }
          .picker__group {
            min-width: 0;
          }
        }
        .picker-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
          padding: 14px 16px;
          background: var(--surface);
          border: 1px solid var(--danger);
          border-radius: var(--radius-md);
          color: var(--danger);
        }
        .picker-error p { margin: 0; }
        .picker-error button {
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
