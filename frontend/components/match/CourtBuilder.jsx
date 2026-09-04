import React, { useEffect, useMemo, useState } from 'react';
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

export default function CourtBuilder({ players, round, kFactor, onMatchClosed }) {
  const [slots, setSlots] = useState(emptySlots);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [match, setMatch] = useState(null); // partido ya creado en backend
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
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

  const preview = useMemo(() => {
    if (!isComplete) return null;
    const teamAElos = [slots['a-0'], slots['a-1']].map(
      (id) => playersById[id]?.currentElo
    );
    const teamBElos = [slots['b-0'], slots['b-1']].map(
      (id) => playersById[id]?.currentElo
    );
    return previewMatch(teamAElos, teamBElos);
  }, [isComplete, slots, playersById]);

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
    setError(null);
  }

  function startEditingMatch(selectedMatch) {
    setEditingMatchId(selectedMatch._id);
    setSelectedPlayerId(null);
    setError(null);
    setSlots({
      'a-0': selectedMatch.teamA.players[0]._id,
      'a-1': selectedMatch.teamA.players[1]._id,
      'b-0': selectedMatch.teamB.players[0]._id,
      'b-1': selectedMatch.teamB.players[1]._id,
    });
  }

  async function handleSaveMatch() {
    setCreating(true);
    setError(null);
    try {
      const editingMatch = matches.find((item) => item._id === editingMatchId);
      const payload = {
        number: editingMatch ? editingMatch.number : nextMatchNumber,
        teamA: { players: [slots['a-0'], slots['a-1']] },
        teamB: { players: [slots['b-0'], slots['b-1']] },
      };
      if (editingMatchId) {
        await api.updateMatch(editingMatchId, payload);
      } else {
        await api.createMatch(round._id, payload);
        setNextMatchNumber((n) => n + 1);
      }
      setSlots(emptySlots());
      const updatedMatches = await api.getMatches(round._id);
      setMatches(updatedMatches);
      setEditingMatchId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmResult(payload) {
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

  const availablePlayers = players.filter(
    (player) => !usedPlayerIds.has(player._id) && !reservedPlayerIds.has(player._id)
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="court-builder">
        {!match && <>
        <div className="court">
          <div className="court__side" data-team="a">
            <span className="court__label" data-team="a">
              Equipo A
            </span>
            <TeamSlot
              id="a-0"
              team="a"
              player={playersById[slots['a-0']]}
              onClickEmpty={handleClickEmptySlot}
              onRemove={removeFromSlot}
            />
            <TeamSlot
              id="a-1"
              team="a"
              player={playersById[slots['a-1']]}
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
              onClickEmpty={handleClickEmptySlot}
              onRemove={removeFromSlot}
            />
            <TeamSlot
              id="b-1"
              team="b"
              player={playersById[slots['b-1']]}
              onClickEmpty={handleClickEmptySlot}
              onRemove={removeFromSlot}
            />
          </div>
        </div>

        {!match && (
          <button
            type="button"
            className="court-builder__create"
            disabled={!isComplete || creating}
            onClick={handleSaveMatch}
          >
            {creating
              ? editingMatchId ? 'Guardando cambios…' : 'Creando partido…'
              : editingMatchId ? 'Guardar cambios del partido' : 'Crear partido con estas parejas'}
          </button>
        )}
        {!match && editingMatchId && (
          <button type="button" className="court-builder__back" onClick={resetCourt}>
            Cancelar edición
          </button>
        )}

        {!match && !editingMatchId && (
          <RoundMatches
            matches={matches}
            loading={matchesLoading}
            onSelect={setMatch}
            onEdit={startEditingMatch}
          />
        )}

        {!match && (
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
                  selected={selectedPlayerId === player._id}
                  onSelect={handleSelectPlayer}
                />
              ))}
            </div>
          </div>
        )}
        </>}

        {error && <p className="court-builder__error">{error}</p>}

        {match && (
          <>
            <button type="button" className="court-builder__back" onClick={() => setMatch(null)}>
              Volver a los partidos de la ronda
            </button>
          <ResultPanel
            key={`${match._id}-${match.winner || 'pending'}`}
            match={match}
            kFactor={kFactor}
            onConfirm={handleConfirmResult}
            saving={savingResult}
          />
          </>
        )}

      </div>
    </DndContext>
  );
}

function RoundMatches({ matches, loading, onSelect, onEdit }) {
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
            return (
              <div className="round-match" key={match._id} data-pending={pending || undefined}>
                <div>
                  <strong>Partido {match.number}</strong>
                  <span>
                    {match.teamA.players.map((player) => player.name).join(' + ')}
                    {' vs '}
                    {match.teamB.players.map((player) => player.name).join(' + ')}
                  </span>
                </div>
                {pending ? (
                  <div className="round-match__actions">
                    <button type="button" onClick={() => onEdit(match)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => onSelect(match)}>
                      Añadir resultado
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => onSelect(match)}>
                    Editar resultado
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
