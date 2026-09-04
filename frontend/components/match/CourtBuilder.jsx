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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const usedPlayerIds = useMemo(
    () => new Set(Object.values(slots).filter(Boolean)),
    [slots]
  );

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
    setError(null);
  }

  async function handleCreateMatch() {
    setCreating(true);
    setError(null);
    try {
      const created = await api.createMatch(round._id, {
        number: nextMatchNumber,
        teamA: { players: [slots['a-0'], slots['a-1']] },
        teamB: { players: [slots['b-0'], slots['b-1']] },
      });
      setNextMatchNumber((n) => n + 1);
      // Enriquecemos con los datos de jugador para mostrar nombres en ResultPanel
      created.teamA.players = created.teamA.players.map(
        (id) => playersById[id] || { _id: id, name: '…' }
      );
      created.teamB.players = created.teamB.players.map(
        (id) => playersById[id] || { _id: id, name: '…' }
      );
      setMatch(created);
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
      const closed = await api.setMatchResult(match._id, payload);
      onMatchClosed?.(closed);
      resetCourt();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingResult(false);
    }
  }

  const availablePlayers = players.filter((p) => !usedPlayerIds.has(p._id));

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="court-builder">
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
            onClick={handleCreateMatch}
          >
            {creating ? 'Creando partido…' : 'Crear partido con estas parejas'}
          </button>
        )}

        {error && <p className="court-builder__error">{error}</p>}

        {match && (
          <ResultPanel
            match={match}
            kFactor={kFactor}
            onConfirm={handleConfirmResult}
            saving={savingResult}
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
      </div>

      <style>{`
        .court-builder {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .court {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border-radius: var(--radius-lg);
          background: repeating-linear-gradient(
            0deg,
            var(--surface) 0px,
            var(--surface) 38px,
            var(--surface-raised) 38px,
            var(--surface-raised) 39px
          );
          border: 1px solid rgba(237, 235, 222, 0.1);
        }
        .court__side {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .court__label {
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }
        .court__label[data-team='a'] { color: var(--team-a); }
        .court__label[data-team='b'] { color: var(--team-b); }
        .court-builder__create {
          padding: 14px;
          border-radius: var(--radius-md);
          border: none;
          background: var(--accent);
          color: var(--bg);
          font-weight: 600;
          font-size: 15px;
        }
        .court-builder__create:disabled {
          background: var(--surface-raised);
          color: var(--text-muted);
          cursor: not-allowed;
        }
        .court-builder__error {
          color: var(--danger);
          font-size: 13px;
        }
        .bench {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .bench__label {
          font-size: 12px;
          color: var(--text-muted);
        }
        .bench__cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }
        @media (max-width: 640px) {
          .court {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </DndContext>
  );
}
