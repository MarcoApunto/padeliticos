import React from 'react';

// Line chart a medida en SVG, sin dependencias externas. Recibe una lista
// de puntos { elo, won, label } ya en orden cronológico (el primero es el
// elo inicial, antes de cualquier partido).
export default function EloProgressionChart({ points }) {
  const W = 640;
  const H = 200;
  const PAD_X = 24;
  const PAD_Y = 20;

  if (points.length < 2) {
    return (
      <p className="text-muted">
        Necesitas al menos un partido jugado para ver la progresión.
      </p>
    );
  }

  const elos = points.map((point) => point.elo);
  const min = Math.min(...elos);
  const max = Math.max(...elos);
  const range = max - min || 1;
  const yMin = min - range * 0.15;
  const yMax = max + range * 0.15;

  const x = (index) => PAD_X + (index / (points.length - 1)) * (W - PAD_X * 2);
  const y = (elo) =>
    H - PAD_Y - ((elo - yMin) / (yMax - yMin)) * (H - PAD_Y * 2);

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.elo).toFixed(1)}`
    )
    .join(' ');

  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${H - PAD_Y} L ${x(0).toFixed(1)} ${H - PAD_Y} Z`;

  return (
    <div className="elo-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolución de Elo">
        <defs>
          <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#eloFill)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={x(index)}
            cy={y(point.elo)}
            r={index === 0 ? 3 : 4}
            fill={
              index === 0
                ? 'var(--text-muted)'
                : point.won
                  ? 'var(--team-a)'
                  : 'var(--danger)'
            }
            stroke="var(--bg)"
            strokeWidth="1.5"
          >
            <title>{point.label}</title>
          </circle>
        ))}
      </svg>
      <div className="elo-chart__legend">
        <span>
          <i data-dot="win" /> Victoria
        </span>
        <span>
          <i data-dot="loss" /> Derrota
        </span>
        <span className="numeric">
          {min.toFixed(2)} – {max.toFixed(2)}
        </span>
      </div>

      <style>{`
        .elo-chart svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .elo-chart__legend {
          display: flex;
          gap: 16px;
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .elo-chart__legend i {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 5px;
        }
        .elo-chart__legend i[data-dot='win'] { background: var(--team-a); }
        .elo-chart__legend i[data-dot='loss'] { background: var(--danger); }
      `}</style>
    </div>
  );
}
