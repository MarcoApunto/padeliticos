import Bettor from '../models/Bettor.js';
import Bet from '../models/Bet.js';
import Match from '../models/Match.js';
import { reservedAmount } from '../services/betService.js';
import { HttpError } from '../errors.js';

// Proyección y poblado común de una apuesta para el frontend.
function populatedBet(query) {
  return query
    .populate('bettor', 'name balance active')
    .populate({
      path: 'match',
      select: 'number winner teamA teamB winProbability round',
      populate: [
        { path: 'teamA.players', select: 'name' },
        { path: 'teamB.players', select: 'name' },
        {
          path: 'round',
          select: 'number season',
          populate: { path: 'season', select: 'name' },
        },
      ],
    });
}

// GET /api/bets/check — la propia ruta ya valida x-bets-key (router.use).
export const check = (req, res) => res.json({ ok: true });

// GET /api/bets/bettors
export const getBettors = async (req, res) => {
  const bettors = await Bettor.find().sort({ balance: -1 });
  res.json(bettors);
};

// POST /api/bets/bettors
// body: { name, initialBalance? }
// Si initialBalance > 0 se exige clave de ADMIN (middleware condicional en la ruta).
export const createBettor = async (req, res) => {
  const { name } = req.body;
  if (!name) throw new HttpError(400, 'name es obligatorio');
  const balance = Number(req.body.initialBalance) || 0;
  if (balance < 0) throw new HttpError(400, 'initialBalance no puede ser negativo');

  try {
    const bettor = await Bettor.create({ name, balance });
    res.status(201).json(bettor);
  } catch (err) {
    if (err.code === 11000) {
      throw new HttpError(409, 'Ya existe un apostador con ese nombre');
    }
    throw err;
  }
};

// PUT /api/bets/bettors/:id — activar / desactivar apostador.
export const toggleBettor = async (req, res) => {
  const { active } = req.body;
  const bettor = await Bettor.findByIdAndUpdate(
    req.params.id,
    { ...(active !== undefined && { active }) },
    { new: true, runValidators: true }
  );
  if (!bettor) throw new HttpError(404, 'Apostador no encontrado');
  res.json(bettor);
};

// POST /api/bets/bettors/:id/topup — sumar o restar Megalitos (exige clave de
// ADMIN). Un amount negativo retira Megalitos; solo se puede retirar lo que
// no esté comprometido en apuestas pendientes y el saldo nunca baja de 0.
export const topUp = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new HttpError(400, 'amount debe ser un número distinto de 0');
  }
  const bettor = await Bettor.findById(req.params.id);
  if (!bettor) throw new HttpError(404, 'Apostador no encontrado');

  if (amount < 0) {
    const pendingBets = await Bet.find({ bettor: bettor._id, status: 'pending' });
    const available = bettor.balance - reservedAmount(pendingBets);
    if (-amount > available) {
      throw new HttpError(400, 'No se pueden retirar más Megalitos de los disponibles');
    }
  }

  bettor.balance += amount;
  await bettor.save();
  res.json(bettor);
};

// GET /api/bets — todas las apuestas (pendientes y ya liquidadas), recientes primero.
export const getBets = async (req, res) => {
  const bets = await populatedBet(Bet.find().sort({ createdAt: -1 }));
  res.json(bets);
};

// POST /api/bets — colocar una apuesta.
// body: { matchId, bettorId, team: 1|2, amount }
export const placeBet = async (req, res) => {
  const { matchId, bettorId, team } = req.body;
  if (team !== 1 && team !== 2) throw new HttpError(400, 'team debe ser 1 o 2');

  const stake = Number(req.body.amount);
  if (!stake || stake <= 0) throw new HttpError(400, 'amount debe ser mayor que 0');

  const match = await Match.findById(matchId);
  if (!match) throw new HttpError(404, 'Partido no encontrado');
  if (match.winner) throw new HttpError(409, 'El partido ya tiene resultado');

  // La cuota se congela con la probabilidad que muestra la zona de apuestas.
  const probability =
    team === 1 ? match.teamA?.winProbability : match.teamB?.winProbability;
  const cuota = probability ? 1 / probability : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(cuota)) {
    throw new HttpError(400, 'No hay cuota válida para ese lado');
  }

  const bettor = await Bettor.findById(bettorId);
  if (!bettor) throw new HttpError(404, 'Apostador no encontrado');
  if (!bettor.active) throw new HttpError(400, 'El apostador está desactivado');

  // El saldo disponible descuenta lo ya comprometido en apuestas pendientes.
  const pendingBets = await Bet.find({ bettor: bettorId, status: 'pending' });
  const available = bettor.balance - reservedAmount(pendingBets);
  if (available < stake) {
    throw new HttpError(400, 'Saldo insuficiente para esa apuesta');
  }

  // Si el apostador ya tiene una apuesta PENDIENTE en ese mismo partido y
  // ese mismo lado, se suma el importe a la existente (no se crea otra).
  const existing = await Bet.findOne({
    bettor: bettorId,
    match: matchId,
    team,
    status: 'pending',
  });
  if (existing) {
    existing.amount += stake;
    await existing.save();
  } else {
    await Bet.create({
      bettor: bettorId,
      match: matchId,
      team,
      amount: stake,
      cuota,
    });
  }

  // Como placeBet solo crea un documento por vez, buscamos la apuesta
  // vigente del apostador en ese partido y lado para devolverla.
  const bet = await populatedBet(
    Bet.findOne({ bettor: bettorId, match: matchId, team, status: 'pending' })
  );
  res.status(existing ? 200 : 201).json(bet);
};

// PUT /api/bets/:id — cambiar el importe de una apuesta PENDIENTE.
// El apostador puede poner un valor mayor o menor mientras el partido no se
// liquide. Subir la apuesta exige saldo libre suficiente para la diferencia;
// lo ya reservado por el resto de apuestas pendientes no puede superarse.
// La cuota congelada no cambia.
export const editBet = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'amount debe ser mayor que 0');
  }

  const bet = await Bet.findById(req.params.id);
  if (!bet) throw new HttpError(404, 'Apuesta no encontrada');
  if (bet.status !== 'pending') {
    throw new HttpError(409, 'Solo se pueden editar apuestas pendientes');
  }

  const match = await Match.findById(bet.match);
  if (!match || match.winner) {
    throw new HttpError(409, 'El partido ya tiene resultado');
  }

  const bettor = await Bettor.findById(bet.bettor);
  if (!bettor) throw new HttpError(404, 'Apostador no encontrado');

  const pendingBets = await Bet.find({ bettor: bettor._id, status: 'pending' });
  const otherReserved = reservedAmount(pendingBets) - bet.amount;
  if (otherReserved + amount > bettor.balance) {
    throw new HttpError(400, 'Saldo insuficiente para ese importe');
  }

  bet.amount = amount;
  await bet.save();
  const updated = await populatedBet(Bet.findById(bet._id));
  res.json(updated);
};

// DELETE /api/bets/:id — cancelar una apuesta pendiente.
// La apuesta NO se borra: pasa a 'cancelled' para que el historial de la zona
// quede fijo e imborrable (el importe deja de estar reservado).
export const cancelBet = async (req, res) => {
  const bet = await Bet.findById(req.params.id);
  if (!bet) throw new HttpError(404, 'Apuesta no encontrada');
  if (bet.status !== 'pending') {
    throw new HttpError(409, 'Solo se pueden cancelar apuestas pendientes');
  }
  bet.status = 'cancelled';
  bet.settledDelta = 0;
  await bet.save();
  const updated = await populatedBet(Bet.findById(bet._id));
  res.json(updated);
};