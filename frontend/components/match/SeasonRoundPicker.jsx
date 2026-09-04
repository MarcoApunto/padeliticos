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
    let cancelled = false;
    setRounds([]);
    setRoundId('');
    onRoundReady(null);
    setError(null);
    api
      .getRounds(seasonId)
      .then((data) => {
        if (cancelled) return;
        setRounds(data);
        setRoundId(data[0]?._id || '');
      })
      .catch((err) => {
        if (cancelled) return;
        setRounds([]);
        setRoundId('');
        onRoundReady(null);
        setError(err.message || 'No se pudieron cargar las rondas');
      });
    return () => {
      cancelled = true;
    };
  }, [seasonId, retryKey, onRoundReady]);

  useEffect(() => {
    if (!roundId) return onRoundReady(null);
    let cancelled = false;
    api
      .getMatches(roundId)
      .then((matches) => {
        if (cancelled) return;
        const round = rounds.find((r) => r._id === roundId);
        onRoundReady({
          ...round,
          matchCount: matches.length,
          kFactor: ELO_K_FACTOR,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        onRoundReady(null);
        setError(err.message || 'No se pudieron cargar los partidos');
      });
    return () => {
      cancelled = true;
    };
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
          <select
            value={seasonId}
            onChange={(event) => {
              setSeasonId(event.target.value);
              setRounds([]);
              setRoundId('');
              onRoundReady(null);
            }}
          >
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
    </div>
  );
}
