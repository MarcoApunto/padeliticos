import express from 'express';
import adminAuth from '../middleware/adminAuth.js';
import * as ctrl from '../controllers/adminController.js';

const router = express.Router();

router.use(adminAuth);
router.get('/check', ctrl.check);
router.put('/players/:id', ctrl.updatePlayer);
router.delete('/players/:id', ctrl.removePlayer);
router.put('/seasons/:id', ctrl.updateSeason);
router.delete('/seasons/:id', ctrl.removeSeason);
router.put('/rounds/:id', ctrl.updateRound);
router.delete('/rounds/:id', ctrl.removeRound);
router.delete('/matches/:id', ctrl.removePendingMatch);
router.put('/matches/:id', ctrl.updatePendingMatch);

export default router;