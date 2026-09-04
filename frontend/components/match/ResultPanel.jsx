import React, { useState } from 'react';
import { previewFinalElo } from '../../utils/elo.js';

// Se muestra una vez el partido ya existe en el backend (con media, diferencia
// y probabilidad calculadas). Aquí solo falta declarar quién ganó y, si se
// quiere, la nota (0-10) de cada jugador. Al confirmar, se cierra el partido
// vía PATCH /matches/:id/result, que es donde el servidor calcula y persiste
// el elo final de verdad.
export default function ResultPanel({ match, kFactor, onConfirm, saving }) {
  const [winner, setWinner] = useState(null);
  const [notes, setNotes] = useState({
    a: [undefined, undefined],
    b: [undefined, undefined],
  });

  const teamAElos = match.teamA.eloBefore;
  const teamBElos = match.teamB.eloBefore;

  const previewFor = (team) => {
    if (!winner) return null;
    const elos = team === 'a' ? teamAElos : teamBElos;
    const rivalAvg =
      team === 'a' ? match.teamB.avgElo : match.teamA.avgElo;
    const isWinner = (team === 'a' && winner === 1) || (team === 'b' && winner === 2);
    return elos.map((elo, i) => {
      const prob = 1 / (1 + 10 ** ((rivalAvg - elo) / 4));
      return previewFinalElo(elo, kFactor, isWinner, prob, notes[team][i]);
    });
  };

  const previewA = previewFor('a');
  const previewB = previewFor('b');

  const updateNote = (team, index, value) => {
    setNotes((prev) => {
      const copy = { a: [...prev.a], b: [...prev.b] };
      copy[team][index] = value === '' ? undefined : Number(value);
      return copy;
    });
  };

  return (
    <div className="result-panel">
      <h3>¿Quién ganó?</h3>
      <div className="result-panel__teams">
        {['a', 'b'].map((team) => {
          const teamData = team === 'a' ? match.teamA : match.teamB;
          const winnerValue = team === 'a' ? 1 : 2;
          const preview = team === 'a' ? previewA : previewB;
          return (
            <button
              key={team}
              type="button"
              className="result-panel__team"
              data-team={team}
              data-selected={winner === winnerValue || undefined}
              onClick={() => setWinner(winnerValue)}
            >
              <span className="result-panel__players">
                {teamData.players.map((p) => p.name).join(' + ')}
              </span>
              {preview && (
                <span className="result-panel__preview numeric">
                  {teamData.eloBefore
                    .map((e, i) => `${e.toFixed(2)} → ${preview[i].toFixed(2)}`)
                    .join(' · ')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <details className="result-panel__notes">
        <summary>Añadir nota por jugador (opcional, 0-10)</summary>
        {['a', 'b'].map((team) => {
          const teamData = team === 'a' ? match.teamA : match.teamB;
          return (
            <div key={team} className="result-panel__notes-row">
              {teamData.players.map((p, i) => (
                <label key={p._id}>
                  {p.name}
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    placeholder="5"
                    onChange={(e) => updateNote(team, i, e.target.value)}
                  />
                </label>
              ))}
            </div>
          );
        })}
      </details>

      <button
        type="button"
        className="result-panel__confirm"
        disabled={!winner || saving}
        onClick={() =>
          onConfirm({
            winner,
            teamANotes: notes.a.some((n) => n !== undefined) ? notes.a : undefined,
            teamBNotes: notes.b.some((n) => n !== undefined) ? notes.b : undefined,
          })
        }
      >
        {saving ? 'Guardando…' : 'Confirmar resultado'}
      </button>

      <style>{`
        .result-panel {
          margin-top: 20px;
          padding: 18px;
          background: var(--surface);
          border-radius: var(--radius-lg);
        }
        .result-panel h3 {
          font-size: 16px;
          margin-bottom: 12px;
        }
        .result-panel__teams {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .result-panel__team {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px;
          border-radius: var(--radius-md);
          border: 1.5px solid transparent;
          background: var(--surface-raised);
          text-align: left;
          color: var(--text);
        }
        .result-panel__team[data-team='a'] { border-color: var(--team-a-dim); }
        .result-panel__team[data-team='b'] { border-color: var(--team-b-dim); }
        .result-panel__team[data-selected][data-team='a'] {
          border-color: var(--team-a);
          background: rgba(94, 200, 194, 0.12);
        }
        .result-panel__team[data-selected][data-team='b'] {
          border-color: var(--team-b);
          background: rgba(232, 147, 90, 0.12);
        }
        .result-panel__players {
          font-weight: 500;
          font-size: 14px;
        }
        .result-panel__preview {
          font-size: 12px;
          color: var(--accent);
        }
        .result-panel__notes {
          margin-top: 14px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .result-panel__notes summary {
          cursor: pointer;
        }
        .result-panel__notes-row {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .result-panel__notes-row label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
        }
        .result-panel__notes-row input {
          width: 60px;
          padding: 6px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(237, 235, 222, 0.2);
          background: var(--bg);
          color: var(--text);
        }
        .result-panel__confirm {
          margin-top: 16px;
          width: 100%;
          padding: 12px;
          border-radius: var(--radius-md);
          border: none;
          background: var(--accent);
          color: var(--bg);
          font-weight: 600;
          font-size: 14px;
        }
        .result-panel__confirm:disabled {
          background: var(--surface-raised);
          color: var(--text-muted);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
