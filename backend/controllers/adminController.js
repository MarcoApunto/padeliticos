import Match from '../models/Match.js';
import Player from '../models/Player.js';
import Round from '../models/Round.js';
import Season from '../models/Season.js';

export const check = (req, res) => res.json({ ok: true });

export const updatePlayer = async (req, res) => {
  const { name, currentElo, initialElo, active } = req.body;
  const player = await Player.findByIdAndUpdate(
    req.params.id,
    {
      ...(name !== undefined && { name }),
      ...(currentElo !== undefined && { currentElo: Number(currentElo) }),
      ...(initialElo !== undefined && { initialElo: Number(initialElo) }),
      ...(active !== undefined && { active }),
    },
    { new: true, runValidators: true }
  );
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
  res.json(player);
};

export const removePlayer = async (req, res) => {
  const player = await Player.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  );
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
  res.json(player);
};

export const updateSeason = async (req, res) => {
  const { name, startDate, endDate, closed } = req.body;
  const season = await Season.findByIdAndUpdate(
    req.params.id,
    {
      ...(name !== undefined && { name }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      ...(closed !== undefined && { closed }),
    },
    { new: true, runValidators: true }
  );
  if (!season) return res.status(404).json({ error: 'Temporada no encontrada' });
  res.json(season);
};

export const removeSeason = async (req, res) => {
  const roundCount = await Round.countDocuments({ season: req.params.id });
  if (roundCount > 0) {
    return res.status(409).json({
      error: 'No se puede borrar una temporada que contiene rondas',
    });
  }
  const season = await Season.findByIdAndDelete(req.params.id);
  if (!season) return res.status(404).json({ error: 'Temporada no encontrada' });
  res.status(204).send();
};

export const updateRound = async (req, res) => {
  const { number } = req.body;
  const parsedNumber = Number(number);
  if (!Number.isInteger(parsedNumber) || parsedNumber < 1) {
    return res.status(400).json({ error: 'number debe ser un entero positivo' });
  }
  const round = await Round.findByIdAndUpdate(
    req.params.id,
    { number: parsedNumber },
    { new: true, runValidators: true }
  );
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });
  res.json(round);
};

export const removeRound = async (req, res) => {
  const matchCount = await Match.countDocuments({ round: req.params.id });
  if (matchCount > 0) {
    return res.status(409).json({
      error: 'No se puede borrar una ronda que contiene partidos',
    });
  }
  const round = await Round.findByIdAndDelete(req.params.id);
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });
  res.status(204).send();
};

export const removePendingMatch = async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (match.winner) {
    return res.status(409).json({
      error: 'Solo se pueden borrar partidos sin resultado',
    });
  }
  await match.deleteOne();
  res.status(204).send();
};

export const updatePendingMatch = async (req, res) => {
  const { number } = req.body;
  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (match.winner) {
    return res.status(409).json({
      error: 'Solo se pueden editar partidos sin resultado',
    });
  }
  const parsedNumber = Number(number);
  if (!Number.isInteger(parsedNumber) || parsedNumber < 1) {
    return res.status(400).json({ error: 'number debe ser un entero positivo' });
  }

  match.number = parsedNumber;
  try {
    await match.save();
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ese número ya existe en la ronda' });
    }
    throw err;
  }
  res.json(match);
};