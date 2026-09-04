import React, { useState } from 'react';
import { api } from '../../api/client.js';
import { ELO_MAX, ELO_MIN } from '../../utils/elo.js';

export default function PlayersPage({ players, onChange }) {
  const [name, setName] = useState('');
  const [initialElo, setInitialElo] = useState('1.5');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const player = await api.createPlayer({
        name,
        initialElo: Number(initialElo),
      });
      onChange([...players, player]);
      setName('');
      setInitialElo('1.5');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(player) {
    const updated = await api.updatePlayer(player._id, {
      active: !player.active,
    });
    onChange(players.map((p) => (p._id === updated._id ? updated : p)));
  }

  return (
    <div className="players-page">
      <h2>Jugadores</h2>

      <form className="players-page__form" onSubmit={handleCreate}>
        <input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="number"
          min={ELO_MIN}
          max={ELO_MAX}
          step={0.05}
          value={initialElo}
          onChange={(e) => setInitialElo(e.target.value)}
          required
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Añadiendo…' : 'Añadir jugador'}
        </button>
      </form>
      {error && <p className="players-page__error">{error}</p>}

      <ul className="players-page__list">
        {players.map((p) => (
          <li key={p._id} data-inactive={!p.active || undefined}>
            <span className="players-page__name">{p.name}</span>
            <span className="numeric players-page__elo">
              {p.currentElo.toFixed(2)}
            </span>
            <button type="button" onClick={() => handleToggleActive(p)}>
              {p.active ? 'Desactivar' : 'Activar'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
