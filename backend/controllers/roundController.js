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
  try {
    const round = await Round.create({ season: req.params.seasonId, number });
    res.status(201).json(round);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: 'Esa ronda ya existe en la temporada' });
    }
    throw err;
  }
};
