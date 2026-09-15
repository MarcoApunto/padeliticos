import express from 'express';
import betsAuth from '../middleware/betsAuth.js';
import adminAuth from '../middleware/adminAuth.js';
import * as ctrl from '../controllers/betController.js';

const router = express.Router();

// Toda la zona de apuestas exige la clave de apuestas (x-bets-key).
router.use(betsAuth);

router.get('/check', ctrl.check);

// Apuestas
router.get('/', ctrl.getBets);
router.post('/', ctrl.placeBet);
router.put('/:id', ctrl.editBet);
router.delete('/:id', ctrl.cancelBet);

// Apostadores. Crear un apostador con saldo inicial > 0 equivale a entregar
// Megalitos, así que entonces se exige además la clave de administrador.
router.get('/bettors', ctrl.getBettors);
router.post('/bettors', (req, res, next) => {
  const balance = Number(req.body?.initialBalance) || 0;
  if (balance > 0) return adminAuth(req, res, next);
  return next();
}, ctrl.createBettor);
router.put('/bettors/:id', ctrl.toggleBettor);
router.post('/bettors/:id/topup', adminAuth, ctrl.topUp);

export default router;