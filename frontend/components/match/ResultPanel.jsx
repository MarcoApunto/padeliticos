import React, { useState } from 'react';
import { previewFinalElo, ELO_K_FACTOR } from '../../utils/elo.js';

// Se muestra una vez el partido ya existe en el backend (con media, diferencia
// y probabilidad calculadas). Aquí solo falta declarar quién ganó y, si se
// quiere, la nota (0-10) de cada jugador y el marcador por sets. Al confirmar,
// se cierra el partido vía PATCH /matches/:id/result, que es donde el servidor
// calcula y persiste el elo final de verdad.
export default function ResultPanel({ match, onConfirm, saving }) {
  const [winner, setWinner] = useState(match.winner || null);
  const [notes, setNotes] = useState({
    a: match.teamA.notes || [undefined, undefined],
    b: match.teamB.notes || [undefined, undefined],
  });
  const [score, setScore] = useState({
    teamA: match.score?.teamA ?? '',
    teamB: match.score?.teamB ?? '',
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
      return previewFinalElo(elo, ELO_K_FACTOR, isWinner, prob, notes[team][i]);
    });
  };

  const previewA = previewFor('a');
  const previewB = previewFor('b');
  const teamAChance = Math.round((match.teamA.winProbability || 0) * 100);
  const teamBChance = Math.round((match.teamB.winProbability || 0) * 100);

  const updateNote = (team, index, value) => {
    setNotes((prev) => {
      const copy = { a: [...prev.a], b: [...prev.b] };
      copy[team][index] = value === '' ? undefined : Number(value);
      return copy;
    });
  };

  const updateScore = (team, value) => {
    setScore((prev) => ({ ...prev, [team]: value === '' ? '' : value }));
  };

  const scoreComplete = score.teamA !== '' && score.teamB !== '';
  const halfScore = (score.teamA === '') !== (score.teamB === '');

  return (
    <div className="result-panel">
      <h3>{match.winner ? 'Editar resultado' : '¿Quién ganó?'}</h3>
      <div className="result-panel__probabilities" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', fontWeight: 600 }}>
        <span className="numeric" data-team="a">{teamAChance}%</span>
        <span>Probabilidad</span>
        <span className="numeric" data-team="b">{teamBChance}%</span>
      </div>
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
        <summary>Marcador por sets (opcional)</summary>
        <div className="result-panel__score-row">
          {['a', 'b'].map((team) => {
            const teamData = team === 'a' ? match.teamA : match.teamB;
            return (
              <label key={team} className="result-panel__score-field" data-team={team}>
                <span>{teamData.players.map((p) => p.name).join(' + ')}</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  aria-label={`Sets de ${teamData.players.map((p) => p.name).join(' + ')}`}
                  value={score[team]}
                  onChange={(e) => updateScore(team, e.target.value)}
                />
              </label>
            );
          })}
        </div>
        {scoreComplete && (
          <p className="result-panel__score-hint">
            {score.teamA} – {score.teamB} {winner ? `para el equipo ${winner === 1 ? 'A' : 'B'}` : ''}
          </p>
        )}
        {halfScore && (
          <p className="result-panel__score-hint" data-warn>
            Rellena el marcador de los dos equipos o déjalo vacío.
          </p>
        )}
      </details>

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
        disabled={!winner || saving || halfScore}
        onClick={() =>
          onConfirm({
            winner,
            teamANotes: notes.a.some((n) => n !== undefined) ? notes.a : undefined,
            teamBNotes: notes.b.some((n) => n !== undefined) ? notes.b : undefined,
            score: scoreComplete
              ? { teamA: Number(score.teamA), teamB: Number(score.teamB) }
              : undefined,
          })
        }
      >
        {saving ? 'Guardando…' : match.winner ? 'Guardar cambios' : 'Confirmar resultado'}
      </button>
    </div>
  );
}
