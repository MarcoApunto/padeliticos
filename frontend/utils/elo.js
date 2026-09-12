// Espejo del backend (services/eloService.js), SOLO para previsualización en
// el cliente. El resultado que se persiste lo calcula y valida siempre el
// servidor; aquí no se escribe nada.

export const ELO_MIN = 0.5;
export const ELO_MAX = 7;
export const ELO_K_FACTOR = 0.5;

/** Peso del compañero en el elo efectivo de cada jugador (60% propio / 40% pareja). */
const PARTNER_WEIGHT = 0.4;

export function clampElo(elo) {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, elo));
}

/** Probabilidad de victoria de un equipo según la diferencia de elo del RIVAL. */
function teamWinProbability(rivalEloDifference) {
  return 1 / (1 + 10 ** (rivalEloDifference / 4));
}

/** Elo efectivo de un jugador: mezcla su elo con el de su compañero. */
function blendedElo(eloPlayer, eloPartner) {
  return (1 - PARTNER_WEIGHT) * eloPlayer + PARTNER_WEIGHT * eloPartner;
}

/** Probabilidad individual de ganar frente a la media del equipo rival. */
function playerWinProbability(eloPlayer, eloPartner, rivalTeamAvg) {
  return 1 / (1 + 10 ** ((rivalTeamAvg - blendedElo(eloPlayer, eloPartner)) / 4));
}

/**
 * Todo lo calculable del partido ANTES de conocer el ganador.
 * @param {number[]} teamAElos elos de los 2 jugadores del equipo A
 * @param {number[]} teamBElos
 */
export function previewMatch(teamAElos, teamBElos) {
  const avgA = (teamAElos[0] + teamAElos[1]) / 2;
  const avgB = (teamBElos[0] + teamBElos[1]) / 2;
  const diffA = avgA - avgB;
  const diffB = avgB - avgA;

  return {
    teamA: {
      eloBefore: teamAElos,
      avgElo: avgA,
      winProbability: teamWinProbability(diffB),
      playerProbabilities: teamAElos.map((elo, i) =>
        playerWinProbability(elo, teamAElos[1 - i], avgB)
      ),
    },
    teamB: {
      eloBefore: teamBElos,
      avgElo: avgB,
      winProbability: teamWinProbability(diffA),
      playerProbabilities: teamBElos.map((elo, i) =>
        playerWinProbability(elo, teamBElos[1 - i], avgA)
      ),
    },
    eloDifference: diffA,
  };
}

/**
 * Elo final de un jugador tras el partido. Espejo de finalElo del backend.
 * @param {number} eloActual
 * @param {number} kFactor
 * @param {boolean} isWinner
 * @param {number} probability
 * @param {number|undefined} nota 0-10 (5 = neutro si se omite)
 */
export function previewFinalElo(eloActual, kFactor, isWinner, probability, nota) {
  const notaEfectiva = nota === undefined || nota === null ? 5 : nota;
  const raw =
    eloActual +
    kFactor * ((isWinner ? 1 : 0) - probability) +
    (notaEfectiva - 5) / 10;
  return clampElo(raw);
}

export { playerWinProbability };
