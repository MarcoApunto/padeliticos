import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computePairStats } from '../services/matchStatsService.js';

const player = (id) => ({ _id: id });

function makeMatch(winner, teamA, teamB) {
  return { winner, teamA: { players: teamA }, teamB: { players: teamB } };
}

test('computePairStats cuenta partidos, victorias y derrotas por pareja', () => {
  const matches = [
    makeMatch(1, [player('a'), player('b')], [player('c'), player('d')]),
    makeMatch(2, [player('a'), player('b')], [player('c'), player('e')]),
    makeMatch(1, [player('c'), player('e')], [player('a'), player('b')]),
  ];
  const stats = computePairStats(matches);

  assert.deepEqual(stats['a|b'], { played: 3, wins: 1, losses: 2 });
  assert.deepEqual(stats['c|d'], { played: 1, wins: 0, losses: 1 });
  assert.deepEqual(stats['c|e'], { played: 2, wins: 2, losses: 0 });
});

test('la clave de pareja no depende del orden de los jugadores', () => {
  const stats = computePairStats([
    makeMatch(1, [player('a'), player('b')], [player('x'), player('y')]),
    makeMatch(1, [player('b'), player('a')], [player('z'), player('w')]),
  ]);
  // "a|b" y "b|a" son la misma pareja y suman 2 partidos.
  assert.deepEqual(stats['a|b'], { played: 2, wins: 2, losses: 0 });
  assert.equal(stats['b|a'], undefined);
});

test('los partidos sin resultado no cuentan', () => {
  const stats = computePairStats([
    makeMatch(null, [player('a'), player('b')], [player('c'), player('d')]),
  ]);
  assert.deepEqual(stats, {});
});