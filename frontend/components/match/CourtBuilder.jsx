import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import PlayerCard from './PlayerCard.jsx';
import TeamSlot from './TeamSlot.jsx';
import NetStats from './NetStats.jsx';
import ResultPanel from './ResultPanel.jsx';
import { previewMatch } from '../../utils/elo.js';
import { api } from '../../api/client.js';

const SLOT_IDS = ['a-0', 'a-1', 'b-0', 'b-1'];

// Estado inicial de los 4 huecos de la pista, todos vacíos.
const emptySlots = () => ({ 'a-0': null, 'a-1': null, 'b-0': null, 'b-1': null });

export default function CourtBuilder({ players, round, onMatchClosed, onManagementChange }) {
  const [slots, setSlots] = useState(emptySlots);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [match, setMatch] = useState(null); // partido ya creado en backend
  const [matchType, setMatchType] = useState('competitive');
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [matchSaveState, setMatchSaveState] = useState('saved');
  const [autoSaveRetry, setAutoSaveRetry] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const autoSaveQueue = useRef(Promise.resolve());
  const [error, setError] = useState(null);
  // Contador local del siguiente número de partido dentro de esta ronda.
  // Arranca desde round.matchCount pero luego se lleva localmente para no
  // depender de que el padre refresque la ronda tras cada partido creado.
  const [nextMatchNumber, setNextMatchNumber] = useState(
    (round.matchCount || 0) + 1
  );

  useEffect(() => {
    setNextMatchNumber((round.matchCount || 0) + 1);
  }, [round._id, round.matchCount]);

  useEffect(() => {
    let cancelled = false;
    setMatch(null);
    setSlots(emptySlots());
    setMatchType('competitive');
    setMatchesLoading(true);
    api
      .getMatches(round._id)
      .then((data) => {
        if (cancelled) return;
        setMatches(data);
        const highestNumber = data.reduce(
          (highest, item) => Math.max(highest, item.number || 0),
          0
        );
        setNextMatchNumber(highestNumber + 1);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudieron cargar los partidos');
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [round._id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const usedPlayerIds = useMemo(
    () => new Set(Object.values(slots).filter(Boolean)),
    [slots]
  );

  const reservedPlayerIds = useMemo(() => {
    const ids = new Set();
    matches
      .filter((item) => item._id !== editingMatchId)
      .forEach((item) => {
        [...item.teamA.players, ...item.teamB.players].forEach((player) => {
          ids.add(typeof player === 'string' ? player : player._id);
        });
      });
    return ids;
  }, [matches, editingMatchId]);

  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p._id, p])),
    [players]
  );

  const isComplete = SLOT_IDS.every((id) => slots[id]);
  const playerIdOf = (player) => (typeof player === 'string' ? player : player?._id);
  const editingMatch = matches.find((item) => item._id === editingMatchId) ||
    (match?._id === editingMatchId ? match : null);
  const lineupDirty = Boolean(
    editingMatch && (
      slots['a-0'] !== playerIdOf(editingMatch.teamA.players[0]) ||
      slots['a-1'] !== playerIdOf(editingMatch.teamA.players[1]) ||
      slots['b-0'] !== playerIdOf(editingMatch.teamB.players[0]) ||
      slots['b-1'] !== playerIdOf(editingMatch.teamB.players[1])
    )
  );
  const typeDirty = Boolean(
    editingMatch && matchType !== (editingMatch.type === 'friendly' ? 'friendly' : 'competitive')
  );
  const matchEditsDirty = lineupDirty || typeDirty;
  const managingPendingMatch = Boolean(match && editingMatchId);

  useEffect(() => {
    onManagementChange?.(Boolean(match));
  }, [match, onManagementChange]);

  // Misma regla que el backend: durante TODA la temporada se trabaja contra la
  // base de PRETEMPORADA (season.baseEloByPlayer), NO contra el currentElo
  // acumulado. El snapshot se captura al crear la temporada y queda fijo para
  // todos los partidos, así lo ganado/perdido en la Ronda 1 no aparece en la
  // Ronda 2. Este mismo Elo es el que enseñan las tarjetas y los huecos.
  const seasonBaseByPlayer = round.season?.baseEloByPlayer;
  const eloForCard = (id) =>
    seasonBaseByPlayer?.[id] ??
    seasonBaseByPlayer?.get?.(id) ??
    playersById[id]?.currentElo ??
    0;

  const preview = useMemo(() => {
    if (!isComplete) return null;
    const teamAElos = [slots['a-0'], slots['a-1']].map(eloForCard);
    const teamBElos = [slots['b-0'], slots['b-1']].map(eloForCard);
    return previewMatch(teamAElos, teamBElos);
  }, [isComplete, slots, playersById, seasonBaseByPlayer]);

  useEffect(() => {
    if (!editingMatchId || !editingMatch || !matchEditsDirty) return;

    // El tipo se puede guardar usando la alineación persistida aunque el usuario
    // esté sustituyendo un jugador y el formulario tenga un hueco temporal.
    if (lineupDirty && !isComplete && !typeDirty) {
      setMatchSaveState('waiting');
      setError(null);
      return;
    }

    const teamAPlayers = lineupDirty && isComplete
      ? [slots['a-0'], slots['a-1']]
      : editingMatch.teamA.players.map(playerIdOf);
    const teamBPlayers = lineupDirty && isComplete
      ? [slots['b-0'], slots['b-1']]
      : editingMatch.teamB.players.map(playerIdOf);
    const payload = {
      number: editingMatch.number,
      type: matchType,
      teamA: { players: teamAPlayers },
      teamB: { players: teamBPlayers },
    };
    let cancelled = false;
    setMatchSaveState('saving');
    setError(null);

    const timer = setTimeout(() => {
      const saveTask = autoSaveQueue.current
        .catch(() => undefined)
        .then(() => api.updateMatch(editingMatchId, payload));
      autoSaveQueue.current = saveTask;

      saveTask.then((updatedMatch) => {
        if (cancelled) return;
        setMatches((current) => current.map((item) =>
          item._id === updatedMatch._id ? updatedMatch : item
        ));
        setMatch(updatedMatch);
        setMatchSaveState('saved');
      }).catch((err) => {
        if (cancelled) return;
        setMatchSaveState('error');
        setError(err.message || 'No se pudieron guardar los cambios automáticamente');
      });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [editingMatchId, editingMatch, matchEditsDirty, lineupDirty, typeDirty, isComplete, slots, matchType, autoSaveRetry]);

  const liveResultMatch = (() => {
    if (!managingPendingMatch) return match;

    const livePreview = isComplete
      ? previewMatch(
          [slots['a-0'], slots['a-1']].map(eloForCard),
          [slots['b-0'], slots['b-1']].map(eloForCard)
        )
      : null;
    const liveTeam = (team, slotIds) => {
      const originalTeam = team === 'a' ? match.teamA : match.teamB;
      const teamPlayers = slotIds.map((slotId) => playersById[slots[slotId]]).filter(Boolean);
      const teamElos = slotIds
        .map((slotId) => playersById[slots[slotId]] ? eloForCard(slots[slotId]) : null)
        .filter((elo) => elo !== null);
      const teamStats = livePreview?.[team === 'a' ? 'teamA' : 'teamB'] || {
        eloBefore: teamElos,
        avgElo: null,
        winProbability: null,
      };
      return { ...originalTeam, ...teamStats, players: teamPlayers };
    };

    return {
      ...match,
      type: matchType,
      teamA: liveTeam('a', ['a-0', 'a-1']),
      teamB: liveTeam('b', ['b-0', 'b-1']),
    };
  })();

  function assign(slotId, playerId) {
    setSlots((prev) => {
      // si ese jugador ya estaba en otro hueco, lo liberamos primero
      const next = { ...prev };
      for (const id of SLOT_IDS) {
        if (next[id] === playerId) next[id] = null;
      }
      next[slotId] = playerId;
      return next;
    });
    setSelectedPlayerId(null);
  }

  function removeFromSlot(slotId) {
    setSlots((prev) => ({ ...prev, [slotId]: null }));
  }

  function handleDragEnd(event) {
    const { over, active } = event;
    if (!over) return;
    const playerId = active.data.current?.playerId;
    if (!playerId) return;
    assign(over.id, playerId);
  }

  function handleSelectPlayer(playerId) {
    if (usedPlayerIds.has(playerId)) return;
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  }

  function handleClickEmptySlot(slotId) {
    if (!selectedPlayerId) return;
    assign(slotId, selectedPlayerId);
  }

  function resetCourt() {
    setSlots(emptySlots());
    setMatch(null);
    setEditingMatchId(null);
    setMatchType('competitive');
    setAdminKey('');
    setMatchSaveState('saved');
    setError(null);
  }

  function startEditingMatch(selectedMatch) {
    setEditingMatchId(selectedMatch._id);
    setMatchType(selectedMatch.type === 'friendly' ? 'friendly' : 'competitive');
    setSelectedPlayerId(null);
    setError(null);
    setMatchSaveState('saved');
    setSlots({
      'a-0': playerIdOf(selectedMatch.teamA.players[0]),
      'a-1': playerIdOf(selectedMatch.teamA.players[1]),
      'b-0': playerIdOf(selectedMatch.teamB.players[0]),
      'b-1': playerIdOf(selectedMatch.teamB.players[1]),
    });
  }

  async function handleSaveMatch() {
    setCreating(true);
    setError(null);
    try {
      const payload = {
        number: nextMatchNumber,
        type: matchType,
        teamA: { players: [slots['a-0'], slots['a-1']] },
        teamB: { players: [slots['b-0'], slots['b-1']] },
      };
      const created = await api.createMatch(round._id, payload);
      setNextMatchNumber((n) => n + 1);
      const updatedMatches = await api.getMatches(round._id);
      setMatches(updatedMatches);
      setSlots(emptySlots());
      // Abrimos directamente el panel de resultado del partido recién creado.
      const populated = updatedMatches.find((item) => item._id === created._id);
      setMatch(populated || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmResult(payload) {
    if (matchEditsDirty) {
      setError('Guarda primero los cambios del partido antes de confirmar el resultado.');
      return;
    }
    setSavingResult(true);
    setError(null);
    try {
      const closed = match.winner
        ? await api.updateMatchResult(match._id, payload)
        : await api.setMatchResult(match._id, payload);
      onMatchClosed?.(closed);
      resetCourt();
      const updatedMatches = await api.getMatches(round._id);
      setMatches(updatedMatches);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingResult(false);
    }
  }

  async function openManagement(selected) {
    setError(null);
    try {
      const freshMatches = await api.getMatches(round._id);
      setMatches(freshMatches);
      const fresh = freshMatches.find((item) => item._id === selected._id) || selected;
      setMatch(fresh);
      if (fresh.winner) {
        setEditingMatchId(null);
        setSlots(emptySlots());
      } else {
        startEditingMatch(fresh);
      }
    } catch (err) {
      setError(err.message);
      setMatch(selected);
      if (!selected.winner) startEditingMatch(selected);
    }
  }

  const availablePlayers = players.filter(
    (player) => !usedPlayerIds.has(player._id) && !reservedPlayerIds.has(player._id)
  );
  const resultPanel = match && (
      <ResultPanel
      key={`${match._id}-${match.winner || 'pending'}`}
      match={liveResultMatch}
      onConfirm={handleConfirmResult}
      saving={savingResult}
      onBack={resetCourt}
      canConfirm={!matchEditsDirty}
      adminKey={adminKey}
      onAdminKeyChange={setAdminKey}
    />
  );
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="court-builder">
        {(!match || editingMatchId) && (
          <section className={managingPendingMatch ? 'court-builder__management' : 'court-builder__form'}>
          {managingPendingMatch && (
            <header className="court-builder__management-heading court-builder__management-heading--editable">
              <div className="court-builder__management-copy">
                <h3>Gestionar partido {match.number}</h3>
                <p>Edita los equipos y registra el resultado desde esta sección.</p>
              </div>
              <button type="button" className="court-builder__discard" onClick={resetCourt}>
                Volver a partidos
              </button>
            </header>
          )}
          <div className={managingPendingMatch ? 'court-builder__edit-section' : 'court-builder__form-fields'}>
          {managingPendingMatch && <h4>Editar partido</h4>}
        <div className="court">
          <div className="court__side" data-team="a">
            <span className="court__label" data-team="a">
              Equipo A
            </span>
            <TeamSlot
              id="a-0"
              team="a"
              player={playersById[slots['a-0']]}
              elo={eloForCard(slots['a-0'])}
              onClickEmpty={handleClickEmptySlot}
              onRemove={removeFromSlot}
            />
            <TeamSlot
              id="a-1"
              team="a"
              player={playersById[slots['a-1']]}
              elo={eloForCard(slots['a-1'])}
              onClickEmpty={handleClickEmptySlot}
              onRemove={removeFromSlot}
            />
          </div>

          <NetStats preview={preview} />

          <div className="court__side" data-team="b">
            <span className="court__label" data-team="b">
              Equipo B
            </span>
            <TeamSlot
              id="b-0"
              team="b"
              player={playersById[slots['b-0']]}
              elo={eloForCard(slots['b-0'])}
              onClickEmpty={handleClickEmptySlot}
              onRemove={removeFromSlot}
            />
            <TeamSlot
              id="b-1"
              team="b"
              player={playersById[slots['b-1']]}
              elo={eloForCard(slots['b-1'])}
              onClickEmpty={handleClickEmptySlot}
              onRemove={removeFromSlot}
            />
          </div>
        </div>

        <label className="match-type-toggle">
          <input
            type="checkbox"
            role="switch"
            aria-label="Partido amistoso"
            checked={matchType === 'friendly'}
            onChange={(event) => setMatchType(event.target.checked ? 'friendly' : 'competitive')}
          />
          <span className="match-type-toggle__track" aria-hidden="true">
            <span className="match-type-toggle__thumb" />
          </span>
          <span className="match-type-toggle__label">Partido amistoso</span>
          <span className="match-type-toggle__status" data-type={matchType}>
            {matchType === 'friendly' ? 'Sin Elo' : 'Competitivo'}
          </span>
        </label>

        <div className="court-builder__actions">
          {editingMatchId ? (
            <div className="court-builder__autosave-row">
              <p className="court-builder__autosave" data-state={matchSaveState} role="status">
                {matchSaveState === 'saving' && 'Guardando automáticamente…'}
                {matchSaveState === 'waiting' && 'Completa los cuatro jugadores para guardar la alineación.'}
                {matchSaveState === 'error' && 'No se pudo guardar automáticamente.'}
                {matchSaveState === 'saved' && 'Cambios guardados automáticamente.'}
              </p>
              {matchSaveState === 'error' && (
                <button type="button" className="court-builder__autosave-retry" onClick={() => setAutoSaveRetry((count) => count + 1)}>
                  Reintentar
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="court-builder__create"
              disabled={!isComplete || creating}
              onClick={handleSaveMatch}
            >
              {creating ? 'Creando partido…' : 'Crear partido con estas parejas'}
            </button>
          )}
        </div>

        <div className="bench">
            <span className="bench__label">
              Banquillo — pulsa o arrastra a un hueco
            </span>
            <div className="bench__cards">
              {availablePlayers.length === 0 && (
                <p className="text-muted">No quedan jugadores libres.</p>
              )}
              {availablePlayers.map((player) => (
                <PlayerCard
                  key={player._id}
                  player={player}
                  elo={eloForCard(player._id)}
                  selected={selectedPlayerId === player._id}
                  onSelect={handleSelectPlayer}
                />
              ))}
            </div>
        </div>
          </div>
        {managingPendingMatch && React.cloneElement(resultPanel, { showBack: false })}
          </section>
        )}

        {!match && !editingMatchId && (
          <RoundMatches
            matches={matches}
            loading={matchesLoading}
            onManage={openManagement}
          />
        )}

       

        {error && <p className="court-builder__error">{error}</p>}

        {match && !editingMatchId && (
          <section className="court-builder__management">
            <header className="court-builder__management-heading">
              <h3>Gestionar partido {match.number}</h3>
              <p>{match.winner ? 'Edita el resultado de este partido.' : 'Añade el resultado de este partido.'}</p>
            </header>
            {resultPanel}
          </section>
        )}

      </div>
    </DndContext>
  );
}

function RoundMatches({ matches, loading, onManage }) {
  return (
    <section className="round-matches">
      <div className="round-matches__header">
        <h3>Partidos de esta ronda</h3>
        {loading && <span className="text-muted">Cargando…</span>}
      </div>
      {!loading && matches.length === 0 && (
        <p className="text-muted">Todavía no hay partidos creados en esta ronda.</p>
      )}
      {!loading && matches.length > 0 && (
        <div className="round-matches__list">
          {matches.map((match) => {
            const pending = !match.winner;
            const pctA = Math.round((match.teamA.winProbability || 0) * 100);
            const pctB = Math.round((match.teamB.winProbability || 0) * 100);
            const teamANames = match.teamA.players.map((player) => player.name).join(' + ');
            const teamBNames = match.teamB.players.map((player) => player.name).join(' + ');
            // Cuando hay resultado, el ganador se muestra primero para que
            // la frase lea "ganador ganó a perdedor".
            const sides = pending
              ? [
                  { team: 'a', label: teamANames, won: false },
                  { team: 'b', label: teamBNames, won: false },
                ]
              : match.winner === 1
                ? [
                    { team: 'a', label: teamANames, won: true },
                    { team: 'b', label: teamBNames, won: false },
                  ]
                : [
                    { team: 'b', label: teamBNames, won: true },
                    { team: 'a', label: teamANames, won: false },
                  ];
            return (
              <div className="round-match" key={match._id} data-pending={pending || undefined}>
                <div>
                  <div className="round-match__head">
                    <strong>Partido {match.number}</strong>
                    <span className="match-type-badge" data-type={match.type === 'friendly' ? 'friendly' : 'competitive'}>
                      {match.type === 'friendly' ? 'Amistoso' : 'Competitivo'}
                    </span>
                    {match.score && (
                      <span className="round-match__score numeric">
                        {match.score.teamA} – {match.score.teamB}
                      </span>
                    )}
                  </div>
                  <div className="round-match__lineup">
                    {sides.map((side, index) => {
                      const pct = side.team === 'a' ? pctA : pctB;
                      return (
                        <React.Fragment key={index}>
                          {index === 1 && <span className="round-match__sep">vs</span>}
                          <span
                            className="round-match__team"
                            data-team={side.team}
                            data-won={side.won || undefined}
                            data-lost={!pending && !side.won || undefined}
                          >
                            {index === 0 ? (
                              <>
                                {side.label}
                                <span className="round-match__pct numeric">({pct}%)</span>
                              </>
                            ) : (
                              <>
                                <span className="round-match__pct numeric">({pct}%)</span>
                                {side.label}
                              </>
                            )}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {!pending && (
                    <span className="round-match__status">
                      Ganó el equipo {match.winner === 1 ? 'A' : 'B'}
                    </span>
                  )}
                </div>
                <div className="round-match__actions">
                  <button type="button" className="round-match__manage" onClick={() => onManage(match)}>
                    Gestionar
                  </button>
                  {pending && <span className="round-match__pending">Pendiente</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
