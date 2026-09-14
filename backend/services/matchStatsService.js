/**
 * Histórico por PAREJA (los mismos 2 jugadores juntos) en partidos ya jugados.
 * Se usa en la vista de apuestas para mostrar cómo le ha ido a esa pareja
 * concreta, al margen del elo.
 */

/**
 * Cuenta partidos, victorias y derrotas de cada pareja agrupando por los ids
 * de sus jugadores (ordenados, para que "A+B" y "B+A" sean la misma clave).
 * @param {{winner: 1|2|null, teamA: {players: {_id}[]}, teamB: {players: {_id}[]}}[]} playedMatches
 * @returns {Record<string, {played: number, wins: number, losses: number}>}
 */
export function computePairStats(playedMatches) {
  const stats = new Map();

  for (const match of playedMatches) {
    let sides;
    if (match.winner === 1) {
      sides = [
        { team: match.teamA, won: true },
        { team: match.teamB, won: false },
      ];
    } else if (match.winner === 2) {
      sides = [
        { team: match.teamB, won: true },
        { team: match.teamA, won: false },
      ];
    } else {
      continue;
    }

    for (const { team, won } of sides) {
      const key = team.players
        .map((p) => String(p._id ?? p))
        .sort()
        .join('|');
      const entry = stats.get(key) || { played: 0, wins: 0, losses: 0 };
      entry.played += 1;
      if (won) entry.wins += 1;
      else entry.losses += 1;
      stats.set(key, entry);
    }
  }

  return Object.fromEntries(stats);
}