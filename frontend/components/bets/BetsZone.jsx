import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { api } from '../../api/client.js';
import { cuota, cuotaNumber, pairKey } from './betsUtils.js';

function matchIdOf(bet) {
  return bet.match?._id || bet.match;
}

export default function BetsZone({ onClose }) {
  const [betsKey, setBetsKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  const [bettors, setBettors] = useState([]);
  const [bets, setBets] = useState([]);
  const [matches, setMatches] = useState([]); // pendientes (se puede apostar)
  const [played, setPlayed] = useState([]); // con resultado (solo lectura)
  const [pairStats, setPairStats] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const [selectedBettorId, setSelectedBettorId] = useState(null);
  const [activeRoundIndex, setActiveRoundIndex] = useState(0);
  const [betModal, setBetModal] = useState(null); // { match, team, bettor }
  const [editBetTarget, setEditBetTarget] = useState(null); // apuesta pendiente
  const [newBettorOpen, setNewBettorOpen] = useState(false);
  const [topUpTarget, setTopUpTarget] = useState(null); // bettor

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function showError(err) {
    setError(err.message || 'Ha ocurrido un error');
    setMessage(null);
  }

  function showMessage(text) {
    setMessage(text);
    setError(null);
  }

  function loadAll() {
    if (!unlocked) return;
    setLoading(true);
    Promise.all([
      api.bets.getBettors(betsKey),
      api.bets.getBets(betsKey),
      api.getPendingMatches(),
      api.getAllMatches(),
      api.getPairStats(),
    ])
      .then(([bettorsData, betsData, pendingMatches, playedMatches, pairStatsData]) => {
        setBettors(bettorsData);
        setBets(betsData);
        setMatches(pendingMatches);
        setPlayed(playedMatches);
        setPairStats(pairStatsData);
        setError(null);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!unlocked) return undefined;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, retryKey]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  // Megalitos comprometidos en apuestas pendientes por apostador, para
  // mostrar cuánto saldo queda realmente libre para apostar.
  const reservedByBettor = useMemo(() => {
    const map = {};
    for (const bet of bets) {
      if (bet.status === 'pending') {
        const id = String(bet.bettor?._id || bet.bettor);
        map[id] = (map[id] || 0) + bet.amount;
      }
    }
    return map;
  }, [bets]);

  // Partidos agrupados por ronda y ordenados por temporada + número de ronda,
  // para navegar con flechas como la gráfica. Los partidos CON resultado se
  // muestran bajo su ronda como "cerrados" (solo lectura). Con partidos
  // pendientes, solo se muestran las rondas abiertas (con partidos sin
  // resultado): al entrar, el tablero aterriza en lo pendiente primero.
  const rounds = useMemo(() => {
    const hasPending = matches.length > 0;
    const byKey = new Map();
    const addMatch = (match, isPlayed) => {
      const round = match.round;
      const key = round?._id || `round-${round?.number ?? match.number}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          label: round
            ? `${round.season?.name || ''}${round.season?.name ? ' · ' : ''}Ronda ${round.number}`
            : `Ronda ${match.number}`,
          seasonId: round?.season?._id || '',
          roundNumber: round?.number || 0,
          matches: [],
          played: [],
        };
        byKey.set(key, entry);
      }
      (isPlayed ? entry.played : entry.matches).push(match);
    };
    for (const match of matches) addMatch(match, false);
    for (const match of played) addMatch(match, true);
    return [...byKey.values()]
      .filter(
        (entry) =>
          entry.matches.length > 0 ||
          entry.played.length > 0
      )
      .filter((entry) => (hasPending ? entry.matches.length > 0 : true))
      .sort(
        (a, b) =>
          a.seasonId.localeCompare(b.seasonId) || a.roundNumber - b.roundNumber
      );
  }, [matches, played]);

  const activeRound = rounds[Math.min(activeRoundIndex, Math.max(0, rounds.length - 1))];

  useEffect(() => {
    // Al cargar, aterrizamos en la primera ronda (Ronda 1).
    setActiveRoundIndex(0);
  }, [rounds]);

  async function unlock(event) {
    event.preventDefault();
    setError(null);
    try {
      await api.bets.check(betsKey);
      setUnlocked(true);
      showMessage('Zona de apuestas desbloqueada');
    } catch (err) {
      showError(err);
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    const bettorId = active.data.current?.bettorId;
    const target = over?.data?.current; // { matchId, team }
    if (!bettorId || !target?.matchId || target?.team == null) return;
    openBetModal(bettorId, target.matchId, target.team);
  }

  function openBetModal(bettorId, matchId, team) {
    const bettor = bettors.find((b) => b._id === bettorId);
    const match = matches.find((m) => m._id === matchId);
    if (!bettor || !match) return;
    setSelectedBettorId(null);
    setBetModal({
      bettor,
      match,
      team,
      available: bettor.balance - (reservedByBettor[bettor._id] || 0),
    });
  }

  async function confirmBet(amount) {
    setSaving('bet');
    setError(null);
    try {
      const placed = await api.bets.placeBet(betsKey, {
        matchId: betModal.match._id,
        bettorId: betModal.bettor._id,
        team: betModal.team,
        amount: Number(amount),
      });
      setBets((prev) => {
        const exists = prev.some((b) => b._id === placed._id);
        return exists
          ? prev.map((b) => (b._id === placed._id ? placed : b))
          : [placed, ...prev];
      });
      setBetModal(null);
      showMessage(`Apuesta de ${placed.bettor.name} registrada`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function cancelBet(betId) {
    if (!window.confirm('¿Cancelar esta apuesta?')) return;
    setSaving(`bet-${betId}`);
    setError(null);
    try {
      const updated = await api.bets.cancelBet(betsKey, betId);
      setBets((prev) =>
        prev.map((bet) => (bet._id === updated._id ? updated : bet))
      );
      showMessage('Apuesta cancelada (queda en el historial)');
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  async function editBet(amount) {
    setSaving('bet-edit');
    setError(null);
    try {
      const updated = await api.bets.editBet(betsKey, editBetTarget._id, {
        amount: Number(amount),
      });
      setBets((prev) =>
        prev.map((bet) => (bet._id === updated._id ? updated : bet))
      );
      setEditBetTarget(null);
      showMessage('Importe de la apuesta actualizado');
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  }

  // Saldo libre actual del apostador de la apuesta que se está editando.
  const editFreeNow =
    editBetTarget &&
    editBetTarget.bettor.balance -
      (reservedByBettor[editBetTarget.bettor._id] || 0);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <section className="bets-zone">
        <div className="bets-zone__top">
          <h2>Zona de Apuestas</h2>
          <div className="bets-zone__top-actions">
            {unlocked && (
              <button
                type="button"
                className="bets-btn"
                disabled={loading}
                onClick={() => setRetryKey((key) => key + 1)}
              >
                Recargar
              </button>
            )}
            <button type="button" className="bets-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        {!unlocked ? (
          <div className="bets-zone__panel">
            <p className="text-muted">
              Zona oculta. Introduce tu clave para entrar y colocar apuestas
              sobre los partidos pendientes.
            </p>
            <form className="bets-zone__login" onSubmit={unlock}>
              <label>
                Clave de acceso
                <input
                  type="password"
                  value={betsKey}
                  autoFocus
                  autoComplete="off"
                  onChange={(event) => setBetsKey(event.target.value)}
                  placeholder="Introduce la clave"
                />
              </label>
              <button type="submit" className="bets-btn bets-btn--accent">
                Entrar
              </button>
            </form>
            {error && <p className="bets-zone__error" role="alert">{error}</p>}
          </div>
        ) : (
          <>
            {error && <p className="bets-zone__error" role="alert">{error}</p>}
            {message && <p className="bets-zone__message" role="status">{message}</p>}

            <section className="bets-section">
              <div className="bets-section__head">
                <h3>Apostadores</h3>
                <button
                  type="button"
                  className="bets-btn"
                  onClick={() => setNewBettorOpen(true)}
                >
                  + Añadir apostador
                </button>
              </div>
              <p className="text-muted">
                Arrastra una tarjeta hasta un equipo del tablero para apostar
                (también vale pulsar la tarjeta y luego el equipo).
              </p>
              <div className="bets-zone__bettors">
                {bettors.map((bettor) => (
                  <BettorCard
                    key={bettor._id}
                    bettor={bettor}
                    available={bettor.balance - (reservedByBettor[bettor._id] || 0)}
                    selected={selectedBettorId === bettor._id}
                    onSelect={(id) =>
                      setSelectedBettorId((prev) => (prev === id ? null : id))
                    }
                    onTopUp={() => setTopUpTarget(bettor)}
                    onToggle={async () => {
                      try {
                        const updated = await api.bets.toggleBettor(betsKey, bettor._id, {
                          active: !bettor.active,
                        });
                        setBettors((prev) =>
                          prev.map((b) => (b._id === updated._id ? updated : b))
                        );
                      } catch (err) {
                        showError(err);
                      }
                    }}
                  />
                ))}
              </div>
            </section>

            <section className="bets-section">
              <div className="bets-section__head">
                <h3>Tablero de apuestas</h3>
                {rounds.length > 0 && (
                  <div className="bets-zone__board-nav">
                    <button
                      type="button"
                      className="bets-zone__arrow"
                      aria-label="Ronda anterior"
                      disabled={activeRoundIndex <= 0}
                      onClick={() => setActiveRoundIndex((index) => Math.max(0, index - 1))}
                    >
                      ‹
                    </button>
                    <span className="bets-zone__board-label">
                      {activeRound ? activeRound.label : ''}
                    </span>
                    <button
                      type="button"
                      className="bets-zone__arrow"
                      aria-label="Ronda siguiente"
                      disabled={activeRoundIndex >= rounds.length - 1}
                      onClick={() => setActiveRoundIndex((index) => Math.min(rounds.length - 1, index + 1))}
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
              {loading && <p className="text-muted">Cargando…</p>}
              {!loading && rounds.length === 0 && (
                <p className="text-muted">
                  No hay partidos para mostrar.
                </p>
              )}
              {!loading &&
                activeRound &&
                (activeRound.matches.length > 0 || activeRound.played.length > 0) && (
                  <>
                    {activeRound.matches.length > 0 && (
                      <ul className="bets-page__list">
                        {activeRound.matches.map((match) => (
                          <MatchBetRow
                            key={match._id}
                            match={match}
                            allBets={bets}
                            pairStats={pairStats}
                            selectedBettorId={selectedBettorId}
                            onSideClick={(team) => {
                              if (!selectedBettorId) return;
                              openBetModal(selectedBettorId, match._id, team);
                            }}
                            onCancelBet={cancelBet}
                            saving={saving}
                            onEditBet={(bet) => setEditBetTarget(bet)}
                          />
                        ))}
                      </ul>
                    )}
                    {activeRound.played.length > 0 && (
                      <>
                        <p className="bets-zone__played-label">
                          {activeRound.matches.length > 0
                            ? 'Cerrados de esta ronda'
                            : 'Resultados de esta ronda'}
                        </p>
                        <ul className="bets-page__list">
                          {activeRound.played.map((match) => (
                            <MatchBetRow
                              key={match._id}
                              match={match}
                              allBets={bets}
                              pairStats={pairStats}
                              onCancelBet={cancelBet}
                              saving={saving}
                              disabled
                            />
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}
            </section>

            <section className="bets-section">
              <h3>Últimas apuestas</h3>
              {bets.length === 0 ? (
                <p className="text-muted">Todavía no hay apuestas.</p>
              ) : (
                <ul className="bets-zone__history">
                  {bets.slice(0, 30).map((bet) => (
                    <li className="bet-history" key={bet._id} data-status={bet.status}>
                      <span className="bet-history__bettor">{bet.bettor?.name || '—'}</span>
                      <span className="bet-history__match">
                        {bet.match?.round?.season?.name || ''}{' '}
                        {bet.match?.round ? `R${bet.match.round.number}` : ''}
                        {bet.match ? ` · Partido ${bet.match.number}` : ''}
                        {bet.match && (
                          <>
                            {' — '}
                            <strong>
                              {(bet.team === 1 ? bet.match.teamA : bet.match.teamB)
                                .players.map((p) => p.name)
                                .join(' + ')}
                            </strong>
                          </>
                        )}
                      </span>
                      <span className="bet-history__amount numeric">
                        {bet.amount.toFixed(2)} Mglt @ {bet.cuota.toFixed(2)}
                      </span>
                      {bet.status === 'pending' ? (
                        <span className="bet-history__result" data-status="pending">
                          Pendiente
                        </span>
                      ) : bet.status === 'cancelled' ? (
                        <span className="bet-history__result" data-status="cancelled">
                          Cancelada
                        </span>
                      ) : (
                        <span
                          className="bet-history__result"
                          data-status={bet.status}
                        >
                          {bet.status === 'won' ? 'Ganada' : 'Perdida'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {betModal && (
              <BetAmountModal
                title={`Apuesta de ${betModal.bettor.name}`}
                bettor={betModal.bettor}
                match={betModal.match}
                team={betModal.team}
                cuota={cuotaNumber(
                  (betModal.team === 1 ? betModal.match.teamA : betModal.match.teamB)
                    .winProbability
                )}
                initialAmount="10"
                amountLabel="Megalitos a apostar"
                available={betModal.available}
                maxAmount={betModal.available}
                afterLabel="Tras la apuesta"
                tooMuchHint={`No hay tanto saldo libre (libre: ${Math.max(0, betModal.available).toFixed(2)}).`}
                saving={saving === 'bet'}
                savingLabel="Apostando…"
                confirmLabel="Confirmar apuesta"
                onClose={() => setBetModal(null)}
                onConfirm={confirmBet}
              />
            )}

            {editBetTarget && (
              <BetAmountModal
                title={`Editar apuesta de ${editBetTarget.bettor.name}`}
                bettor={editBetTarget.bettor}
                match={editBetTarget.match}
                team={editBetTarget.team}
                cuota={editBetTarget.cuota}
                initialAmount={editBetTarget.amount}
                amountLabel={`Megalitos (actual: ${editBetTarget.amount.toFixed(2)})`}
                available={editFreeNow}
                maxAmount={editFreeNow + editBetTarget.amount}
                afterLabel="Tras el ajuste"
                tooMuchHint={`No hay tanto saldo libre (límite: ${Math.max(0, editFreeNow + editBetTarget.amount).toFixed(2)}).`}
                saving={saving === 'bet-edit'}
                confirmLabel="Guardar importe"
                onClose={() => setEditBetTarget(null)}
                onConfirm={editBet}
              />
            )}

            {newBettorOpen && (
              <NewBettorModal
                saving={saving === 'bettor'}
                onClose={() => setNewBettorOpen(false)}
                onSave={async (data) => {
                  setSaving('bettor');
                  setError(null);
                  try {
                    const created = await api.bets.createBettor(
                      betsKey,
                      { name: data.name, initialBalance: data.initialBalance },
                      data.initialBalance > 0 ? data.adminKey : undefined
                    );
                    setBettors((prev) => [created, ...prev]);
                    setNewBettorOpen(false);
                    showMessage(`Apostador añadido: ${created.name}`);
                  } catch (err) {
                    showError(err);
                  } finally {
                    setSaving(null);
                  }
                }}
              />
            )}

            {topUpTarget && (
              <TopUpModal
                bettor={topUpTarget}
                available={topUpTarget.balance - (reservedByBettor[topUpTarget._id] || 0)}
                saving={saving === 'topup'}
                onClose={() => setTopUpTarget(null)}
                onSave={async (amount, key) => {
                  setSaving('topup');
                  setError(null);
                  try {
                    const updated = await api.bets.topUp(betsKey, topUpTarget._id, amount, key);
                    setBettors((prev) =>
                      prev.map((b) => (b._id === updated._id ? updated : b))
                    );
                    setTopUpTarget(null);
                    showMessage(
                      amount < 0
                        ? `Retirados ${(-amount).toFixed(2)} Megalitos de ${updated.name}`
                        : `Megalitos añadidos a ${updated.name}`
                    );
                  } catch (err) {
                    showError(err);
                  } finally {
                    setSaving(null);
                  }
                }}
              />
            )}
          </>
        )}
      </section>
    </DndContext>
  );
}

function BettorCard({ bettor, available, selected, onSelect, onTopUp, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bettor-${bettor._id}`,
    data: { bettorId: bettor._id },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bettor-card"
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      data-inactive={!bettor.active || undefined}
      onClick={() => onSelect(bettor._id)}
      role="button"
      tabIndex={0}
    >
      <span className="bettor-card__name">{bettor.name}</span>
      <span className="bettor-card__balance numeric">
        {bettor.balance.toFixed(2)} <small>Mglt</small>
      </span>
      <span className="bettor-card__available numeric">
        Libre: {Math.max(0, available).toFixed(2)} Mglt
      </span>
      <div className="bettor-card__actions">
        <button type="button" onClick={(event) => { event.stopPropagation(); onTopUp(); }}>
          Ajustar
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }}>
          {bettor.active ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  );
}

function MatchBetRow({ match, allBets, pairStats, selectedBettorId, onSideClick, onCancelBet, onEditBet, saving, disabled = false }) {
  const favA = (match.teamA.winProbability || 0) >= (match.teamB.winProbability || 0);
  const betsA = allBets.filter((b) => matchIdOf(b) === match._id && b.team === 1);
  const betsB = allBets.filter((b) => matchIdOf(b) === match._id && b.team === 2);

  return (
    <li className="bet-row bet-row--zone" data-played={disabled || undefined}>
      <div className="bet-row__meta">
        {match.round?.season?.name && <span>{match.round.season.name}</span>}
        {match.round?.number != null && <span>Ronda {match.round.number}</span>}
        <span>Partido {match.number}</span>
        {disabled && <span className="bet-row__closed">Cerrado</span>}
      </div>
      <div className="bet-row__board">
        <BetZoneSide
          match={match}
          team="a"
          selectedBettorId={selectedBettorId}
          favorite={favA}
          pairKey={pairKey}
          pairStats={pairStats}
          bets={betsA}
          onSideClick={onSideClick}
          onCancelBet={onCancelBet}
          onEditBet={onEditBet}
          saving={saving}
          disabled={disabled}
        />
        <span className="bet-row__vs">vs</span>
        <BetZoneSide
          match={match}
          team="b"
          selectedBettorId={selectedBettorId}
          favorite={!favA}
          pairKey={pairKey}
          pairStats={pairStats}
          bets={betsB}
          onSideClick={onSideClick}
          onCancelBet={onCancelBet}
          onEditBet={onEditBet}
          saving={saving}
          disabled={disabled}
        />
      </div>
    </li>
  );
}

function BetZoneSide({
  match,
  team,
  selectedBettorId,
  favorite,
  pairKey: pairKeyFn,
  pairStats,
  bets,
  onSideClick,
  onCancelBet,
  onEditBet,
  saving,
  disabled = false,
}) {
  const teamNumber = team === 'a' ? 1 : 2;
  const teamData = team === 'a' ? match.teamA : match.teamB;
  const winProbability = teamData.winProbability;
  const cuotaValue = cuota(winProbability);
  const won = match.winner === teamNumber;
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${match._id}-${teamNumber}`,
    data: { matchId: match._id, team: teamNumber },
  });

  return (
    <div
      className="bet-side bet-side--drop"
      data-team={team}
      data-favorite={favorite || undefined}
      data-winner={won || undefined}
    >
      <div
        ref={disabled ? undefined : setNodeRef}
        className="bet-zone__drop"
        data-over={!disabled && isOver ? true : undefined}
        data-disabled={disabled || undefined}
        onClick={disabled ? undefined : () => onSideClick(teamNumber)}
        role={!disabled && selectedBettorId ? 'button' : undefined}
      >
        <div className="bet-side__line">
          <span className="bet-side__name">
            {teamData.players.map((player) => player.name).join(' + ')}
          </span>
          <span className="bet-side__cuota numeric">{cuotaValue}</span>
        </div>
        <div className="bet-side__meta numeric">
          <span>Elo medio {teamData.avgElo?.toFixed(2) ?? '—'}</span>
          {(() => {
            const record = pairStats[pairKeyFn(teamData.players)];
            return record ? (
              <span>{record.wins}V · {record.losses}D</span>
            ) : (
              <span className="text-muted">Sin historial</span>
            );
          })()}
        </div>
        <div className="bet-side__hint">
          {disabled
            ? won
              ? 'Ganó este equipo'
              : 'Cerrado'
            : isOver
              ? '¡Suelta aquí la apuesta!'
              : selectedBettorId
                ? 'Pulsa para apostar'
                : 'Arrastra un apostador aquí'}
        </div>
      </div>
      {bets.length > 0 && (
        <ul className="bet-side__stakes">
          {bets.map((bet) => (
            <li className="bet-stake" key={bet._id} data-status={bet.status}>
              <span className="bet-stake__bettor">{bet.bettor?.name || '—'}</span>
              <span className="bet-stake__amount numeric">
                {bet.amount.toFixed(2)} Mglt
              </span>
              {bet.status === 'pending' ? (
                <>
                  <span className="bet-stake__profit numeric">
                    +{(bet.amount * (bet.cuota - 1)).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    aria-label="Editar importe"
                    disabled={saving === `bet-${bet._id}`}
                    onClick={() => onEditBet?.(bet)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar apuesta"
                    disabled={saving === `bet-${bet._id}`}
                    onClick={() => onCancelBet(bet._id)}
                  >
                    ×
                  </button>
                </>
              ) : bet.status === 'cancelled' ? (
                <span className="bet-stake__status" data-status="cancelled">
                  Cancelada
                </span>
              ) : (
                <span className="bet-stake__status" data-status={bet.status}>
                  {bet.status === 'won' ? 'Ganada' : 'Perdida'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BetAmountModal({
  title,
  bettor,
  match,
  team,
  cuota,
  initialAmount,
  amountLabel,
  available,
  maxAmount,
  afterLabel,
  tooMuchHint,
  saving,
  savingLabel = 'Guardando…',
  confirmLabel,
  onClose,
  onConfirm,
}) {
  const [amount, setAmount] = useState(String(initialAmount));
  const teamData = team === 1 ? match.teamA : match.teamB;
  const hasCuota = Number.isFinite(cuota);
  const amountNum = Number(amount);
  const withinLimit = amountNum <= maxAmount + 1e-9;
  const valid = hasCuota && Number.isFinite(amountNum) && amountNum > 0 && withinLimit;
  const profit = valid ? amountNum * (cuota - 1) : 0;
  const after = valid ? Math.max(0, maxAmount - amountNum) : Math.max(0, maxAmount);

  return (
    <div className="bets-modal" role="dialog" aria-modal="true">
      <div className="bets-modal__card">
        <h3>{title}</h3>
        <p className="text-muted">
          {match.round?.season?.name}{match.round ? ` · Ronda ${match.round.number}` : ''}
          {' · '}Partido {match.number}
        </p>
        <p className="bets-modal__side">
          <strong>{teamData.players.map((p) => p.name).join(' + ')}</strong>{' '}
          @ <span className="bets-modal__quote numeric">{hasCuota ? cuota.toFixed(2) : '∞'}</span>
        </p>
        <p className="bets-modal__saldo">
          Saldo libre: <span className="numeric">{Math.max(0, available).toFixed(2)} Mglt</span>
        </p>
        <label className="bets-field">
          <span>{amountLabel}</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        {valid && (
          <p className="bets-modal__saldo">
            {afterLabel}: <span className="numeric">{after.toFixed(2)} Mglt</span>
          </p>
        )}
        {Number.isFinite(amountNum) && amountNum > 0 && !withinLimit && (
          <p className="bets-modal__hint">{tooMuchHint}</p>
        )}
        <p className="text-muted">
          Beneficio si gana: <span className="numeric">{(hasCuota && valid ? profit.toFixed(2) : 0)} Mglt</span>
        </p>
        <div className="bets-modal__actions">
          <button type="button" className="bets-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="bets-btn bets-btn--accent"
            disabled={!valid || saving}
            onClick={() => onConfirm(amountNum)}
          >
            {saving ? savingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewBettorModal({ saving, onClose, onSave }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0');
  const [localAdminKey, setLocalAdminKey] = useState('');
  const balanceNum = Number(balance) || 0;
  const needsAdmin = balanceNum > 0;
  const valid = name.trim().length > 0 && (!needsAdmin || localAdminKey.trim().length > 0);

  return (
    <div className="bets-modal" role="dialog" aria-modal="true">
      <div className="bets-modal__card">
        <h3>Añadir apostador</h3>
        <label className="bets-field">
          <span>Nombre</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="bets-field">
          <span>Megalitos iniciales</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
          />
        </label>
        {needsAdmin && (
          <label className="bets-field">
            <span>Clave de administrador (saldo inicial)</span>
            <input
              type="password"
              value={localAdminKey}
              autoComplete="off"
              onChange={(event) => setLocalAdminKey(event.target.value)}
              placeholder="Clave de administrador"
            />
          </label>
        )}
        <div className="bets-modal__actions">
          <button type="button" className="bets-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="bets-btn bets-btn--accent"
            disabled={!valid || saving}
            onClick={() =>
              onSave({ name: name.trim(), initialBalance: balanceNum, adminKey: localAdminKey })
            }
          >
            {saving ? 'Guardando…' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopUpModal({ bettor, available, saving, onClose, onSave }) {
  const [amount, setAmount] = useState('50');
  const [localAdminKey, setLocalAdminKey] = useState('');
  const amountNum = Number(amount);
  const canWithdraw = amountNum < 0 ? -amountNum <= available + 1e-9 : true;
  const valid =
    localAdminKey.trim().length > 0 &&
    Number.isFinite(amountNum) &&
    amountNum !== 0 &&
    canWithdraw;

  return (
    <div className="bets-modal" role="dialog" aria-modal="true">
      <div className="bets-modal__card">
        <h3>Ajustar Megalitos de {bettor.name}</h3>
        <p className="text-muted">
          Saldo actual: <span className="numeric">{bettor.balance.toFixed(2)} Mglt</span>
          {' · '}Libre: <span className="numeric">{Math.max(0, available).toFixed(2)} Mglt</span>
        </p>
        <p className="text-muted">
          Cantidad positiva para añadir; negativa para retirar.
        </p>
        <label className="bets-field">
          <span>Megalitos</span>
          <input
            type="number"
            step="0.01"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        {Number.isFinite(amountNum) && amountNum !== 0 && (
          <p className="bets-modal__saldo">
            Tras el ajuste: <span className="numeric">{Math.max(0, bettor.balance + amountNum).toFixed(2)} Mglt</span>
          </p>
        )}
        {amountNum < 0 && !canWithdraw && (
          <p className="bets-modal__hint">
            No se pueden retirar tantos Megalitos (libre: {Math.max(0, available).toFixed(2)}).
          </p>
        )}
        <label className="bets-field">
          <span>Clave de administrador</span>
          <input
            type="password"
            value={localAdminKey}
            autoComplete="off"
            onChange={(event) => setLocalAdminKey(event.target.value)}
            placeholder="Clave de administrador"
          />
        </label>
        <div className="bets-modal__actions">
          <button type="button" className="bets-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="bets-btn bets-btn--accent"
            disabled={!valid || saving}
            onClick={() => onSave(amountNum, localAdminKey)}
          >
            {saving
              ? 'Guardando…'
              : amountNum < 0
                ? 'Retirar Megalitos'
                : 'Añadir Megalitos'}
          </button>
        </div>
      </div>
    </div>
  );
}