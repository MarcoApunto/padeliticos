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
      setMatches([]);
      return;
    }
    setRounds([]);
    setRoundId('');
    setMatches([]);
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
        <div className="admin-page__top"><h2>Super Padelitico</h2><button type="button" onClick={onClose}>Cerrar</button></div>
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
      <div className="admin-page__top"><h2>Super Padelitico</h2><button type="button" onClick={onClose}>Cerrar</button></div>
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
        <select value={roundId} onChange={(event) => setRoundId(event.target.value)} disabled={!seasonId || rounds.length === 0}>
          <option value="">Selecciona una ronda</option>
          {rounds.map((round) => <option key={round._id} value={round._id}>Ronda {round.number}</option>)}
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
          <div className="admin-match-card" key={match._id} data-played={match.winner || undefined}>
            <div className="admin-match-card__topline">
              <strong className="admin-match-card__number">Partido {match.number}</strong>
              <span className="admin-match-card__status">
                {match.winner ? `Ganó el equipo ${match.winner === 1 ? 'A' : 'B'}` : 'Pendiente'}
              </span>
            </div>
            <div className="admin-match-card__teams">
              <div className="admin-match-card__team" data-team="a" data-winner={match.winner === 1 || undefined}>
                <span className="admin-match-card__team-label">Equipo A</span>
                <span>{match.teamA.players.map((player) => player.name).join(' + ')}</span>
              </div>
              <span className="admin-match-card__vs">vs</span>
              <div className="admin-match-card__team" data-team="b" data-winner={match.winner === 2 || undefined}>
                <span className="admin-match-card__team-label">Equipo B</span>
                <span>{match.teamB.players.map((player) => player.name).join(' + ')}</span>
              </div>
            </div>
            <div className="admin-match-card__actions">
              {!match.winner && (
                <>
                  <label className="admin-match-card__number-edit">
                    Nº
                    <input type="number" min="1" value={matchDrafts[match._id]?.number ?? ''} onChange={(event) => updateDraft(setMatchDrafts, match._id, 'number', event.target.value)} />
                  </label>
                  <button type="button" disabled={saving === `match-${match._id}`} onClick={() => saveMatch(match)}>Guardar número</button>
                </>
              )}
              <button type="button" className="admin-danger" disabled={saving === `match-${match._id}`} onClick={() => deleteMatch(match)}>
                {match.winner ? 'Borrar y recalcular' : 'Borrar partido'}
              </button>
            </div>
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
  return;
}
