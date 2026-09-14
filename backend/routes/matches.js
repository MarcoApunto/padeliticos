import express from 'express';
import adminAuth from '../middleware/adminAuth.js';
import * as ctrl from '../controllers/matchController.js';

const router = express.Router();

router.get('/', ctrl.getAll);
router.get('/pair-stats', ctrl.getPairStats);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.updatePending);
// Fijar o corregir el resultado altera el Elo: solo con clave de admin.
router.put('/:id/result', adminAuth, ctrl.updateResult);
router.patch('/:id/result', adminAuth, ctrl.setResult);

export default router;
