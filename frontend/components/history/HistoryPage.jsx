import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import EloProgressionChart from './EloProgressionChart.jsx';
import MatchHistoryList from './MatchHistoryList.jsx';

export default function HistoryPage({ players }) {
  const [playerId, setPlayerId] = useState(players[0]?._id || '');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    api
      .getPlayerHistory(playerId)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [playerId]);

  const chartPoints = useMemo(() => {
    if (history.length === 0) return [];
    const first = {
      elo: history[0].eloBefore,
      won: null,
      label: `Elo inicial: ${history[0].eloBefore.toFixed(2)}`,
    };
    const rest = history.map((entry) => ({
      elo: entry.eloAfter,
      won: entry.match?.won,
      label: `Partido ${entry.match?.number ?? ''}: ${entry.eloBefore.toFixed(2)} → ${entry.eloAfter.toFixed(2)} (${entry.match?.won ? 'victoria' : 'derrota'})`,
    }));
    return [first, ...rest];
  }, [history]);

  return (
    <div className="history-page">
      <div className="history-page__header">
        <h2>Historial</h2>
        <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
          {players.map((player) => (
            <option key={player._id} value={player._id}>
              {player.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-muted">Cargando historial…</p>}

      {!loading && (
        <>
          <section className="history-page__section">
            <h3>Progresión de Elo</h3>
            <EloProgressionChart points={chartPoints} />
          </section>

          <section className="history-page__section">
            <h3>Partidos jugados</h3>
            <MatchHistoryList entries={history} />
          </section>
        </>
      )}

      <style>{`
        .history-page__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .history-page__header select {
          background: var(--surface-raised);
          color: var(--text);
          border: 1px solid rgba(237, 235, 222, 0.15);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          font-size: 13px;
        }
        .history-page__section {
          margin-bottom: 28px;
        }
        .history-page__section h3 {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 12px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
