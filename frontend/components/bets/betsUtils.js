// Utilidades compartidas por la vista pública de apuestas (BetsPage) y la
// zona oculta (BetsZone).

// Cuota = 1 / probabilidad. Con probabilidad nula o ínfima se muestra '∞'.
export function cuota(probability) {
  if (!probability || probability <= 0) return '∞';
  const value = 1 / probability;
  return value >= 100 ? '∞' : value.toFixed(2);
}

// Cuota numérica (para la fórmula de beneficio), ∞ si no hay cuota.
export function cuotaNumber(probability) {
  if (!probability || probability <= 0) return Number.POSITIVE_INFINITY;
  return 1 / probability;
}

// Clave de pareja igual que el backend (matchStatsService): ids ordenados + '|'.
export function pairKey(players) {
  return players.map((p) => String(p._id || p)).sort().join('|');
}