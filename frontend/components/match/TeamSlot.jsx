import React from 'react';
import { useDroppable } from '@dnd-kit/core';

// Un hueco de la pista. Si está vacío y hay un jugador seleccionado por click,
// también se puede rellenar pulsando el hueco (fallback sin drag).
export default function TeamSlot({
  id,
  team, // 'a' | 'b'
  player,
  elo,
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
      tabIndex={player ? undefined : 0}
      aria-label={!player ? `Añadir jugador al equipo ${team.toUpperCase()}` : undefined}
      onKeyDown={(event) => {
        if (!player && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClickEmpty(id);
        }
      }}
    >
      {player ? (
        <>
          <div>
            <div className="team-slot__name">{player.name}</div>
            <div className="team-slot__elo numeric">
              {(elo ?? player?.currentElo ?? 0).toFixed(2)}
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
