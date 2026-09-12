import EloHistory from '../models/EloHistory.js';
import Match from '../models/Match.js';
import Player from '../models/Player.js';
import Season from '../models/Season.js';
import { computeFinalElos, computePreMatch, ELO_K_FACTOR, clampElo } from './eloService.js';

function matchOrder(match) {
  const seasonTime = new Date(match.round?.season?.createdAt || 0).getTime();
  return [
    seasonTime,
    match.round?.number || 0,
    match.number || 0,
    new Date(match.createdAt || 0).getTime(),
  ];
}

function compareMatches(a, b) {
  const left = matchOrder(a);
  const right = matchOrder(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function roundNumber(match) {
  return match.round?.number || 0;
}

export async function rebuildRatings(removedMatchIds = []) {
  const [players, matches, seasons] = await Promise.all([
    Player.find(),
    Match.find({ winner: { $ne: null } }).populate({
      path: 'round',
      select: 'number season',
      populate: { path: 'season', select: 'createdAt baseEloByPlayer' },
    }),
    Season.find().sort({ createdAt: 1 }),
  ]);

  matches.sort(compareMatches);

  // Agrupamos los partidos por temporada conservando el orden de juego
  // (ronda y número de partido), clave para reconstruir la base por temporada.
  const matchesBySeason = new Map();
  for (const match of matches) {
    const seasonId = String(match.round?.season?._id ?? '');
    if (!seasonId) continue;
    const list = matchesBySeason.get(seasonId) || [];
    list.push(match);
    matchesBySeason.set(seasonId, list);
  }

  // currentElo "en vivo": se reconstruye partido a partido y sirve como base de
  // la siguiente temporada (= "último cambio de ELO de la temporada pasada").
  const eloByPlayer = new Map(players.map((player) => [player.id, player.initialElo]));
  const histories = [];

  // Reconstrucción por temporadas en orden cronológico, porque la base de
  // pretemporada de cada temporada depende del Elo acumulado de las anteriores.
  for (const season of seasons) {
    const seasonMatches = (matchesBySeason.get(String(season._id)) || []).sort(
      (a, b) => roundNumber(a) - roundNumber(b) || a.number - b.number
    );

    // BACKFILL de la base de pretemporada: las temporadas creadas con el
    // código anterior no guardan baseEloByPlayer (Ronda 2 caería al currentElo
    // acumulado y "contaría" la Ronda 1). Si falta el snapshot, lo
    // reconstruimos como el Elo acumulado en el momento de CREAR la temporada
    // (= el último Elo de la temporada pasada) y lo persistimos. A partir de
    // aquí, los partidos de la ronda 2 se calculan contra la MISMA base que la
    // ronda 1, sin tener en cuenta el cambio de la ronda anterior.
    const existingBase = season.baseEloByPlayer;
    const hasBase =
      existingBase != null &&
      (typeof existingBase.size === 'number'
        ? existingBase.size
        : Object.keys(existingBase).length) > 0;
    if (!hasBase) {
      const snapshot = Object.fromEntries(
        players.map((player) => [String(player._id), eloByPlayer.get(player.id)])
      );
      season.baseEloByPlayer = snapshot;
      await season.save();
    }

    const base = season.baseEloByPlayer;

    for (const match of seasonMatches) {
      const teamAIds = match.teamA.players.map(String);
      const teamBIds = match.teamB.players.map(String);
      // Elo de referencia: base FIJA de pretemporada de la temporada. Si un
      // jugador no tiene snapshot (dado de alta a mitad de temporada), se usa
      // su elo acumulado como base de cálculo.
      const refElo = (id) => {
        const baseElo = base?.get?.(id) ?? base?.[id];
        return baseElo ?? eloByPlayer.get(id);
      };
      const teamAElos = teamAIds.map(refElo);
      const teamBElos = teamBIds.map(refElo);

      if ([...teamAElos, ...teamBElos].some((elo) => elo === undefined)) {
        throw new Error(`El partido ${match.number} contiene un jugador inexistente`);
      }

      const pre = computePreMatch(teamAElos, teamBElos);
      const { teamAFinal, teamBFinal } = computeFinalElos(
        teamAElos,
        teamBElos,
        match.winner,
        ELO_K_FACTOR,
        match.teamA.notes,
        match.teamB.notes
      );

      match.teamA.eloBefore = teamAElos;
      match.teamA.avgElo = pre.teamA.avgElo;
      match.teamA.winProbability = pre.teamA.winProbability;
      match.teamB.eloBefore = teamBElos;
      match.teamB.avgElo = pre.teamB.avgElo;
      match.teamB.winProbability = pre.teamB.winProbability;
      match.eloDifference = pre.eloDifference;

      // La probabilidad y el DELTA de cada jugador salen de la base FIJA
      // (teamAFinal ya es "base + delta"). Pero el Elo que se persiste y se
      // acumula es el ACTUAL + deltas, para que el Historial muestre las sumas
      // correctas: 2.48 → 2.72 (R1) → 2.79 (R2), jamás un retroceso a 2.48.
      const acumular = (ids, beforeElos, finalElos) => {
        const salida = [];
        ids.forEach((id, i) => {
          const antes = eloByPlayer.get(id) ?? beforeElos[i];
          const despues = clampElo(antes + (finalElos[i] - beforeElos[i]));
          eloByPlayer.set(id, despues);
          salida.push({ antes, despues });
        });
        return salida;
      };
      const histA = acumular(teamAIds, teamAElos, teamAFinal);
      const histB = acumular(teamBIds, teamBElos, teamBFinal);

      match.teamA.eloAfter = histA.map((hist) => hist.despues);
      match.teamB.eloAfter = histB.map((hist) => hist.despues);
      await match.save();

      teamAIds.forEach((playerId, index) => {
        histories.push({
          player: playerId,
          season: season._id,
          match: match._id,
          eloBefore: histA[index].antes,
          eloAfter: histA[index].despues,
        });
      });
      teamBIds.forEach((playerId, index) => {
        histories.push({
          player: playerId,
          season: season._id,
          match: match._id,
          eloBefore: histB[index].antes,
          eloAfter: histB[index].despues,
        });
      });
    }
  }

  const historyMatchIds = [
    ...matches.map((match) => match._id),
    ...removedMatchIds,
  ];
  await EloHistory.deleteMany({ match: { $in: historyMatchIds } });
  if (histories.length > 0) await EloHistory.insertMany(histories);

  await Promise.all(
    players.map((player) =>
      Player.findByIdAndUpdate(player._id, {
        currentElo: eloByPlayer.get(player.id) ?? player.initialElo,
      })
    )
  );
}