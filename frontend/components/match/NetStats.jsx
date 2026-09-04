import React from 'react';

export default function NetStats({ preview }) {
  if (!preview) {
    return (
      <div className="net">
        <div className="net__line" />
        <span className="net__hint">
          Completa las 2 parejas para ver las probabilidades
        </span>
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
    </div>
  );
}

