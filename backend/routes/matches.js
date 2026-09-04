import express from 'express';
import * as ctrl from '../controllers/matchController.js';

const router = express.Router();

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.patch('/:id/result', ctrl.setResult);
router.delete('/:id', ctrl.remove);

export default router;
