/**
 * Lógica de Elo del sistema Padelitico, traducida 1:1 desde las fórmulas
 * de la hoja "Semana X" del Excel original.
 *
 * Fórmulas de referencia (Excel):
 *   Probabilidad = 1 / (1 + 10^((EloEquipoRival - EloJugador) / 4))
 *   Media equipo  = (EloJugador1 + EloJugador2) / 2
 *   Diferencia    = MediaEquipoA - MediaEquipoB
 *   ProbVictoria  = 1 / (1 + 10^(DiferenciaRival / 4))
 *   EloFinal      = EloActual + K * (esGanador - Probabilidad)
 *                   + ((Nota o 5) - 5) / 10
 *
 * A diferencia del Excel original, aquí el Elo se acota siempre al rango
 * [ELO_MIN, ELO_MAX] = [0.5, 7], igual que los rangos de Playtomic. Cualquier
 * resultado que se salga de esos límites se recorta (clamp).
 */

const ELO_MIN = 0.5;
const ELO_MAX = 7;

/**
 * Recorta un valor de elo al rango permitido [ELO_MIN, ELO_MAX].
 * @param {number} elo
 */
function clampElo(elo) {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, elo));
}

/**
 * Probabilidad de que un jugador aumente su elo frente al elo medio rival.
 * @param {number} eloRivalTeamAvg
 * @param {number} eloPlayer
 */
function winProbabilityForPlayer(eloRivalTeamAvg, eloPlayer) {
  return 1 / (1 + 10 ** ((eloRivalTeamAvg - eloPlayer) / 4));
}

/**
 * Probabilidad de victoria de un equipo en función de la diferencia
 * de elo respecto al rival (vista desde el equipo rival, como en el Excel).
 * @param {number} rivalEloDifference diferencia de elo del RIVAL (rivalAvg - ownAvg)
 */
function teamWinProbability(rivalEloDifference) {
  return 1 / (1 + 10 ** (rivalEloDifference / 4));
}

/**
 * Elo final de un jugador tras un partido.
 * @param {number} eloActual
 * @param {number} kFactor
 * @param {boolean} isWinner
 * @param {number} probability probabilidad previa de aumentar elo
 * @param {number|undefined} nota 0-10, opcional (5 = neutro si no se indica)
 */
function finalElo(eloActual, kFactor, isWinner, probability, nota) {
  const notaEfectiva = nota === undefined || nota === null ? 5 : nota;
  const raw =
    eloActual +
    kFactor * ((isWinner ? 1 : 0) - probability) +
    (notaEfectiva - 5) / 10;
  return clampElo(raw);
}

/**
 * Calcula todos los campos derivados de un partido ANTES de conocer
 * el ganador (equivalente a rellenar el Excel salvo la celda "Ganador").
 * @param {{players: {elo:number}[]}} teamA
 * @param {{players: {elo:number}[]}} teamB
 */
function computePreMatch(teamAElos, teamBElos) {
  const avgA = (teamAElos[0] + teamAElos[1]) / 2;
  const avgB = (teamBElos[0] + teamBElos[1]) / 2;

  const diffA = avgA - avgB; // "Diferencia de elo" de teamA
  const diffB = avgB - avgA;

  const teamAWinProbability = teamWinProbability(diffB); // usa diferencia del rival
  const teamBWinProbability = teamWinProbability(diffA);

  return {
    teamA: {
      eloBefore: teamAElos,
      avgElo: avgA,
      winProbability: teamAWinProbability,
      // probabilidad individual de cada jugador frente a la media rival
      playerProbabilities: teamAElos.map((elo) =>
        winProbabilityForPlayer(avgB, elo)
      ),
    },
    teamB: {
      eloBefore: teamBElos,
      avgElo: avgB,
      winProbability: teamBWinProbability,
      playerProbabilities: teamBElos.map((elo) =>
        winProbabilityForPlayer(avgA, elo)
      ),
    },
    eloDifference: diffA,
  };
}

/**
 * Calcula el elo final de los 4 jugadores una vez se conoce el ganador.
 * @param {number[]} teamAElos elo actual de los 2 jugadores del equipo A
 * @param {number[]} teamBElos elo actual de los 2 jugadores del equipo B
 * @param {1|2} winner
 * @param {number} kFactor
 * @param {number[]|undefined} teamANotes notas opcionales (0-10) de cada jugador de A
 * @param {number[]|undefined} teamBNotes
 */
function computeFinalElos(
  teamAElos,
  teamBElos,
  winner,
  kFactor,
  teamANotes,
  teamBNotes
) {
  if (winner !== 1 && winner !== 2) {
    throw new Error('winner debe ser 1 o 2 para calcular el elo final.');
  }

  const pre = computePreMatch(teamAElos, teamBElos);

  const teamAFinal = teamAElos.map((elo, i) =>
    finalElo(
      elo,
      kFactor,
      winner === 1,
      pre.teamA.playerProbabilities[i],
      teamANotes ? teamANotes[i] : undefined
    )
  );

  const teamBFinal = teamBElos.map((elo, i) =>
    finalElo(
      elo,
      kFactor,
      winner === 2,
      pre.teamB.playerProbabilities[i],
      teamBNotes ? teamBNotes[i] : undefined
    )
  );

  return { teamAFinal, teamBFinal, pre };
}

export {
  ELO_MIN,
  ELO_MAX,
  clampElo,
  winProbabilityForPlayer,
  teamWinProbability,
  finalElo,
  computePreMatch,
  computeFinalElos,
};
