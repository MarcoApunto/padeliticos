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
  getPlayerHistory: (id) => request(`/players/${id}/history`),
  getPlayerStats: () => request('/players/stats'),

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
  getPendingMatches: () => request('/matches?status=pending'),
  getPairStats: () => request('/matches/pair-stats'),
  getMatches: (roundId) => request(`/rounds/${roundId}/matches`),
  createMatch: (roundId, data) =>
    request(`/rounds/${roundId}/matches`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMatch: (matchId, data) =>
    request(`/matches/${matchId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateMatchResult: (matchId, data) => {
    const { adminKey, ...body } = data;
    return request(`/matches/${matchId}/result`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey ? { 'x-admin-key': adminKey } : {}),
      },
    });
  },
  setMatchResult: (matchId, data) => {
    const { adminKey, ...body } = data;
    return request(`/matches/${matchId}/result`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey ? { 'x-admin-key': adminKey } : {}),
      },
    });
  },

  admin: {
    check: (key) => adminRequest('/admin/check', key),
    updatePlayer: (key, id, data) =>
      adminRequest(`/admin/players/${id}`, key, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    disablePlayer: (key, id) =>
      adminRequest(`/admin/players/${id}`, key, { method: 'DELETE' }),
    updateSeason: (key, id, data) =>
      adminRequest(`/admin/seasons/${id}`, key, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteSeason: (key, id) =>
      adminRequest(`/admin/seasons/${id}`, key, { method: 'DELETE' }),
    updateRound: (key, id, data) =>
      adminRequest(`/admin/rounds/${id}`, key, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteRound: (key, id) =>
      adminRequest(`/admin/rounds/${id}`, key, { method: 'DELETE' }),
    deleteMatch: (key, id) =>
      adminRequest(`/admin/matches/${id}`, key, { method: 'DELETE' }),
    updateMatch: (key, id, data) =>
      adminRequest(`/admin/matches/${id}`, key, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    rebuildRatings: (key) =>
      adminRequest('/admin/ratings/rebuild', key, { method: 'POST' }),
  },
};

function adminRequest(path, key, options = {}) {
  return request(path, {
    ...options,
    headers: { ...options.headers, 'x-admin-key': key },
  });
}
