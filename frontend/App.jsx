import React, { useEffect, useState } from 'react';
import Header from './components/layout/Header.jsx';
import CourtBuilder from './components/match/CourtBuilder.jsx';
import SeasonRoundPicker from './components/match/SeasonRoundPicker.jsx';
import RankingPage from './components/ranking/RankingPage.jsx';
import HistoryPage from './components/history/HistoryPage.jsx';
import MatchesPage from './components/matches/MatchesPage.jsx';
import PlayersPage from './components/players/PlayersPage.jsx';
import { api } from './api/client.js';

export default function App() {
  const [tab, setTab] = useState('match');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.getPlayers().then((data) => {
      setPlayers(data);
      setLoading(false);
    });
  }, []);

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

      {!loading && tab === 'match' && (
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

      {!loading && tab === 'ranking' && <RankingPage players={players} />}

      {!loading && tab === 'history' && <HistoryPage players={players} />}

      {!loading && tab === 'matches' && <MatchesPage />}

      {!loading && tab === 'players' && (
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
      `}</style>
    </div>
  );
}
