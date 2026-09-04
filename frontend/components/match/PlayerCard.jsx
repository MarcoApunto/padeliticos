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
    </button>
  );
}
