import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ELO_K_FACTOR } from '../../utils/elo.js';

export default function AdminPage({ players, onPlayersChange, onClose }) {
  const [keyInput, setKeyInput] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [roundId, setRoundId] = useState('');
  const [matches, setMatches] = useState([]);
  const [matchDrafts, setMatchDrafts] = useState({});
  const [playerDrafts, setPlayerDrafts] = useState({});
  const [seasonDrafts, setSeasonDrafts] = useState({});
  const [roundDrafts, setRoundDrafts] = useState({});
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    setPlayerDrafts(Object.fromEntries(players.map((player) => [player._id, {
      name: player.name,
      currentElo: player.currentElo,
      initialElo: player.initialElo,
      active: player.active,
    }])));
  }, [players]);

  useEffect(() => {
    if (!unlocked) return;
    api.getSeasons().then((data) => {
      setSeasons(data);
      if (data[0]) setSeasonId(data[0]._id);
    }).catch(showError);
  }, [unlocked]);

  useEffect(() => {
    if (!seasonId || !unlocked) {
      setRounds([]);
      setRoundId('');
      return;
    }
    api.getRounds(seasonId).then((data) => {
      setRounds(data);
      if (data[0]) setRoundId(data[0]._id);
    }).catch(showError);
  }, [seasonId, unlocked]);

  useEffect(() => {
    if (!roundId || !unlocked) {
      setMatches([]);
      return;
    }
    api.getMatches(roundId).then(setMatches).catch(showError);
  }, [roundId, unlocked]);

  useEffect(() => {
    setSeasonDrafts(Object.fromEntries(seasons.map((season) => [season._id, {
      name: season.name,
    }])));
  }, [seasons]);

  useEffect(() => {
    setRoundDrafts(Object.fromEntries(rounds.map((round) => [round._id, {
      number: round.number,
    }])));
  }, [rounds]);

  useEffect(() => {
    setMatchDrafts(Object.fromEntries(matches.map((match) => [match._id, {
      number: match.number,
    }])));
  }, [matches]);

  function showError(err) {
    setError(err.message || 'Ha ocurrido un error');
    setMessage(null);
  }

  async function unlock(event) {
    event.preventDefault();
    setError(null);
    try {
      await api.admin.check(keyInput);
      setAdminKey(keyInput);
      setUnlocked(true);
      setMessage('Panel desbloqueado');
    } catch (err) {
      showError(err);
    }
  }

  async function savePlayer(player) {
    const draft = playerDrafts[player._id];
    setSaving(`player-${player._id}`);
    setError(null);
    try {
      const updated = await api.admin.updatePlayer(adminKey, player._id, draft);
      onPlayersChange(players.map((item) => item._id === updated._id ? updated : item));
      setMessage(`Jugador actualizado: ${updated.name}`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function disablePlayer(player) {
    if (!window.confirm(`¿Dar de baja a ${player.name}? Se conservará su historial.`)) return;
    setSaving(`player-${player._id}`);
    try {
      const updated = await api.admin.disablePlayer(adminKey, player._id);
      onPlayersChange(players.map((item) => item._id === updated._id ? updated : item));
      setMessage(`Jugador dado de baja: ${updated.name}`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function saveSeason(season) {
    setSaving(`season-${season._id}`);
    setError(null);
    try {
      const updated = await api.admin.updateSeason(adminKey, season._id, seasonDrafts[season._id]);
      setSeasons((items) => items.map((item) => item._id === updated._id ? updated : item));
      setMessage(`Temporada actualizada: ${updated.name}`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function deleteSeason(season) {
    if (!window.confirm(`¿Borrar la temporada vacía "${season.name}"?`)) return;
    setSaving(`season-${season._id}`);
    try {
      await api.admin.deleteSeason(adminKey, season._id);
      setSeasons((items) => items.filter((item) => item._id !== season._id));
      setMessage('Temporada borrada');
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function saveRound(round) {
    setSaving(`round-${round._id}`);
    setError(null);
    try {
      const updated = await api.admin.updateRound(adminKey, round._id, roundDrafts[round._id]);
      setRounds((items) => items.map((item) => item._id === updated._id ? updated : item));
      setMessage(`Ronda ${updated.number} actualizada`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function deleteRound(round) {
    if (!window.confirm(`¿Borrar la ronda ${round.number} vacía?`)) return;
    setSaving(`round-${round._id}`);
    try {
      await api.admin.deleteRound(adminKey, round._id);
      setRounds((items) => items.filter((item) => item._id !== round._id));
      setMessage('Ronda borrada');
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function deleteMatch(match) {
    const confirmation = match.winner
      ? `¿Borrar el partido jugado ${match.number}? Se recalculará el Elo posterior.`
      : `¿Borrar el partido pendiente ${match.number}?`;
    if (!window.confirm(confirmation)) return;
    setSaving(`match-${match._id}`);
    try {
      await api.admin.deleteMatch(adminKey, match._id);
      setMatches((items) => items.filter((item) => item._id !== match._id));
      setMessage(match.winner ? 'Partido borrado y Elo recalculado' : 'Partido pendiente borrado');
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function saveMatch(match) {
    setSaving(`match-${match._id}`);
    setError(null);
    try {
      const updated = await api.admin.updateMatch(adminKey, match._id, {
        number: matchDrafts[match._id].number,
      });
      setMatches((items) => items.map((item) => item._id === updated._id ? updated : item));
      setMessage(`Partido ${updated.number} actualizado`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  function updateDraft(setter, id, field, value) {
    setter((drafts) => ({ ...drafts, [id]: { ...drafts[id], [field]: value } }));
  }

  if (!unlocked) {
    return (
      <section className="admin-page">
        <div className="admin-page__top"><h2>Administración</h2><button type="button" onClick={onClose}>Cerrar</button></div>
        <form className="admin-login" onSubmit={unlock}>
          <label>Clave de administrador<input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} autoFocus /></label>
          <button type="submit">Desbloquear</button>
        </form>
        {error && <p className="admin-page__error" role="alert">{error}</p>}
        <AdminStyles />
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page__top"><h2>Administración</h2><button type="button" onClick={onClose}>Cerrar</button></div>
      {error && <p className="admin-page__error" role="alert">{error}</p>}
      {message && <p className="admin-page__message" role="status">{message}</p>}

      <section className="admin-section">
        <h3>Jugadores y Elo</h3>
        {players.map((player) => {
          const draft = playerDrafts[player._id] || {};
          return <div className="admin-row" key={player._id}>
            <input aria-label={`Nombre de ${player.name}`} value={draft.name || ''} onChange={(event) => updateDraft(setPlayerDrafts, player._id, 'name', event.target.value)} />
            <input aria-label={`Elo actual de ${player.name}`} type="number" min="0.5" max="7" step="0.05" value={draft.currentElo ?? ''} onChange={(event) => updateDraft(setPlayerDrafts, player._id, 'currentElo', event.target.value)} />
            <button type="button" disabled={saving === `player-${player._id}`} onClick={() => savePlayer(player)}>Guardar</button>
            {player.active && <button type="button" className="admin-danger" onClick={() => disablePlayer(player)}>Dar de baja</button>}
          </div>;
        })}
      </section>

      <section className="admin-section">
        <h3>Temporadas / semanas</h3>
        {seasons.map((season) => {
          const draft = seasonDrafts[season._id] || {};
          return <div className="admin-row" key={season._id}>
            <label className="admin-field">
              <span>Nombre</span>
              <input aria-label={`Nombre de ${season.name}`} value={draft.name || ''} onChange={(event) => updateDraft(setSeasonDrafts, season._id, 'name', event.target.value)} />
            </label>
            <label className="admin-field admin-field--k">
              <span>Factor K de Elo</span>
              <output aria-label={`Factor K de Elo de ${season.name}`}>{ELO_K_FACTOR.toFixed(2)}</output>
              <small>Cuánto cambia el Elo tras cada partido.</small>
            </label>
            <button type="button" disabled={saving === `season-${season._id}`} onClick={() => saveSeason(season)}>Guardar</button>
            <button type="button" className="admin-danger" onClick={() => deleteSeason(season)}>Borrar vacía</button>
          </div>;
        })}
      </section>

      <section className="admin-section">
        <h3>Rondas</h3>
        <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
          <option value="">Selecciona una temporada</option>
          {seasons.map((season) => <option key={season._id} value={season._id}>{season.name}</option>)}
        </select>
        {rounds.map((round) => {
          const draft = roundDrafts[round._id] || {};
          return <div className="admin-row" key={round._id}>
            <span>Ronda</span>
            <input aria-label={`Número de ronda ${round.number}`} type="number" min="1" value={draft.number ?? ''} onChange={(event) => updateDraft(setRoundDrafts, round._id, 'number', event.target.value)} />
            <button type="button" disabled={saving === `round-${round._id}`} onClick={() => saveRound(round)}>Guardar</button>
            <button type="button" className="admin-danger" onClick={() => deleteRound(round)}>Borrar vacía</button>
          </div>;
        })}
      </section>

      <section className="admin-section">
        <h3>Partidos</h3>
        {!roundId && <p className="admin-page__note">Selecciona una ronda para ver sus partidos.</p>}
        {roundId && matches.length === 0 && <p className="admin-page__note">Esta ronda no tiene partidos.</p>}
        {matches.map((match) => (
          <div className="admin-row" key={match._id}>
            {!match.winner ? (
              <>
                <label className="admin-field admin-field--number">
                  <span>Número de partido</span>
                  <input type="number" min="1" value={matchDrafts[match._id]?.number ?? ''} onChange={(event) => updateDraft(setMatchDrafts, match._id, 'number', event.target.value)} />
                </label>
                <span className="admin-page__note">Pendiente</span>
                <button type="button" disabled={saving === `match-${match._id}`} onClick={() => saveMatch(match)}>Guardar</button>
              </>
            ) : (
              <span>Partido {match.number} · Jugado</span>
            )}
            <button type="button" className="admin-danger" disabled={saving === `match-${match._id}`} onClick={() => deleteMatch(match)}>
              {match.winner ? 'Borrar y recalcular' : 'Borrar'}
            </button>
          </div>
        ))}
        {matches.some((match) => match.winner) && <p className="admin-page__note">Borrar un partido jugado reconstruye el Elo y el historial posteriores.</p>}
      </section>

      <p className="admin-page__note">Los borrados de temporadas y rondas solo se permiten si están vacías. Los jugadores se dan de baja para conservar su historial.</p>
      <AdminStyles />
    </section>
  );
}

function AdminStyles() {
  return <style>{`
    .admin-page { display: flex; flex-direction: column; gap: 16px; }
    .admin-page__top, .admin-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .admin-page__top { justify-content: space-between; }
    .admin-section { display: flex; flex-direction: column; gap: 8px; padding: 16px; background: var(--surface); border-radius: var(--radius-md); }
    .admin-section h3 { font-size: 15px; margin-bottom: 4px; }
    .admin-row { padding: 8px 0; border-top: 1px solid rgba(237, 235, 222, 0.1); }
    .admin-row input, .admin-section > select, .admin-login input { min-width: 0; padding: 8px 10px; background: var(--surface-raised); color: var(--text); border: 1px solid rgba(237, 235, 222, 0.15); border-radius: var(--radius-sm); }
    .admin-row input:first-child { flex: 1; }
    .admin-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 150px; color: var(--text-muted); font-size: 11px; }
    .admin-field--k { flex: 0 1 210px; }
    .admin-field small { color: var(--text-muted); font-size: 10px; }
    .admin-field output { padding: 8px 10px; background: var(--surface-raised); color: var(--accent); border: 1px solid rgba(237, 235, 222, 0.15); border-radius: var(--radius-sm); font-family: var(--font-display); }
    .admin-row button, .admin-page__top button, .admin-login button { padding: 8px 12px; border: 1px solid rgba(237, 235, 222, 0.2); border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); }
    .admin-row button:hover, .admin-page__top button:hover, .admin-login button:hover { border-color: var(--accent); color: var(--accent); }
    .admin-danger { color: var(--danger) !important; border-color: var(--danger) !important; }
    .admin-login { display: flex; align-items: end; gap: 10px; flex-wrap: wrap; padding: 16px; background: var(--surface); border-radius: var(--radius-md); }
    .admin-login label { display: flex; flex-direction: column; gap: 6px; color: var(--text-muted); font-size: 12px; }
    .admin-page__error { margin: 0; padding: 10px 12px; color: var(--danger); border: 1px solid var(--danger); border-radius: var(--radius-sm); }
    .admin-page__message { margin: 0; padding: 10px 12px; color: var(--team-a); border: 1px solid var(--team-a); border-radius: var(--radius-sm); }
    .admin-page__note { color: var(--text-muted); font-size: 12px; margin: 0; }
    @media (max-width: 560px) { .admin-row input { width: 100%; } .admin-row input:first-child { flex: auto; } }
  `}</style>;
}
