import Season from '../models/Season.js';
import Player from '../models/Player.js';

export const getAll = async (req, res) => {
  const seasons = await Season.find().sort({ createdAt: -1 });
  res.json(seasons);
};

export const getOne = async (req, res) => {
  const season = await Season.findById(req.params.id);
  if (!season) return res.status(404).json({ error: 'Temporada no encontrada' });
  res.json(season);
};

export const create = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name es obligatorio' });

  // Regla del Excel: la base de PRETEMPORADA de la temporada es un SNAPSHOT
  // del currentElo de cada jugador capturado AHORA (al crear la temporada) =
  // lo acumulado de la temporada anterior (initialElo en la primera). Esa base
  // queda FIJA para TODOS los partidos de la temporada: la Ronda 2 se calcula
  // contra la misma base que la Ronda 1 y NO tiene en cuenta lo ganado o
  // perdido en la Ronda 1. currentElo sigue acumulando deltas para el ranking
  // y para ser la base de la siguiente temporada.
  const players = await Player.find();
  const baseEloByPlayer = Object.fromEntries(
    players.map((player) => [String(player._id), player.currentElo])
  );

  const season = await Season.create({ name, baseEloByPlayer });
  res.status(201).json(season);
};

export const update = async (req, res) => {
  const { name } = req.body;
  const season = await Season.findByIdAndUpdate(
    req.params.id,
    { ...(name !== undefined && { name }) },
    { new: true, runValidators: true }
  );
  if (!season) return res.status(404).json({ error: 'Temporada no encontrada' });
  res.json(season);
};
