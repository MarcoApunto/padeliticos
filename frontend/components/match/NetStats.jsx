import React from 'react';

export default function NetStats({ preview }) {
  if (!preview) {
    return (
      <div className="net">
        <div className="net__line" />
        <span className="net__hint">
          Completa las 2 parejas para ver las probabilidades
        </span>
        <style>{netStyles}</style>
      </div>
    );
  }

  const { teamA, teamB } = preview;
  const pctA = Math.round(teamA.winProbability * 100);
  const pctB = Math.round(teamB.winProbability * 100);

  return (
    <div className="net">
      <div className="net__line" />
      <div className="net__stats">
        <div className="net__avg numeric" data-team="a">
          {teamA.avgElo.toFixed(2)}
        </div>
        <div className="net__bar">
          <div
            className="net__bar-fill"
            data-team="a"
            style={{ width: `${pctA}%` }}
          />
          <div
            className="net__bar-fill"
            data-team="b"
            style={{ width: `${pctB}%` }}
          />
        </div>
        <div className="net__avg numeric" data-team="b">
          {teamB.avgElo.toFixed(2)}
        </div>
      </div>
      <div className="net__probs">
        <span className="numeric" data-team="a">
          {pctA}% de ganar
        </span>
        <span className="numeric" data-team="b">
          {pctB}% de ganar
        </span>
      </div>
      <style>{netStyles}</style>
    </div>
  );
}

const netStyles = `
  .net {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 14px;
    min-width: 90px;
  }
  .net__line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 0;
    border-left: 2px dashed rgba(237, 235, 222, 0.3);
  }
  .net__hint {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    max-width: 120px;
    z-index: 1;
    background: var(--bg);
    padding: 4px 6px;
  }
  .net__stats {
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 1;
  }
  .net__avg {
    font-size: 15px;
    font-weight: 600;
  }
  .net__avg[data-team='a'] { color: var(--team-a); }
  .net__avg[data-team='b'] { color: var(--team-b); }
  .net__bar {
    width: 64px;
    height: 6px;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    background: var(--surface);
  }
  .net__bar-fill[data-team='a'] { background: var(--team-a); }
  .net__bar-fill[data-team='b'] { background: var(--team-b); }
  .net__probs {
    display: flex;
    gap: 16px;
    font-size: 11px;
    z-index: 1;
  }
  .net__probs [data-team='a'] { color: var(--team-a); }
  .net__probs [data-team='b'] { color: var(--team-b); }
`;
