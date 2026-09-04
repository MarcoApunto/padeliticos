import React from 'react';
import { useDraggable } from '@dnd-kit/core';

// Tarjeta arrastrable de un jugador del banquillo. También funciona por click
// (selección) para que quien no pueda arrastrar (teclado, torpeza táctil)
// pueda igualmente montar el partido: se selecciona la carta y luego se
// pulsa un hueco vacío en la pista.
export default function PlayerCard({ player, selected, onSelect, dimmed }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `pool-${player._id}`,
      data: { playerId: player._id },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(player._id)}
      className="player-card"
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      data-dimmed={dimmed || undefined}
      type="button"
    >
      <span className="player-card__name">{player.name}</span>
      <span className="player-card__elo numeric">
        {player.currentElo.toFixed(2)}
      </span>

      <style>{`
        .player-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: var(--surface-raised);
          border: 1px solid rgba(237, 235, 222, 0.12);
          border-radius: var(--radius-md);
          color: var(--text);
          text-align: left;
          touch-action: none;
        }
        .player-card:hover {
          border-color: rgba(237, 235, 222, 0.28);
        }
        .player-card[data-selected] {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent);
        }
        .player-card[data-dragging] {
          opacity: 0.4;
        }
        .player-card[data-dimmed] {
          opacity: 0.35;
          pointer-events: none;
        }
        .player-card__name {
          font-weight: 500;
          font-size: 14px;
        }
        .player-card__elo {
          font-size: 13px;
          color: var(--accent);
        }
      `}</style>
    </button>
  );
}
