import React, { useState } from 'react';
import { previewFinalElo } from '../../utils/elo.js';

// Se muestra una vez el partido ya existe en el backend (con media, diferencia
// y probabilidad calculadas). Aquí solo falta declarar quién ganó y, si se
// quiere, la nota (0-10) de cada jugador. Al confirmar, se cierra el partido
// vía PATCH /matches/:id/result, que es donde el servidor calcula y persiste
// el elo final de verdad.
export default function ResultPanel({ match, kFactor, onConfirm, saving }) {
  const [winner, setWinner] = useState(match.winner || null);
  const [notes, setNotes] = useState({
    a: match.teamA.notes || [undefined, undefined],
    b: match.teamB.notes || [undefined, undefined],
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
      <h3>{match.winner ? 'Editar resultado' : '¿Quién ganó?'}</h3>
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
        {saving ? 'Guardando…' : match.winner ? 'Guardar cambios' : 'Confirmar resultado'}
      </button>
    </div>
  );
}
