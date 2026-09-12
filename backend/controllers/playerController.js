import Player from '../models/Player.js';
import EloHistory from '../models/EloHistory.js';
import { ELO_MIN, ELO_MAX } from '../services/eloService.js';

// GET /api/players
export const getAll = async (req, res) => {
  const players = await Player.find().sort({ currentElo: -1 });
  res.json(players);
};

// GET /api/players/:id
export const getOne = async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
  res.json(player);
};

// POST /api/players
export const create = async (req, res) => {
  const { name, initialElo } = req.body;
  if (!name || initialElo === undefined) {
    return res
      .status(400)
      .json({ error: 'name e initialElo son obligatorios' });
  }
  if (initialElo < ELO_MIN || initialElo > ELO_MAX) {
    return res.status(400).json({
      error: `initialElo debe estar entre ${ELO_MIN} y ${ELO_MAX}`,
    });
  }
  try {
    const player = await Player.create({
      name,
      initialElo,
      currentElo: initialElo, // arranca igual que su elo inicial
    });
    res.status(201).json(player);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ya existe un jugador con ese nombre' });
    }
    throw err;
  }
};

// PUT /api/players/:id
export const update = async (req, res) => {
  const { name, active } = req.body;
  // currentElo e initialElo NO se editan a mano: solo cambian vía partidos,
  // para no romper la trazabilidad del historial.
  const player = await Player.findByIdAndUpdate(
    req.params.id,
    { ...(name && { name }), ...(active !== undefined && { active }) },
    { new: true, runValidators: true }
  );
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
  res.json(player);
};

// DELETE /api/players/:id — baja lógica para conservar historial y referencias
export const remove = async (req, res) => {
  const player = await Player.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  );
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
  res.json(player);
};

// GET /api/players/:id/history — evolución de elo del jugador + detalle de cada partido
export const getHistory = async (req, res) => {
  const history = await EloHistory.find({ player: req.params.id })
    .populate('season', 'name createdAt')
    .populate({
      path: 'match',
      select: 'number round winner playedAt teamA teamB score',
      populate: [
        {
          path: 'round',
          select: 'number season',
          populate: { path: 'season', select: 'name createdAt' },
        },
        { path: 'teamA.players', select: 'name' },
        { path: 'teamB.players', select: 'name' },
      ],
    });

  const enriched = history.map((entry) => {
    const match = entry.match;
    if (!match) return entry.toObject();

    const isTeamA = match.teamA.players.some(
      (player) => player._id.toString() === req.params.id
    );
    const ownTeam = isTeamA ? match.teamA : match.teamB;
    const rivalTeam = isTeamA ? match.teamB : match.teamA;
    const partner = ownTeam.players.find(
      (player) => player._id.toString() !== req.params.id
    );
    const won = match.winner === (isTeamA ? 1 : 2);

    return {
      ...entry.toObject(),
      match: {
        _id: match._id,
        number: match.number,
        round: match.round,
        playedAt: match.playedAt,
        partner: partner ? { _id: partner._id, name: partner.name } : null,
        opponents: rivalTeam.players.map((player) => ({
          _id: player._id,
          name: player.name,
        })),
        won,
        score:
          match.score?.teamA != null && match.score?.teamB != null
            ? match.score
            : undefined,
      },
    };
  });

  const ordered = [...enriched].sort((a, b) => {
    const aSeasonCreatedAt = new Date(
      a.match?.round?.season?.createdAt || a.season?.createdAt || 0
    ).getTime();
    const bSeasonCreatedAt = new Date(
      b.match?.round?.season?.createdAt || b.season?.createdAt || 0
    ).getTime();
    const aRound = Number(a.match?.round?.number || 0);
    const bRound = Number(b.match?.round?.number || 0);
    const aMatchNumber = Number(a.match?.number || 0);
    const bMatchNumber = Number(b.match?.number || 0);
    const aPlayedAt = new Date(a.match?.playedAt || a.createdAt || 0).getTime();
    const bPlayedAt = new Date(b.match?.playedAt || b.createdAt || 0).getTime();

    return (
      aSeasonCreatedAt - bSeasonCreatedAt ||
      aRound - bRound ||
      aMatchNumber - bMatchNumber ||
      aPlayedAt - bPlayedAt
    );
  });

  res.json(ordered);
};

// Clave de ordenación cronológica, igual que en getHistory: temporada →
// ronda → partido → fecha de juego.
function historyKey(match) {
  return [
    new Date(match?.round?.season?.createdAt || 0).getTime(),
    match?.round?.number || 0,
    match?.number || 0,
    new Date(match?.playedAt || 0).getTime(),
  ];
}

// Resumen de jugador en el mismo formato que mostraba la página de jugadores:
// partidos jugados, victorias/derrotas y racha actual. La racha se calcula
// desde el partido más reciente hacia atrás.
function summarizeHistory(histories) {
  const sorted = [...histories].sort((a, b) => {
    const keyA = historyKey(a.match);
    const keyB = historyKey(b.match);
    for (let i = 0; i < keyA.length; i += 1) {
      if (keyA[i] !== keyB[i]) return keyA[i] - keyB[i];
    }
    return 0;
  });

  const wins = sorted.filter((entry) => entry.won).length;

  let streak = 0;
  let streakType = null;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const won = sorted[i].won;
    if (streakType === null) streakType = won;
    if (won !== streakType) break;
    streak += 1;
  }

  return {
    played: sorted.length,
    wins,
    losses: sorted.length - wins,
    streak,
    streakType,
  };
}

// GET /api/players/stats
// Resumen (partidos, V/D y racha) de todos los jugadores en una sola petición,
// en vez de pedir el historial de cada uno por separado.
export const getStats = async (req, res) => {
  const histories = await EloHistory.find()
    .select('player match')
    .populate({
      path: 'match',
      select: 'winner playedAt number teamA teamB',
      populate: [
        {
          path: 'round',
          select: 'number season createdAt',
          populate: { path: 'season', select: 'createdAt' },
        },
        { path: 'teamA.players', select: '_id' },
        { path: 'teamB.players', select: '_id' },
      ],
    })
    .lean();

  const byPlayer = new Map();
  for (const entry of histories) {
    const match = entry.match;
    if (!match || match.winner == null) continue;
    const playerId = String(entry.player);
    const winningTeam = match.winner === 1 ? match.teamA : match.teamB;
    const won = (winningTeam?.players || []).some(
      (player) => String(player._id) === playerId
    );
    if (!byPlayer.has(playerId)) byPlayer.set(playerId, []);
    byPlayer.get(playerId).push({ match, won });
  }

  const stats = {};
  for (const [playerId, entries] of byPlayer) {
    stats[playerId] = summarizeHistory(entries);
  }
  res.json(stats);
};
