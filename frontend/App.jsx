import React, { useEffect, useState } from 'react';
import Header from './components/layout/Header.jsx';
import CourtBuilder from './components/match/CourtBuilder.jsx';
import SeasonRoundPicker from './components/match/SeasonRoundPicker.jsx';
import RankingPage from './components/ranking/RankingPage.jsx';
import BetsPage from './components/bets/BetsPage.jsx';
import BetsZone from './components/bets/BetsZone.jsx';
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
  // Zonas ocultas, accesibles por URL: /admin y /apuestas.
  const [route, setRoute] = useState(() => window.location.pathname);

  const adminOpen = route === '/admin';
  const betsOpen = route === '/apuestas';

  useEffect(() => {
    function handleNavigation() {
      setRoute(window.location.pathname);
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
      <Header
        active={tab}
        onChange={setTab}
        brand={adminOpen ? 'Super Padelitico' : betsOpen ? 'Padelitico Apuestas' : 'Padeliticos'}
        hideNavigation={adminOpen || betsOpen}
      />

      {loading && <p className="text-muted">Cargando…</p>}

      {!loading && error && (
        <div className="app-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadPlayers}>Reintentar</button>
        </div>
      )}

      {!loading && !error && betsOpen && (
        <BetsZone
          onClose={() => {
            window.history.pushState({}, '', '/');
            setRoute('/');
          }}
        />
      )}

      {!loading && !error && adminOpen && (
        <AdminPage
          players={players}
          onPlayersChange={setPlayers}
          onClose={() => {
            window.history.pushState({}, '', '/');
            setRoute('/');
          }}
        />
      )}

      {!loading && !error && !adminOpen && !betsOpen && tab === 'match' && (
        <>
          <SeasonRoundPicker onRoundReady={setRound} />
          {round ? (
            <CourtBuilder
              players={activePlayers}
              round={round}
              onMatchClosed={handleMatchClosed}
            />
          ) : (
            <p className="text-muted">
              Crea una temporada y una ronda para empezar a montar partidos.
            </p>
          )}
        </>
      )}

      {!loading && !error && !adminOpen && !betsOpen && tab === 'ranking' && <RankingPage players={players} />}

      {!loading && !error && !adminOpen && !betsOpen && tab === 'bets' && <BetsPage />}

      {!loading && !error && !adminOpen && !betsOpen && tab === 'matches' && <MatchesPage />}

      {!loading && !error && !adminOpen && !betsOpen && tab === 'history' && <HistoryPage players={players} />}

      {!loading && !error && !adminOpen && !betsOpen && tab === 'players' && (
        <PlayersPage players={players} onChange={setPlayers} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
