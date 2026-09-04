import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import EloProgressionChart from './EloProgressionChart.jsx';
import MatchHistoryList from './MatchHistoryList.jsx';

function rawKey(entry, seasonOrderMap) {
  const seasonId = entry.match.round.season?._id || entry.season?._id;
  const seasonName = entry.match.round.season?.name || entry.season?.name;
  const seasonIndex = seasonOrderMap[seasonId] ?? 0;
  const key = seasonIndex * 1000 + (entry.match.round.number || 0);
  return { key, seasonId, seasonName };
}

function buildRankInfo(historiesList, seasonOrderMap) {
  const keyToSeason = new Map();
  historiesList.forEach((history) => {
    history.filter((entry) => entry.match?.round).forEach((entry) => {
      const { key, seasonId, seasonName } = rawKey(entry, seasonOrderMap);
      if (!keyToSeason.has(key)) keyToSeason.set(key, { seasonId, seasonName });
    });
  });

  const sortedKeys = [...keyToSeason.keys()].sort((a, b) => a - b);
  const rankMap = new Map(sortedKeys.map((key, index) => [key, index]));
  const seasonFirstRank = new Map();
  sortedKeys.forEach((key) => {
    const { seasonId, seasonName } = keyToSeason.get(key);
    if (!seasonFirstRank.has(seasonId)) seasonFirstRank.set(seasonId, { rank: rankMap.get(key), name: seasonName });
  });

  return {
    rankMap,
    seasonMarkers: [...seasonFirstRank.values()].map((season) => ({ order: season.rank - 0.5, label: season.name })),
  };
}

function toSeries(player, history, seasonOrderMap, rankMap) {
  const valid = history.filter((entry) => entry.match?.round);
  if (valid.length === 0) return { id: player._id, name: player.name, points: [] };

  const withKey = valid
    .map((entry) => ({ entry, ...rawKey(entry, seasonOrderMap) }))
    .sort((a, b) => a.key - b.key);
  const firstRank = rankMap.get(withKey[0].key);
  const initial = { t: firstRank - 1, elo: withKey[0].entry.eloBefore, won: null };
  const rest = withKey.map(({ entry, key }) => ({
    t: rankMap.get(key),
    elo: entry.eloAfter,
    won: entry.match?.won,
  }));
  return { id: player._id, name: player.name, points: [initial, ...rest] };
}

export default function HistoryPage({ players }) {
  const [mode, setMode] = useState('single');
  const [playerId, setPlayerId] = useState(players[0]?._id || '');
  const [singleHistory, setSingleHistory] = useState([]);
  const [allHistories, setAllHistories] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seasonsError, setSeasonsError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setSeasonsError(null);
    api
      .getSeasons()
      .then((data) => setSeasons([...data].reverse()))
      .catch((err) => setSeasonsError(err.message || 'No se pudieron cargar las temporadas'));
  }, [retryKey]);

  useEffect(() => {
    if (!playerId && players[0]?._id) setPlayerId(players[0]._id);
  }, [players, playerId]);

  const seasonOrderMap = useMemo(
    () => Object.fromEntries(seasons.map((season, index) => [season._id, index])),
    [seasons]
  );

  useEffect(() => {
    if (mode !== 'single' || !playerId) return;
    setLoading(true);
    setHistoryError(null);
    api
      .getPlayerHistory(playerId)
      .then(setSingleHistory)
      .catch((err) => {
        setSingleHistory([]);
        setHistoryError(err.message || 'No se pudo cargar el historial');
      })
      .finally(() => setLoading(false));
  }, [mode, playerId, retryKey]);

  useEffect(() => {
    if (mode !== 'all' || allHistories) return;
    setLoading(true);
    setHistoryError(null);
    Promise.all(players.map((player) => api.getPlayerHistory(player._id).then((history) => [player._id, history])))
      .then((pairs) => setAllHistories(Object.fromEntries(pairs)))
      .catch((err) => {
        setAllHistories(null);
        setHistoryError(err.message || 'No se pudo cargar el historial');
      })
      .finally(() => setLoading(false));
  }, [mode, players, allHistories, retryKey]);

  const error = seasonsError || historyError;

  function retryHistory() {
    setAllHistories(null);
    setRetryKey((key) => key + 1);
  }

  const singleRankInfo = useMemo(
    () => buildRankInfo([singleHistory], seasonOrderMap),
    [singleHistory, seasonOrderMap]
  );

  const singleSeries = useMemo(() => {
    const player = players.find((candidate) => candidate._id === playerId);
    return player ? [toSeries(player, singleHistory, seasonOrderMap, singleRankInfo.rankMap)] : [];
  }, [players, playerId, singleHistory, seasonOrderMap, singleRankInfo]);

  const allRankInfo = useMemo(() => {
    if (!allHistories) return { rankMap: new Map(), seasonMarkers: [] };
    return buildRankInfo(players.map((player) => allHistories[player._id] || []), seasonOrderMap);
  }, [players, allHistories, seasonOrderMap]);

  const allSeries = useMemo(() => {
    if (!allHistories) return [];
    return players
      .map((player) => toSeries(player, allHistories[player._id] || [], seasonOrderMap, allRankInfo.rankMap))
      .filter((series) => series.points.length > 0);
  }, [players, allHistories, seasonOrderMap, allRankInfo]);

  return (
    <div className="history-page">
      <div className="history-page__header">
        <h2>Historial</h2>
        <div className="history-page__controls">
          <div className="history-page__toggle">
            <button type="button" data-active={mode === 'single' || undefined} onClick={() => setMode('single')}>Un jugador</button>
            <button type="button" data-active={mode === 'all' || undefined} onClick={() => setMode('all')}>Todos</button>
          </div>
          {mode === 'single' && (
            <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              {players.map((player) => <option key={player._id} value={player._id}>{player.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading && <p className="text-muted">Cargando historial…</p>}
      {!loading && error && (
        <div className="history-page__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retryHistory}>Reintentar</button>
        </div>
      )}
      {!loading && !error && (
        <>
          <section className="history-page__section">
            <h3>Progresión de Elo</h3>
            <EloProgressionChart
              series={mode === 'single' ? singleSeries : allSeries}
              seasonMarkers={mode === 'all' ? allRankInfo.seasonMarkers : []}
            />
          </section>
          {mode === 'single' && (
            <section className="history-page__section">
              <h3>Partidos jugados</h3>
              <MatchHistoryList entries={singleHistory} />
            </section>
          )}
        </>
      )}

      <style>{`
        .history-page__header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
        .history-page__controls { display: flex; gap: 10px; }
        .history-page__toggle { display: flex; background: var(--surface-raised); border-radius: var(--radius-sm); padding: 2px; }
        .history-page__toggle button { background: transparent; border: none; color: var(--text-muted); font-size: 12px; padding: 7px 12px; border-radius: 5px; }
        .history-page__toggle button[data-active] { background: var(--accent); color: var(--bg); font-weight: 600; }
        .history-page__header select { background: var(--surface-raised); color: var(--text); border: 1px solid rgba(237, 235, 222, 0.15); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 13px; }
        .history-page__section { margin-bottom: 28px; }
        .history-page__section h3 { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; font-weight: 500; }
        .history-page__error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--danger); border-radius: var(--radius-md); color: var(--danger); }
        .history-page__error p { margin: 0; }
        .history-page__error button { flex-shrink: 0; padding: 8px 12px; border: 1px solid var(--danger); border-radius: var(--radius-sm); background: transparent; color: var(--danger); }
      `}</style>
    </div>
  );
}
