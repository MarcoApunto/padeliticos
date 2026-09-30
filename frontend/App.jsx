import React, { useEffect, useRef, useState } from 'react';
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
  const [loading, setLoading] = useState(() => ['/', '/admin', '/apuestas'].includes(window.location.pathname));
  const [error, setError] = useState(null);
  const [round, setRound] = useState(null);
  const [matchManagementOpen, setMatchManagementOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const playersLoadPromise = useRef(null);
  // Zonas ocultas, accesibles por URL: /admin y /apuestas.
  const [route, setRoute] = useState(() => window.location.pathname);

  const adminOpen = route === '/admin';
  const betsOpen = route === '/apuestas';
  const notFound = !['/', '/admin', '/apuestas'].includes(route);

  useEffect(() => {
    if (tab !== 'match' || adminOpen || betsOpen) setMatchManagementOpen(false);
  }, [tab, adminOpen, betsOpen]);

  useEffect(() => {
    function handleNavigation() {
      setRoute(window.location.pathname);
    }
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  useEffect(() => {
    if (!notFound) loadPlayers();
  }, []);

  function loadPlayers() {
    if (playersLoadPromise.current) return playersLoadPromise.current;

    setLoading(true);
    setError(null);
    const loadPromise = (async () => {
      const startedAt = Date.now();
      const maxWaitMs = 60_000;
      let retryDelayMs = 1_000;

      while (true) {
        try {
          const data = await api.getPlayers();
          setPlayers(data);
          return;
        } catch (err) {
          const isNetworkError = err instanceof TypeError || /failed to fetch|networkerror/i.test(err.message || '');
          const remainingMs = maxWaitMs - (Date.now() - startedAt);

          if (!isNetworkError || remainingMs <= 0) {
            const message = isNetworkError
              ? 'El servidor no está respondiendo ahora. Inténtalo de nuevo en unos minutos.'
              : err.message || 'No se pudieron cargar los jugadores';
            setError(message);
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, Math.min(retryDelayMs, remainingMs)));
          retryDelayMs = Math.min(retryDelayMs * 2, 10_000);
        }
      }
    })().finally(() => {
      setLoading(false);
      playersLoadPromise.current = null;
    });

    playersLoadPromise.current = loadPromise;
    return loadPromise;
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
        hideNavigation={adminOpen || betsOpen || notFound}
      />

      {notFound && <NotFoundPage />}

      {!notFound && loading && (
        <div className="backend-loading" role="status" aria-live="polite">
          <svg className="backend-loading__ball" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <clipPath id="backend-loading-ball-clip"><circle cx="16" cy="16" r="15" /></clipPath>
            </defs>
            <circle cx="16" cy="16" r="15" fill="#93ad2c" />
            <g clipPath="url(#backend-loading-ball-clip)">
              <circle cx="14" cy="14" r="15" fill="#c6f135" />
              <path
                d="M25.5 3.2C26.2 10.7 18.7 14.6 12.6 18.7C7.8 22.1 8.5 28.3 11.9 32.4"
                fill="none"
                stroke="#e2604f"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </g>
          </svg>
          <p>Preparando el saque inicial…</p>
          <span>El servidor se está preparando.</span>
        </div>
      )}

      {!notFound && !loading && error && (
        <div className="app-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadPlayers}>Reintentar</button>
        </div>
      )}

      {!notFound && !loading && !error && betsOpen && (
        <BetsZone
          onClose={() => {
            window.history.pushState({}, '', '/');
            setRoute('/');
          }}
        />
      )}

      {!notFound && !loading && !error && adminOpen && (
        <AdminPage
          players={players}
          onPlayersChange={setPlayers}
          onClose={() => {
            window.history.pushState({}, '', '/');
            setRoute('/');
          }}
        />
      )}

      {!notFound && !loading && !error && !adminOpen && !betsOpen && tab === 'match' && (
        <>
          {!matchManagementOpen && <SeasonRoundPicker onRoundReady={setRound} />}
          {round ? (
            <CourtBuilder
              players={activePlayers}
              round={round}
              onMatchClosed={handleMatchClosed}
              onManagementChange={setMatchManagementOpen}
            />
          ) : (
            <p className="text-muted">
              Crea una temporada y una ronda para empezar a montar partidos.
            </p>
          )}
        </>
      )}

      {!notFound && !loading && !error && !adminOpen && !betsOpen && tab === 'ranking' && <RankingPage players={players} />}

      {!notFound && !loading && !error && !adminOpen && !betsOpen && tab === 'bets' && <BetsPage />}

      {!notFound && !loading && !error && !adminOpen && !betsOpen && tab === 'matches' && <MatchesPage />}

      {!notFound && !loading && !error && !adminOpen && !betsOpen && tab === 'history' && <HistoryPage players={players} />}

      {!notFound && !loading && !error && !adminOpen && !betsOpen && tab === 'players' && (
        <PlayersPage players={players} onChange={setPlayers} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="not-found" aria-labelledby="not-found-title">
      <p className="not-found__eyebrow">PADELÍTICOS</p>
      <h1 className="not-found__number" id="not-found-title" aria-label="Error 404">
        <span aria-hidden="true">4</span>
        <svg className="not-found__ball" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <clipPath id="not-found-ball-clip"><circle cx="16" cy="16" r="15" /></clipPath>
          </defs>
          <circle cx="16" cy="16" r="15" fill="#93ad2c" />
          <g clipPath="url(#not-found-ball-clip)">
            <circle cx="14" cy="14" r="15" fill="#c6f135" />
            <path d="M25.5 3.2C26.2 10.7 18.7 14.6 12.6 18.7C7.8 22.1 8.5 28.3 11.9 32.4" fill="none" stroke="#e2604f" strokeWidth="3.2" strokeLinecap="round" />
          </g>
        </svg>
        <span aria-hidden="true">4</span>
      </h1>
      <h2>Esta página no existe</h2>
      <p>Puede que el enlace haya cambiado o que la dirección no sea correcta.</p>
      <a className="not-found__home" href="/">Volver a la página principal</a>
    </main>
  );
}
