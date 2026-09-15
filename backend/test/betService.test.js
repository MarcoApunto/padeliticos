import { test } from 'node:test';
import assert from 'node:assert/strict';

import { settleEffects, reservedAmount } from '../services/betService.js';

const bet = (team, amount, cuota) => ({ team, amount, cuota });

test('settleEffects: el ganador gana stake*(cuota-1) y el perdedor pierde el stake', () => {
  const effects = settleEffects([bet(1, 10, 2.5), bet(2, 10, 2.5)], 1);
  assert.equal(effects[0].status, 'won');
  assert.equal(effects[0].delta, 15);
  assert.equal(effects[1].status, 'lost');
  assert.equal(effects[1].delta, -10);
});

test('settleEffects sigue la fórmula Megalitos * (Cuota - 1)', () => {
  // Beneficio = 100 * (3 - 1) = 200
  const effects = settleEffects([bet(1, 100, 3)], 1);
  assert.equal(effects[0].status, 'won');
  assert.equal(effects[0].delta, 200);
});

test('settleEffects premia según el ganador', () => {
  const effects = settleEffects([bet(1, 50, 2), bet(2, 30, 4)], 2);
  assert.equal(effects[0].status, 'lost');
  assert.equal(effects[0].delta, -50);
  assert.equal(effects[1].status, 'won');
  assert.equal(effects[1].delta, 90);
});

test('settleEffects: 10 Mglt a cuota 1.57 dan 5.70 al ganador', () => {
  const effects = settleEffects([bet(1, 10, 1.57)], 1);
  assert.ok(Math.abs(effects[0].delta - 5.7) < 1e-9);
});

test('reservedAmount suma solo el importe de las apuestas', () => {
  assert.equal(reservedAmount([bet(1, 5, 2), bet(2, 7, 2)]), 12);
  assert.equal(reservedAmount([]), 0);
});