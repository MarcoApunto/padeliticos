import Season from '../models/Season.js';

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
  const { name, kFactor } = req.body;
  if (!name) return res.status(400).json({ error: 'name es obligatorio' });
  const season = await Season.create({
    name,
    kFactor: kFactor ?? 0.5,
  });
  res.status(201).json(season);
};

export const update = async (req, res) => {
  const season = await Season.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!season) return res.status(404).json({ error: 'Temporada no encontrada' });
  res.json(season);
};

export const remove = async (req, res) => {
  const season = await Season.findByIdAndDelete(req.params.id);
  if (!season) return res.status(404).json({ error: 'Temporada no encontrada' });
  res.status(204).send();
};
