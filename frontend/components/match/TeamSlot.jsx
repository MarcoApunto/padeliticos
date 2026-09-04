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

      <style>{`
        .team-slot {
          min-height: 62px;
          border-radius: var(--radius-md);
          border: 1.5px dashed rgba(237, 235, 222, 0.25);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          transition: border-color 120ms ease, background-color 120ms ease;
        }
        .team-slot[data-team='a'] { border-color: rgba(94, 200, 194, 0.35); }
        .team-slot[data-team='b'] { border-color: rgba(232, 147, 90, 0.35); }
        .team-slot[data-filled] {
          border-style: solid;
          background: var(--surface-raised);
        }
        .team-slot[data-team='a'][data-filled] { border-color: var(--team-a); }
        .team-slot[data-team='b'][data-filled] { border-color: var(--team-b); }
        .team-slot[data-over] {
          background: rgba(198, 241, 53, 0.08);
        }
        .team-slot__placeholder {
          color: var(--text-muted);
          font-size: 13px;
          margin: 0 auto;
        }
        .team-slot__name {
          font-weight: 500;
          font-size: 14px;
        }
        .team-slot__elo {
          font-size: 12px;
          color: var(--text-muted);
        }
        .team-slot__remove {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 18px;
          line-height: 1;
          padding: 4px;
        }
        .team-slot__remove:hover {
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
