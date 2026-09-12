import React, { useState } from 'react';
import {
  previewFinalElo,
  playerWinProbability,
  ELO_K_FACTOR,
} from '../../utils/elo.js';

// Se muestra una vez el partido ya existe en el backend (con media, diferencia
// y probabilidad calculadas). Aquí solo falta declarar quién ganó y, si se
// quiere, la nota (0-10) de cada jugador y el marcador por puntos. Al confirmar,
// se cierra el partido vía PATCH /matches/:id/result, que es donde el servidor
// calcula y persiste el elo final de verdad.
export default function ResultPanel({ match, onConfirm, saving }) {
  const [winner, setWinner] = useState(match.winner || null);
  const [adminKey, setAdminKey] = useState('');
  const [notes, setNotes] = useState({
    a: match.teamA.notes || [undefined, undefined],
    b: match.teamB.notes || [undefined, undefined],
  });
  const [score, setScore] = useState({
    a: match.score?.teamA ?? '',
    b: match.score?.teamB ?? '',
  });

  const teamAElos = match.teamA.eloBefore;
  const teamBElos = match.teamB.eloBefore;

  // Elo ACTUAL ("en vivo" acumulado) de cada equipo, para previsualizar el
  // cambio real: igual que el backend, la probabilidad sale de la base FIJA
  // de pretemporada (eloBefore) pero el resultado se suma al elo actual.
  const currentElosFor = (team) => {
    const teamData = team === 'a' ? match.teamA : match.teamB;
    return teamData.players.map((player, i) => player.currentElo ?? teamData.eloBefore?.[i]);
  };

  const previewFor = (team) => {
    if (!winner) return null;
    const elos = team === 'a' ? teamAElos : teamBElos;
    const currentElos = currentElosFor(team);
    const rivalAvg =
      team === 'a' ? match.teamB.avgElo : match.teamA.avgElo;
    const isWinner = (team === 'a' && winner === 1) || (team === 'b' && winner === 2);
    return elos.map((elo, i) => {
      // Misma fórmula que el backend (computeFinalElos): probabilidad con el
      // elo EFECTIVO mezclado (60% propio / 40% compañero), no con el elo a
      // secas. Así la vista previa coincide con el resultado que se guarda.
      const prob = playerWinProbability(elo, elos[1 - i], rivalAvg);
      return previewFinalElo(currentElos[i], ELO_K_FACTOR, isWinner, prob, notes[team][i]);
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

  const scoreComplete = score.a !== '' && score.b !== '';
  const halfScore = (score.a === '') !== (score.b === '');

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
                  {currentElosFor(team)
                    .map((e, i) => `${e.toFixed(2)} → ${preview[i].toFixed(2)}`)
                    .join(' · ')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="result-panel__score">
        <div className="result-panel__score-label">Marcador por puntos</div>
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
                  aria-label={`Puntos de ${teamData.players.map((p) => p.name).join(' + ')}`}
                  value={score[team]}
                  onChange={(e) => updateScore(team, e.target.value)}
                />
              </label>
            );
          })}
        </div>
        {scoreComplete && (
          <p className="result-panel__score-hint">
            {score.a} – {score.b} {winner ? `para el equipo ${winner === 1 ? 'A' : 'B'}` : ''}
          </p>
        )}
        {halfScore && (
          <p className="result-panel__score-hint" data-warn>
            Rellena el marcador de los dos equipos o déjalo vacío.
          </p>
        )}
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

      <label className="result-panel__key">
        Clave de administrador
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Obligatoria para guardar"
          autoComplete="off"
        />
      </label>

      <button
        type="button"
        className="result-panel__confirm"
        disabled={!winner || saving || halfScore || !adminKey}
        onClick={() =>
          onConfirm({
            winner,
            teamANotes: notes.a.some((n) => n !== undefined) ? notes.a : undefined,
            teamBNotes: notes.b.some((n) => n !== undefined) ? notes.b : undefined,
            score: scoreComplete
              ? { teamA: Number(score.a), teamB: Number(score.b) }
              : undefined,
            adminKey,
          })
        }
      >
      {saving ? 'Guardando…' : match.winner ? 'Guardar cambios' : 'Confirmar resultado'}
      </button>
    </div>
  );
}
