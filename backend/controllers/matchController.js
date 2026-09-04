import mongoose from 'mongoose';
import Match from '../models/Match.js';
import Round from '../models/Round.js';
import Season from '../models/Season.js';
import Player from '../models/Player.js';
import EloHistory from '../models/EloHistory.js';
import { computePreMatch, computeFinalElos, ELO_K_FACTOR } from '../services/eloService.js';
import { rebuildRatings } from '../services/ratingService.js';

// GET /api/rounds/:roundId/matches
export const getAllForRound = async (req, res) => {
  const matches = await Match.find({ round: req.params.roundId })
    .populate('teamA.players', 'name currentElo')
    .populate('teamB.players', 'name currentElo')
    .sort({ number: 1 });
  res.json(matches);
};

// GET /api/matches?seasonId=&roundId=
// Historial global de partidos jugados, más recientes primero.
export const getAll = async (req, res) => {
  const { seasonId, roundId } = req.query;

  const filter = { winner: { $ne: null } };
  if (roundId) filter.round = roundId;

  let matches = await Match.find(filter)
    .populate('teamA.players', 'name')
    .populate('teamB.players', 'name')
    .populate({
      path: 'round',
      select: 'number season',
      populate: { path: 'season', select: 'name' },
    })
    .sort({ playedAt: -1 });

  if (seasonId) {
    matches = matches.filter(
      (match) => match.round?.season?._id?.toString() === seasonId
    );
  }

  res.json(matches);
};

// GET /api/matches/:id
export const getOne = async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate('teamA.players', 'name currentElo')
    .populate('teamB.players', 'name currentElo');
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  res.json(match);
};

// POST /api/rounds/:roundId/matches
// body: { number, teamA: { players: [id, id] }, teamB: { players: [id, id] } }
// Crea el partido con los campos calculables ya rellenos (media, probabilidad,
// diferencia de elo), igual que el Excel se autocompleta antes de fijar el ganador.
export const create = async (req, res) => {
  const { number, teamA, teamB } = req.body;

  if (
    !Number.isInteger(Number(number)) ||
    Number(number) < 1 ||
    teamA?.players?.length !== 2 ||
    teamB?.players?.length !== 2
  ) {
    return res.status(400).json({
      error: 'number, teamA.players (2) y teamB.players (2) son obligatorios',
    });
  }

  const round = await Round.findById(req.params.roundId);
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });

  const playerIds = [...teamA.players, ...teamB.players];
  const players = await Player.find({ _id: { $in: playerIds } });
  if (players.length !== 4) {
    return res.status(400).json({ error: 'Alguno de los jugadores no existe' });
  }
  const eloById = Object.fromEntries(players.map((p) => [p.id, p.currentElo]));

  const teamAElos = teamA.players.map((id) => eloById[id]);
  const teamBElos = teamB.players.map((id) => eloById[id]);

  const pre = computePreMatch(teamAElos, teamBElos);

  const match = await Match.create({
    round: req.params.roundId,
    number,
    teamA: {
      players: teamA.players,
      eloBefore: teamAElos,
      avgElo: pre.teamA.avgElo,
      winProbability: pre.teamA.winProbability,
    },
    teamB: {
      players: teamB.players,
      eloBefore: teamBElos,
      avgElo: pre.teamB.avgElo,
      winProbability: pre.teamB.winProbability,
    },
    eloDifference: pre.eloDifference,
  });

  res.status(201).json(match);
};

// PUT /api/matches/:id
// Permite corregir las parejas o el número mientras el partido siga pendiente.
export const updatePending = async (req, res) => {
  const { number, teamA, teamB } = req.body;
  if (
    !Number.isInteger(Number(number)) ||
    Number(number) < 1 ||
    teamA?.players?.length !== 2 ||
    teamB?.players?.length !== 2
  ) {
    return res.status(400).json({
      error: 'number, teamA.players (2) y teamB.players (2) son obligatorios',
    });
  }

  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (match.winner) {
    return res.status(409).json({
      error: 'Solo se pueden editar partidos sin resultado',
    });
  }

  const playerIds = [...teamA.players, ...teamB.players];
  if (new Set(playerIds.map(String)).size !== 4) {
    return res.status(400).json({ error: 'Los cuatro jugadores deben ser distintos' });
  }
  const players = await Player.find({ _id: { $in: playerIds } });
  if (players.length !== 4) {
    return res.status(400).json({ error: 'Alguno de los jugadores no existe' });
  }

  const eloById = Object.fromEntries(players.map((player) => [player.id, player.currentElo]));
  const teamAElos = teamA.players.map((id) => eloById[id]);
  const teamBElos = teamB.players.map((id) => eloById[id]);
  const pre = computePreMatch(teamAElos, teamBElos);

  match.number = number;
  match.teamA = {
    players: teamA.players,
    eloBefore: teamAElos,
    avgElo: pre.teamA.avgElo,
    winProbability: pre.teamA.winProbability,
  };
  match.teamB = {
    players: teamB.players,
    eloBefore: teamBElos,
    avgElo: pre.teamB.avgElo,
    winProbability: pre.teamB.winProbability,
  };
  match.eloDifference = pre.eloDifference;
  try {
    await match.save();
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ese número ya existe en la ronda' });
    }
    throw err;
  }

  const updated = await Match.findById(match._id)
    .populate('teamA.players', 'name currentElo')
    .populate('teamB.players', 'name currentElo');
  res.json(updated);
};

// PUT /api/matches/:id/result
// Corrige el resultado de un partido ya jugado y reconstruye el Elo posterior.
export const updateResult = async (req, res) => {
  const { winner, teamANotes, teamBNotes } = req.body;
  if (winner !== 1 && winner !== 2) {
    return res.status(400).json({ error: 'winner debe ser 1 o 2' });
  }

  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (!match.winner) {
    return res.status(409).json({
      error: 'El partido aún no tiene resultado; usa la acción de cerrar partido',
    });
  }

  match.winner = winner;
  if (teamANotes !== undefined) match.teamA.notes = teamANotes;
  if (teamBNotes !== undefined) match.teamB.notes = teamBNotes;
  match.playedAt = match.playedAt || new Date();
  await match.save();
  await rebuildRatings();

  const updated = await Match.findById(match._id)
    .populate('teamA.players', 'name currentElo')
    .populate('teamB.players', 'name currentElo');
  res.json(updated);
};

// PATCH /api/matches/:id/result
// body: { winner: 1|2, teamANotes?: [n,n], teamBNotes?: [n,n] }
// Cierra el partido: calcula el elo final de los 4 jugadores, actualiza
// Player.currentElo y deja constancia en EloHistory. Todo en una transacción.
export const setResult = async (req, res) => {
  const { winner, teamANotes, teamBNotes } = req.body;
  if (winner !== 1 && winner !== 2) {
    return res.status(400).json({ error: 'winner debe ser 1 o 2' });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const match = await Match.findById(req.params.id).session(session);
      if (!match) throw { status: 404, message: 'Partido no encontrado' };
      if (match.winner) throw { status: 409, message: 'El partido ya tiene resultado' };

      const round = await Round.findById(match.round).session(session);
      const season = await Season.findById(round.season).session(session);

      const { teamAFinal, teamBFinal } = computeFinalElos(
        match.teamA.eloBefore,
        match.teamB.eloBefore,
        winner,
        ELO_K_FACTOR,
        teamANotes,
        teamBNotes
      );

      match.winner = winner;
      match.playedAt = new Date();
      match.teamA.eloAfter = teamAFinal;
      match.teamB.eloAfter = teamBFinal;
      if (teamANotes) match.teamA.notes = teamANotes;
      if (teamBNotes) match.teamB.notes = teamBNotes;
      await match.save({ session });

      // Actualiza el elo "en vivo" de cada jugador + registra el historial.
      const updates = [
        ...match.teamA.players.map((playerId, i) => ({
          playerId,
          eloBefore: match.teamA.eloBefore[i],
          eloAfter: teamAFinal[i],
        })),
        ...match.teamB.players.map((playerId, i) => ({
          playerId,
          eloBefore: match.teamB.eloBefore[i],
          eloAfter: teamBFinal[i],
        })),
      ];

      for (const u of updates) {
        await Player.findByIdAndUpdate(
          u.playerId,
          { currentElo: u.eloAfter },
          { session, runValidators: true }
        );
        await EloHistory.create(
          [
            {
              player: u.playerId,
              season: round.season,
              match: match._id,
              eloBefore: u.eloBefore,
              eloAfter: u.eloAfter,
            },
          ],
          { session }
        );
      }

      result = match;
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  } finally {
    session.endSession();
  }
};

// DELETE /api/matches/:id
// Solo se permite borrar partidos SIN resultado, para no descuadrar el ranking.
export const remove = async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (match.winner) {
    return res.status(409).json({
      error: 'No se puede borrar un partido ya jugado (afectaría al ranking)',
    });
  }
  await match.deleteOne();
  res.status(204).send();
};
