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
export default function ResultPanel({ match, onConfirm, saving, onBack, canConfirm = true, adminKey, onAdminKeyChange, showBack = true, showAdminKey = true }) {
  const [winner, setWinner] = useState(match.winner || null);
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

  const previewFor = (team) => {
    if (!winner || match.teamA.players.length !== 2 || match.teamB.players.length !== 2) return null;
    const elos = team === 'a' ? teamAElos : teamBElos;
    const rivalAvg =
      team === 'a' ? match.teamB.avgElo : match.teamA.avgElo;
    const isWinner = (team === 'a' && winner === 1) || (team === 'b' && winner === 2);
    return elos.map((elo, i) => {
      // Misma fórmula que el backend (computeFinalElos): probabilidad con el
      // elo EFECTIVO mezclado (60% propio / 40% compañero), no con el elo a
      // secas. La base de cálculo es la FIJA de pretemporada (eloBefore): en
      // todas las rondas aparece el mismo 2.00 → su delta. Así la vista previa
      // coincide con el resultado del partido que se guarda (el Historial, en
      // cambio, acumula los deltas).
      const prob = playerWinProbability(elo, elos[1 - i], rivalAvg);
      return previewFinalElo(elo, ELO_K_FACTOR, isWinner, prob, notes[team][i]);
    });
  };

  const previewA = previewFor('a');
  const previewB = previewFor('b');
  const teamAChance = match.teamA.winProbability == null ? null : Math.round(match.teamA.winProbability * 100);
  const teamBChance = match.teamB.winProbability == null ? null : Math.round(match.teamB.winProbability * 100);

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
      <div className="result-panel__heading">
        <h3>{match.winner ? 'Editar resultado' : '¿Quién ganó?'}</h3>
        <span className="match-type-badge" data-type={match.type === 'friendly' ? 'friendly' : 'competitive'}>
          {match.type === 'friendly' ? 'Amistoso' : 'Competitivo'}
        </span>
      </div>
      <div className="result-panel__probabilities" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', fontWeight: 600 }}>
        <span className="numeric" data-team="a">{teamAChance == null ? '—' : `${teamAChance}%`}</span>
        <span>Probabilidad</span>
        <span className="numeric" data-team="b">{teamBChance == null ? '—' : `${teamBChance}%`}</span>
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
                {teamData.players.length === 2
                  ? teamData.players.map((p) => p.name).join(' + ')
                  : teamData.players.length
                    ? `${teamData.players.map((p) => p.name).join(' + ')} · equipo incompleto`
                    : 'Equipo incompleto'}
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

      {showAdminKey && (
        <label className="result-panel__key">
          Clave de administrador
          <input
            type="password"
            value={adminKey}
            onChange={(e) => onAdminKeyChange(e.target.value)}
            placeholder="Obligatoria para guardar"
            autoComplete="off"
          />
        </label>
      )}

      {!canConfirm && (
        <p className="result-panel__unsaved" role="status">
          Guarda primero los cambios del partido para confirmar el resultado con los equipos actualizados.
        </p>
      )}

      <div className="result-panel__actions">
        {showBack && (
          <button type="button" className="court-builder__back" onClick={onBack}>
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="result-panel__confirm"
          disabled={!winner || saving || halfScore || !adminKey || !canConfirm}
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
    </div>
  );
}
