import Match from '../models/Match.js';
import Bettor from '../models/Bettor.js';
import Bet from '../models/Bet.js';

/**
 * Efecto (delta de saldo) que produce cada apuesta al liquidar un partido.
 * Fórmula de beneficios: Megalitos * (Cuota - 1).
 *  - El ganador gana stake * (cuota - 1) (solo el beneficio, no le devolvemos
 *    el stake: el importe apostado ya no se recupera).
 *  - El perdedor pierde su stake => delta = -stake.
 * @param {{team: 1|2, amount: number, cuota: number}[]} bets
 * @param {1|2} matchWinner
 */
export function settleEffects(bets, matchWinner) {
  return bets.map((bet) => {
    const won = bet.team === matchWinner;
    return {
      bet,
      won,
      status: won ? 'won' : 'lost',
      delta: won ? bet.amount * (bet.cuota - 1) : -bet.amount,
    };
  });
}

/**
 * Megalitos comprometidos en apuestas aún pendientes de un apostador.
 * Sirve para no poder apostar dos veces el mismo saldo antes de liquidar.
 * @param {{amount: number}[]} bets
 */
export function reservedAmount(bets) {
  return bets.reduce((sum, bet) => sum + bet.amount, 0);
}

/**
 * Aplica (o recalcula) la liquidación de TODAS las apuestas de un partido.
 * Idempotente: si una apuesta ya estaba liquidada, primero se revierte su
 * efecto anterior y se vuelve a calcular con el ganador actual. Así corregir
 * un resultado (PUT /matches/:id/result) re-liquida sin duplicar beneficios
 * y borrar un partido puede devolver todo el dinero aplicando la inversa.
 * @param {string} matchId
 * @param {mongoose.ClientSession} [session]
 */
export async function settleBetsForMatch(matchId, session) {
  const match = await (session
    ? Match.findById(matchId).session(session)
    : Match.findById(matchId));
  if (!match || !match.winner) return { settled: 0 };

  // Las apuestas canceladas quedan fuera: no se liquidan ni se resignan.
  const betQuery = Bet.find({ match: matchId, status: { $ne: 'cancelled' } });
  const bets = await (session ? betQuery.session(session) : betQuery);
  if (bets.length === 0) return { settled: 0 };

  const bettorIds = [...new Set(bets.map((bet) => String(bet.bettor)))];
  const bettors = await (session
    ? Bettor.find({ _id: { $in: bettorIds } }).session(session)
    : Bettor.find({ _id: { $in: bettorIds } }));
  const bettorById = new Map(bettors.map((bettor) => [String(bettor._id), bettor]));

  const toSave = new Set();
  for (const effect of settleEffects(bets, match.winner)) {
    const { bet, status, delta } = effect;
    const bettor = bettorById.get(String(bet.bettor));
    if (!bettor) continue;

    // Revertir liquidación anterior antes de aplicar la nueva.
    if (bet.settledDelta) bettor.balance -= bet.settledDelta;

    bettor.balance += delta;
    toSave.add(bettor);

    bet.status = status;
    bet.settledDelta = delta;
    bet.settledAt = new Date();
    await (session ? bet.save({ session }) : bet.save());
  }

  for (const bettor of toSave) {
    await (session ? bettor.save({ session }) : bettor.save());
  }

  return { settled: bets.length };
}

/**
 * Devuelve a todos los apostadores el importe relacionado con un partido:
 * revertir liquidaciones ya aplicadas y borrar las apuestas pendientes.
 * Se usa al borrar un partido para que el dinero vuelva a su estado previo.
 * @param {string} matchId
 */
export async function refundAndRemoveBets(matchId) {
  const bets = await Bet.find({ match: matchId });
  if (bets.length === 0) return { removed: 0 };

  const bettorIds = [...new Set(bets.map((bet) => String(bet.bettor)))];
  const bettors = await Bettor.find({ _id: { $in: bettorIds } });
  const bettorById = new Map(bettors.map((bettor) => [String(bettor._id), bettor]));

  const toSave = new Set();
  for (const bet of bets) {
    const bettor = bettorById.get(String(bet.bettor));
    if (bettor && bet.settledDelta) {
      bettor.balance -= bet.settledDelta;
      toSave.add(bettor);
    }
    await bet.deleteOne();
  }
  for (const bettor of toSave) {
    await bettor.save();
  }

  return { removed: bets.length };
}