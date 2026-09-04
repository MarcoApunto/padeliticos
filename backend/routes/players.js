import express from 'express';
import * as ctrl from '../controllers/playerController.js';

const router = express.Router();

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.get('/:id/history', ctrl.getHistory);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
