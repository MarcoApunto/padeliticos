import React, { useEffect, useState } from 'react';
import Header from './components/layout/Header.jsx';
import CourtBuilder from './components/match/CourtBuilder.jsx';
import SeasonRoundPicker from './components/match/SeasonRoundPicker.jsx';
import RankingPage from './components/ranking/RankingPage.jsx';
import HistoryPage from './components/history/HistoryPage.jsx';
import MatchesPage from './components/matches/MatchesPage.jsx';
import PlayersPage from './components/players/PlayersPage.jsx';
import AdminPage from './components/admin/AdminPage.jsx';
import { api } from './api/client.js';

export default function App() {
  const [tab, setTab] = useState('match');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [round, setRound] = useState(null);
  const [toast, setToast] = useState(null);
  const [adminOpen, setAdminOpen] = useState(
    () => window.location.pathname === '/admin'
  );

  useEffect(() => {
    function handleNavigation() {
      setAdminOpen(window.location.pathname === '/admin');
    }
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  useEffect(() => {
    loadPlayers();
  }, []);

  function loadPlayers() {
    setLoading(true);
    setError(null);
    api
      .getPlayers()
      .then((data) => setPlayers(data))
      .catch((err) => setError(err.message || 'No se pudieron cargar los jugadores'))
      .finally(() => setLoading(false));
  }

  function handleMatchClosed() {
    // Refrescamos los jugadores para que el ranking y el banquillo reflejen
    // el nuevo elo tras el partido.
    api.getPlayers().then(setPlayers);
    setToast('Partido guardado. Ranking actualizado.');
    setTimeout(() => setToast(null), 3500);
  }

  const activePlayers = players.filter((p) => p.active);

  return (
    <div className="app-shell">
      <Header active={tab} onChange={setTab} />

      {loading && <p className="text-muted">Cargando…</p>}

      {!loading && error && (
        <div className="app-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadPlayers}>Reintentar</button>
        </div>
      )}

      {!loading && !error && adminOpen && (
        <AdminPage
          players={players}
          onPlayersChange={setPlayers}
          onClose={() => {
            window.history.pushState({}, '', '/');
            setAdminOpen(false);
          }}
        />
      )}

      {!loading && !error && !adminOpen && tab === 'match' && (
        <>
          <SeasonRoundPicker onRoundReady={setRound} />
          {round ? (
            <CourtBuilder
              players={activePlayers}
              round={round}
              kFactor={round.kFactor}
              onMatchClosed={handleMatchClosed}
            />
          ) : (
            <p className="text-muted">
              Crea una temporada y una ronda para empezar a montar partidos.
            </p>
          )}
        </>
      )}

      {!loading && !error && !adminOpen && tab === 'ranking' && <RankingPage players={players} />}

      {!loading && !error && !adminOpen && tab === 'matches' && <MatchesPage />}

      {!loading && !error && !adminOpen && tab === 'history' && <HistoryPage players={players} />}

      {!loading && !error && !adminOpen && tab === 'players' && (
        <PlayersPage players={players} onChange={setPlayers} />
      )}

      {toast && <div className="toast">{toast}</div>}

      <style>{`
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent);
          color: var(--bg);
          padding: 12px 20px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .app-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: var(--surface);
          border: 1px solid var(--danger);
          border-radius: var(--radius-md);
          color: var(--danger);
        }
        .app-error p { margin: 0; }
        .app-error button {
          flex-shrink: 0;
          padding: 8px 12px;
          border: 1px solid var(--danger);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
