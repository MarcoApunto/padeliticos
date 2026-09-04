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
  const player = await Player.create({
    name,
    initialElo,
    currentElo: initialElo, // arranca igual que su elo inicial
  });
  res.status(201).json(player);
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

// DELETE /api/players/:id
export const remove = async (req, res) => {
  const player = await Player.findByIdAndDelete(req.params.id);
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
  res.status(204).send();
};

// GET /api/players/:id/history — evolución de elo del jugador + detalle de cada partido
export const getHistory = async (req, res) => {
  const history = await EloHistory.find({ player: req.params.id })
    .populate('season', 'name')
    .populate({
      path: 'match',
      select: 'number round winner playedAt teamA teamB',
      populate: [
        {
          path: 'round',
          select: 'number season',
          populate: { path: 'season', select: 'name' },
        },
        { path: 'teamA.players', select: 'name' },
        { path: 'teamB.players', select: 'name' },
      ],
    })
    .sort({ createdAt: 1 });

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
      },
    };
  });

  res.json(enriched);
};
