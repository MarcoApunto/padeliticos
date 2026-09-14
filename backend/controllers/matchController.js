import mongoose from 'mongoose';
import Match from '../models/Match.js';
import Round from '../models/Round.js';
import Season from '../models/Season.js';
import Player from '../models/Player.js';
import EloHistory from '../models/EloHistory.js';
import { computePreMatch, computeFinalElos, ELO_K_FACTOR, clampElo } from '../services/eloService.js';
import { rebuildRatings } from '../services/ratingService.js';
import { computePairStats } from '../services/matchStatsService.js';
import { HttpError } from '../errors.js';

// Valida las notas manuales (0-10) de un equipo. Sin notas = undefined.
function normalizeNotes(notes) {
  if (notes === undefined) return undefined;
  if (
    !Array.isArray(notes) ||
    notes.length !== 2 ||
    notes.some(
      (note) => typeof note !== 'number' || Number.isNaN(note) || note < 0 || note > 10
    )
  ) {
    throw new HttpError(400, 'Las notas deben ser dos números entre 0 y 10');
  }
  return notes;
}

// Valida el marcador por puntos (opcional). Si viene, no puede ser empate y
// debe corresponderse con el ganador.
function normalizeScore(score, winner) {
  if (score === undefined) return undefined;
  const teamA = Number(score?.teamA);
  const teamB = Number(score?.teamB);
  if (
    !Number.isInteger(teamA) ||
    !Number.isInteger(teamB) ||
    teamA < 0 ||
    teamB < 0
  ) {
    throw new HttpError(400, 'score debe incluir teamA y teamB como enteros ≥ 0');
  }
  if (teamA === teamB) {
    throw new HttpError(400, 'El marcador no puede ser un empate');
  }
  if ((winner === 1) !== teamA > teamB) {
    throw new HttpError(400, 'El marcador no coincide con el equipo ganador');
  }
  return { teamA, teamB };
}

// Valida el número de partido y las dos parejas, carga a los jugadores y
// calcula los campos previos (media, probabilidad, diferencia de elo).
// Reutilizado por create y updatePending para no duplicar lógica.
//
// IMPORTANTE (regla del Excel): el Elo de referencia de los partidos NO es el
// currentElo acumulado (que progresaría ronda a ronda), sino la base FIJA de
// PRETEMPORADA de la temporada (season.baseEloByPlayer). El snapshot se captura
// al CREAR la temporada (= lo acumulado de la temporada anterior). Así la
// Ronda 2 se calcula contra la misma base que la Ronda 1: lo ganado o perdido
// en la Ronda 1 NO se tiene en cuenta en la Ronda 2. currentElo (del jugador)
// sigue acumulando los deltas para el ranking y para ser la base de la
// siguiente temporada.
async function resolveTeamData(number, teamA, teamB, baseEloByPlayer) {
  if (
    !Number.isInteger(Number(number)) ||
    Number(number) < 1 ||
    teamA?.players?.length !== 2 ||
    teamB?.players?.length !== 2
  ) {
    throw new HttpError(
      400,
      'number, teamA.players (2) y teamB.players (2) son obligatorios'
    );
  }

  const playerIds = [...teamA.players, ...teamB.players];
  if (new Set(playerIds.map(String)).size !== 4) {
    throw new HttpError(400, 'Los cuatro jugadores deben ser distintos');
  }
  const players = await Player.find({ _id: { $in: playerIds } });
  if (players.length !== 4) {
    throw new HttpError(400, 'Alguno de los jugadores no existe');
  }

  // Elo de referencia: base de PRETEMPORADA de la temporada. Si un jugador no
  // tiene snapshot (temporada antigua creada sin base o jugador dado de alta a
  // mitad de temporada), se usa su currentElo como base de cálculo; así nunca
  // se rompe la vista ni el cálculo para datos antiguos.
  const eloById = Object.fromEntries(
    players.map((player) => {
      const base = baseEloByPlayer?.get?.(player.id) ?? baseEloByPlayer?.[player.id];
      return [player.id, base ?? player.currentElo];
    })
  );

  const teamAElos = teamA.players.map((id) => eloById[id]);
  const teamBElos = teamB.players.map((id) => eloById[id]);
  const pre = computePreMatch(teamAElos, teamBElos);

  return {
    number: Number(number),
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
  };
}

function apiError(err) {
  return err.status || (err.name === 'ValidationError' ? 400 : 500);
}

// GET /api/rounds/:roundId/matches
export const getAllForRound = async (req, res) => {
  const matches = await Match.find({ round: req.params.roundId })
    .populate('teamA.players', 'name currentElo')
    .populate('teamB.players', 'name currentElo')
    .sort({ number: 1 });
  res.json(matches);
};

// GET /api/matches?seasonId=&roundId=&status=
// Historial global de partidos jugados, más recientes primero.
// Con status=pending devuelve los partidos SIN resultado (para la vista de
// apuestas/cuotas), ordenados por temporada → ronda → número de partido.
export const getAll = async (req, res) => {
  const { seasonId, roundId, status } = req.query;
  const pending = status === 'pending';

  const filter = pending ? { winner: null } : { winner: { $ne: null } };
  if (roundId) filter.round = roundId;

  let matches = await Match.find(filter)
    .populate('teamA.players', 'name currentElo')
    .populate('teamB.players', 'name currentElo')
    .populate({
      path: 'round',
      select: 'number season',
      populate: { path: 'season', select: 'name createdAt' },
    });

  if (seasonId) {
    matches = matches.filter(
      (match) => match.round?.season?._id?.toString() === seasonId
    );
  }

  matches.sort(
    pending
      ? (a, b) => {
          const aSeason = new Date(
            a.round?.season?.createdAt || 0
          ).getTime();
          const bSeason = new Date(
            b.round?.season?.createdAt || 0
          ).getTime();
          return (
            aSeason - bSeason ||
            (a.round?.number || 0) - (b.round?.number || 0) ||
            a.number - b.number
          );
        }
      : (a, b) => new Date(b.playedAt) - new Date(a.playedAt)
  );

  res.json(matches);
};

// GET /api/matches/pair-stats
// Histórico (partidos, V/D) de cada PAREJA concreta en partidos ya jugados.
// La clave es "idJugador1|idJugador2" con los ids ordenados.
export const getPairStats = async (req, res) => {
  const matches = await Match.find({ winner: { $ne: null } })
    .select('winner teamA.players teamB.players')
    .lean();
  res.json(computePairStats(matches));
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

  const round = await Round.findById(req.params.roundId).populate('season');
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });

  try {
    const baseEloByPlayer = round.season?.baseEloByPlayer;
    const data = await resolveTeamData(number, teamA, teamB, baseEloByPlayer);
    const match = await Match.create({ round: req.params.roundId, ...data });

    res.status(201).json(match);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: 'Ese número de partido ya existe en la ronda' });
    }
    throw err;
  }
};

// PUT /api/matches/:id
// Permite corregir las parejas o el número mientras el partido siga pendiente.
export const updatePending = async (req, res) => {
  const { number, teamA, teamB } = req.body;

  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (match.winner) {
    return res.status(409).json({
      error: 'Solo se pueden editar partidos sin resultado',
    });
  }

  try {
    const round = await Round.findById(match.round).populate('season');
    const base = round?.season?.baseEloByPlayer;
    const data = await resolveTeamData(number, teamA, teamB, base);
    match.number = data.number;
    match.teamA = data.teamA;
    match.teamB = data.teamB;
    match.eloDifference = data.eloDifference;
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
  const { winner, teamANotes, teamBNotes, score } = req.body;
  if (winner !== 1 && winner !== 2) {
    return res.status(400).json({ error: 'winner debe ser 1 o 2' });
  }

  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    if (!match.winner) {
      return res.status(409).json({
        error: 'El partido aún no tiene resultado; usa la acción de cerrar partido',
      });
    }

    match.winner = winner;
    if (teamANotes !== undefined) match.teamA.notes = normalizeNotes(teamANotes);
    if (teamBNotes !== undefined) match.teamB.notes = normalizeNotes(teamBNotes);
    if (score !== undefined) match.score = normalizeScore(score, winner);
    match.playedAt = match.playedAt || new Date();
    await match.save();
    await rebuildRatings();

    const updated = await Match.findById(match._id)
      .populate('teamA.players', 'name currentElo')
      .populate('teamB.players', 'name currentElo');
    res.json(updated);
  } catch (err) {
    res.status(apiError(err)).json({ error: err.message || 'Error interno' });
  }
};

// PATCH /api/matches/:id/result
// body: { winner: 1|2, teamANotes?: [n,n], teamBNotes?: [n,n], score?: {teamA, teamB} }
// Cierra el partido: calcula el elo final de los 4 jugadores, actualiza
// Player.currentElo y deja constancia en EloHistory. Todo en una transacción.
export const setResult = async (req, res) => {
  const { winner, teamANotes, teamBNotes, score } = req.body;
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

      // Elo ACTUAL ("en vivo" acumulado) de los 4 jugadores, para sumar el
      // delta de este partido encima y que el Historial muestre las sumas.
      const playerIds = [
        ...match.teamA.players.map(String),
        ...match.teamB.players.map(String),
      ];
      const currentPlayers = await Player.find({ _id: { $in: playerIds } }).session(
        session
      );
      const currentEloByPlayer = new Map(
        currentPlayers.map((player) => [player.id, player.currentElo])
      );

      // El delta de cada jugador sale de la base FIJA de pretemporada
      // (match.eloBefore), pero el Elo que se persiste es ACTUAL + delta.
      const acumular = (ids, beforeElos, finalElos) =>
        ids.map((id, i) => {
          const antes = currentEloByPlayer.get(id) ?? beforeElos[i];
          const despues = clampElo(antes + (finalElos[i] - beforeElos[i]));
          return { playerId: id, eloBefore: antes, eloAfter: despues };
        });
      const updatesA = acumular(
        match.teamA.players.map(String),
        match.teamA.eloBefore,
        teamAFinal
      );
      const updatesB = acumular(
        match.teamB.players.map(String),
        match.teamB.eloBefore,
        teamBFinal
      );
      const updates = [...updatesA, ...updatesB];

      // Resultado del PARTIDO anclado a la base FIJA (2.00 → 2.24): el DELTA
      // sale de la base de pretemporada (match.eloBefore), no del acumulado.
      match.winner = winner;
      match.playedAt = new Date();
      match.teamA.eloAfter = teamAFinal;
      match.teamB.eloAfter = teamBFinal;
      if (teamANotes !== undefined) match.teamA.notes = normalizeNotes(teamANotes);
      if (teamBNotes !== undefined) match.teamB.notes = normalizeNotes(teamBNotes);
      if (score !== undefined) match.score = normalizeScore(score, winner);
      await match.save({ session });

      // El HISTORIAL y currentElo SÍ acumulan los deltas (2.00 → 1.78 → 2.02),
      // clampeados al rango. Ese acumulado final es la base de la próxima season.

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

    await rebuildRatings();
    res.json(result);
  } catch (err) {
    res.status(apiError(err)).json({ error: err.message || 'Error interno' });
  } finally {
    session.endSession();
  }
};
