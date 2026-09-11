import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ELO_MIN,
  ELO_MAX,
  clampElo,
  winProbabilityForPlayer,
  teamWinProbability,
  finalElo,
  computePreMatch,
  computeFinalElos,
} from '../services/eloService.js';

test('clampElo acota al rango [0.5, 7]', () => {
  assert.equal(clampElo(0), ELO_MIN);
  assert.equal(clampElo(10), ELO_MAX);
  assert.equal(clampElo(3.25), 3.25);
});

test('con elo medio igual la probabilidad es 0.5', () => {
  assert.equal(winProbabilityForPlayer(3, 3), 0.5);
  assert.equal(teamWinProbability(0), 0.5);
});

test('finalElo con nota neutra (5) depende solo de probabilidad y K', () => {
  const k = 0.5;
  assert.equal(finalElo(5, k, true, 0.4), 5 + k * (1 - 0.4));
  assert.equal(finalElo(5, k, false, 0.4), 5 - k * 0.4);
});

test('finalElo aplica la nota relativa a 5', () => {
  const k = 0.5;
  assert.equal(finalElo(5, k, true, 0.5, 7), 5 + k * 0.5 + 0.2);
  assert.equal(finalElo(5, k, true, 0.5, 3), 5 + k * 0.5 - 0.2);
});

test('finalElo no se sale nunca del rango aunque la nota lo pida', () => {
  assert.equal(finalElo(6.9, 0.5, true, 0.2, 10), ELO_MAX);
  assert.equal(finalElo(0.6, 0.5, false, 0.8, 0), ELO_MIN);
});

test('las probabilidades de los dos equipos suman 1', () => {
  const { teamA, teamB } = computePreMatch([3, 4], [2, 3]);
  assert.ok(Math.abs(teamA.winProbability + teamB.winProbability - 1) < 1e-12);
});

test('computePreMatch calcula medias, diferencia y probabilidad por jugador', () => {
  const pre = computePreMatch([3, 4], [2, 3]);
  assert.equal(pre.teamA.avgElo, 3.5);
  assert.equal(pre.teamB.avgElo, 2.5);
  assert.equal(pre.eloDifference, 1);
  // El jugador con más elo tiene más probabilidad de subir que su compañero.
  assert.ok(pre.teamA.playerProbabilities[1] > pre.teamA.playerProbabilities[0]);
});

test('computeFinalElos premia al ganador y castiga al perdedor', () => {
  const antes = [3, 4];
  const { teamAFinal, teamBFinal } = computeFinalElos(antes, antes, 1, 0.5);
  teamAFinal.forEach((elo, i) => assert.ok(elo > antes[i]));
  teamBFinal.forEach((elo, i) => assert.ok(elo < antes[i]));
});

test('computeFinalElos usa las notas para ajustar el elo', () => {
  const antesA = [3, 4];
  const antesB = [3, 4];
  const sinNotas = computeFinalElos(antesA, antesB, 1, 0.5);
  const conNotas = computeFinalElos(antesA, antesB, 1, 0.5, [8, 8], [2, 2]);
  const deltaIngreso = conNotas.teamAFinal[0] - sinNotas.teamAFinal[0];
  const deltaPerdedor = conNotas.teamBFinal[0] - sinNotas.teamBFinal[0];
  assert.equal(deltaIngreso.toFixed(2), '0.30');
  assert.equal(deltaPerdedor.toFixed(2), '-0.30');
});