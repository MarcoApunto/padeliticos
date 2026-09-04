import express from 'express';
import * as seasonCtrl from '../controllers/seasonController.js';
import * as roundCtrl from '../controllers/roundController.js';

const router = express.Router();

router.get('/', seasonCtrl.getAll);
router.get('/:id', seasonCtrl.getOne);
router.post('/', seasonCtrl.create);
router.put('/:id', seasonCtrl.update);
router.delete('/:id', seasonCtrl.remove);

// Rondas anidadas bajo una temporada
router.get('/:seasonId/rounds', roundCtrl.getAllForSeason);
router.post('/:seasonId/rounds', roundCtrl.create);

export default router;
