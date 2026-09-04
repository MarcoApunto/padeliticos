const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // respuesta sin cuerpo JSON, se mantiene el mensaje genérico
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Jugadores
  getPlayers: () => request('/players'),
  createPlayer: (data) =>
    request('/players', { method: 'POST', body: JSON.stringify(data) }),
  updatePlayer: (id, data) =>
    request(`/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlayer: (id) => request(`/players/${id}`, { method: 'DELETE' }),
  getPlayerHistory: (id) => request(`/players/${id}/history`),

  // Temporadas (semanas)
  getSeasons: () => request('/seasons'),
  createSeason: (data) =>
    request('/seasons', { method: 'POST', body: JSON.stringify(data) }),

  // Rondas
  getRounds: (seasonId) => request(`/seasons/${seasonId}/rounds`),
  createRound: (seasonId, data) =>
    request(`/seasons/${seasonId}/rounds`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Partidos
  getAllMatches: (params = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value)
    ).toString();
    return request(`/matches${queryString ? `?${queryString}` : ''}`);
  },
  getMatches: (roundId) => request(`/rounds/${roundId}/matches`),
  createMatch: (roundId, data) =>
    request(`/rounds/${roundId}/matches`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  setMatchResult: (matchId, data) =>
    request(`/matches/${matchId}/result`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteMatch: (id) => request(`/matches/${id}`, { method: 'DELETE' }),
};
