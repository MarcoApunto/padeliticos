import express from 'express';
import * as roundCtrl from '../controllers/roundController.js';
import * as matchCtrl from '../controllers/matchController.js';

const router = express.Router();

// Partidos anidados bajo una ronda
router.get('/:roundId/matches', matchCtrl.getAllForRound);
router.post('/:roundId/matches', matchCtrl.create);

export default router;
