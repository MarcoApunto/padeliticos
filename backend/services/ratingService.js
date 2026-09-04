import EloHistory from '../models/EloHistory.js';
import Match from '../models/Match.js';
import Player from '../models/Player.js';
import { computeFinalElos, computePreMatch, ELO_K_FACTOR } from './eloService.js';

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

export async function rebuildRatings(removedMatchIds = []) {
  const [players, matches] = await Promise.all([
    Player.find(),
    Match.find({ winner: { $ne: null } }).populate({
      path: 'round',
      select: 'number season',
      populate: { path: 'season', select: 'createdAt' },
    }),
  ]);

  matches.sort(compareMatches);
  const eloByPlayer = new Map(players.map((player) => [player.id, player.initialElo]));
  const histories = [];

  for (const match of matches) {
    const teamAIds = match.teamA.players.map(String);
    const teamBIds = match.teamB.players.map(String);
    const teamAElos = teamAIds.map((id) => eloByPlayer.get(id));
    const teamBElos = teamBIds.map((id) => eloByPlayer.get(id));

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
    match.teamA.eloAfter = teamAFinal;
    match.teamB.eloBefore = teamBElos;
    match.teamB.avgElo = pre.teamB.avgElo;
    match.teamB.winProbability = pre.teamB.winProbability;
    match.teamB.eloAfter = teamBFinal;
    match.eloDifference = pre.eloDifference;
    await match.save();

    teamAIds.forEach((playerId, index) => {
      histories.push({
        player: playerId,
        season: match.round.season._id,
        match: match._id,
        eloBefore: teamAElos[index],
        eloAfter: teamAFinal[index],
      });
      eloByPlayer.set(playerId, teamAFinal[index]);
    });
    teamBIds.forEach((playerId, index) => {
      histories.push({
        player: playerId,
        season: match.round.season._id,
        match: match._id,
        eloBefore: teamBElos[index],
        eloAfter: teamBFinal[index],
      });
      eloByPlayer.set(playerId, teamBFinal[index]);
    });
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