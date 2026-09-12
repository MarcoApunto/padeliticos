import Round from '../models/Round.js';

// GET /api/seasons/:seasonId/rounds
export const getAllForSeason = async (req, res) => {
  // Poblamos la season para que el cliente (CourtBuilder) tenga disponible la
  // baseEloByPlayer de PRETEMPORADA y pueda previsualizar la Ronda 2 igual que
  // el backend: cada jugador contra SU base fija, nunca contra el elo actual.
  const rounds = await Round.find({ season: req.params.seasonId })
    .populate('season', 'name baseEloByPlayer')
    .sort({ number: 1 });
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
