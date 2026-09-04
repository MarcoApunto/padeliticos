import React from 'react';
import { useDroppable } from '@dnd-kit/core';

// Un hueco de la pista. Si está vacío y hay un jugador seleccionado por click,
// también se puede rellenar pulsando el hueco (fallback sin drag).
export default function TeamSlot({
  id,
  team, // 'a' | 'b'
  player,
  onClickEmpty,
  onRemove,
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { team } });

  return (
    <div
      ref={setNodeRef}
      className="team-slot"
      data-team={team}
      data-filled={Boolean(player) || undefined}
      data-over={isOver || undefined}
      onClick={() => !player && onClickEmpty(id)}
      role={player ? undefined : 'button'}
    >
      {player ? (
        <>
          <div>
            <div className="team-slot__name">{player.name}</div>
            <div className="team-slot__elo numeric">
              {player.currentElo.toFixed(2)}
            </div>
          </div>
          <button
            type="button"
            className="team-slot__remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(id);
            }}
            aria-label={`Quitar a ${player.name}`}
          >
            ×
          </button>
        </>
      ) : (
        <span className="team-slot__placeholder">Arrastra o pulsa</span>
      )}
    </div>
  );
}
