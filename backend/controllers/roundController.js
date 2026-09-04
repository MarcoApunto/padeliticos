import Round from '../models/Round.js';

// GET /api/seasons/:seasonId/rounds
export const getAllForSeason = async (req, res) => {
  const rounds = await Round.find({ season: req.params.seasonId }).sort({
    number: 1,
  });
  res.json(rounds);
};

// POST /api/seasons/:seasonId/rounds
export const create = async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'number es obligatorio' });
  const round = await Round.create({ season: req.params.seasonId, number });
  res.status(201).json(round);
};

// DELETE /api/rounds/:id
export const remove = async (req, res) => {
  const round = await Round.findByIdAndDelete(req.params.id);
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });
  res.status(204).send();
};
