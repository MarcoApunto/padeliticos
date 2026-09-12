/**
 * Lógica de Elo del sistema Padelitico, traducida 1:1 desde las fórmulas
 * de la hoja "Semana X" del Excel original.
 *
 * Fórmulas de referencia (Excel):
 *   Media equipo  = (EloJugador1 + EloJugador2) / 2
 *   Diferencia    = MediaEquipoA - MediaEquipoB
 *   ProbVictoria  = 1 / (1 + 10^(DiferenciaRival / 4))
 *   EloFinal      = EloActual + K * (esGanador - Probabilidad)
 *                   + ((Nota o 5) - 5) / 10
 *
 * La probabilidad de cada jugador se calcula con un ELO EFECTIVO que mezcla
 * su elo y el de su compañero (60% propio / 40% compañero). Así el compañero
 * siempre influye: un jugador débil que gana al lado de un crack sube mucho
 * menos que en el Excel (el crack le "absorbe" parte del premio), pero los
 * dos jugadores de un equipo no se mueven igual salvo que tengan el mismo elo.
 *
 *   EloEfectivo  = 0.6 * EloJugador + 0.4 * EloCompañero
 *   Probabilidad = 1 / (1 + 10^((EloEquipoRival - EloEfectivo) / 4))
 *
 * A diferencia del Excel original, aquí el Elo se acota siempre al rango
 * [ELO_MIN, ELO_MAX] = [0.5, 7], igual que los rangos de Playtomic. Cualquier
 * resultado que se salga de esos límites se recorta (clamp).
 */

const ELO_MIN = 0.5;
const ELO_MAX = 7;
const ELO_K_FACTOR = 0.5;

/**
 * Peso del compañero en el elo efectivo de cada jugador. El 60% restante es
 * el propio elo, de modo que la pareja cuenta sin llegar a igualar a ambos.
 */
const PARTNER_WEIGHT = 0.4;

/**
 * Recorta un valor de elo al rango permitido [ELO_MIN, ELO_MAX].
 * @param {number} elo
 */
function clampElo(elo) {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, elo));
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
 * Elo efectivo de un jugador para el cálculo de su probabilidad: mezcla su
 * elo con el de su compañero de forma que la pareja siempre cuenta.
 * @param {number} eloPlayer
 * @param {number} eloPartner
 */
function blendedElo(eloPlayer, eloPartner) {
  return (1 - PARTNER_WEIGHT) * eloPlayer + PARTNER_WEIGHT * eloPartner;
}

/**
 * Probabilidad individual de aumentar elo frente a la media del equipo rival,
 * usando el elo efectivo (ela del jugador + peso del compañero).
 * @param {number} eloPlayer
 * @param {number} eloPartner
 * @param {number} rivalTeamAvg elo medio del equipo rival
 */
function playerWinProbability(eloPlayer, eloPartner, rivalTeamAvg) {
  return 1 / (1 + 10 ** ((rivalTeamAvg - blendedElo(eloPlayer, eloPartner)) / 4));
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
      // probabilidad individual con el compañero mezclado (no idéntica salvo elo igual)
      playerProbabilities: teamAElos.map((elo, i) =>
        playerWinProbability(elo, teamAElos[1 - i], avgB)
      ),
    },
    teamB: {
      eloBefore: teamBElos,
      avgElo: avgB,
      winProbability: teamBWinProbability,
      playerProbabilities: teamBElos.map((elo, i) =>
        playerWinProbability(elo, teamBElos[1 - i], avgA)
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
  ELO_K_FACTOR,
  clampElo,
  teamWinProbability,
  playerWinProbability,
  finalElo,
  computePreMatch,
  computeFinalElos,
};
