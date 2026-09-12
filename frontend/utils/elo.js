// Espejo, solo para previsualización en el cliente, de la lógica que vive
// de verdad en el backend (services/eloService.js). El resultado que se
// persiste siempre lo calcula y valida el servidor.

export const ELO_MIN = 0.5;
export const ELO_MAX = 7;
export const ELO_K_FACTOR = 0.5;
export const PARTNER_WEIGHT = 0.4;

export function clampElo(elo) {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, elo));
}

function teamWinProbability(rivalEloDifference) {
  return 1 / (1 + 10 ** (rivalEloDifference / 4));
}

function playerWinProbability(eloPlayer, eloPartner, rivalTeamAvg) {
  const blended = (1 - PARTNER_WEIGHT) * eloPlayer + PARTNER_WEIGHT * eloPartner;
  return 1 / (1 + 10 ** ((rivalTeamAvg - blended) / 4));
}

export function previewMatch(teamAElos, teamBElos) {
  const avgA = (teamAElos[0] + teamAElos[1]) / 2;
  const avgB = (teamBElos[0] + teamBElos[1]) / 2;
  const diffA = avgA - avgB;
  const diffB = avgB - avgA;

  return {
    teamA: {
      avgElo: avgA,
      winProbability: teamWinProbability(diffB),
      playerProbabilities: teamAElos.map((elo, i) =>
        playerWinProbability(elo, teamAElos[1 - i], avgB)
      ),
    },
    teamB: {
      avgElo: avgB,
      winProbability: teamWinProbability(diffA),
      playerProbabilities: teamBElos.map((elo, i) =>
        playerWinProbability(elo, teamBElos[1 - i], avgA)
      ),
    },
    eloDifference: diffA,
  };
}

export function previewFinalElo(eloActual, kFactor, isWinner, probability, nota) {
  const notaEfectiva = nota === undefined || nota === null ? 5 : nota;
  const raw =
    eloActual + kFactor * ((isWinner ? 1 : 0) - probability) + (notaEfectiva - 5) / 10;
  return clampElo(raw);
}
