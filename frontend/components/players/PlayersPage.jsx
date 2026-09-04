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

  async function handleDelete(player) {
    if (!confirm(`¿Eliminar a ${player.name}?`)) return;
    await api.deletePlayer(player._id);
    onChange(players.filter((p) => p._id !== player._id));
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
            <button
              type="button"
              className="players-page__delete"
              onClick={() => handleDelete(p)}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <style>{`
        .players-page h2 { margin-bottom: 16px; }
        .players-page__form {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .players-page__form input {
          background: var(--surface-raised);
          border: 1px solid rgba(237, 235, 222, 0.15);
          border-radius: var(--radius-sm);
          padding: 9px 12px;
          color: var(--text);
          font-size: 13px;
        }
        .players-page__form input:first-child { flex: 1; min-width: 160px; }
        .players-page__form input[type='number'] { width: 90px; }
        .players-page__form button {
          background: var(--accent);
          border: none;
          border-radius: var(--radius-sm);
          padding: 9px 14px;
          font-weight: 600;
          font-size: 13px;
          color: var(--bg);
        }
        .players-page__error {
          color: var(--danger);
          font-size: 13px;
          margin-bottom: 10px;
        }
        .players-page__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .players-page__list li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--surface);
          border-radius: var(--radius-md);
        }
        .players-page__list li[data-inactive] {
          opacity: 0.5;
        }
        .players-page__name {
          flex: 1;
          font-size: 14px;
        }
        .players-page__elo {
          color: var(--accent);
          font-size: 13px;
          width: 50px;
        }
        .players-page__list button {
          background: transparent;
          border: 1px solid rgba(237, 235, 222, 0.2);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 12px;
          padding: 6px 10px;
        }
        .players-page__delete:hover {
          border-color: var(--danger);
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
