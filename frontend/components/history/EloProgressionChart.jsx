import React, { useMemo, useRef, useState } from 'react';

function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 70%, 62%)`;
}

const W = 640;
const H = 220;
const PAD_X = 24;
const PAD_Y = 20;
const PAD_TOP_LABELS = 18;

export default function EloProgressionChart({ series, seasonMarkers = [] }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const validSeries = series.filter((entry) => entry.points.length >= 2);
  const isMulti = validSeries.length > 1;
  const chartTop = seasonMarkers.length > 0 ? PAD_Y + PAD_TOP_LABELS : PAD_Y;

  const { tMin, tMax, yMin, yMax } = useMemo(() => {
    const points = validSeries.flatMap((entry) => entry.points);
    const markerOrders = seasonMarkers.map((marker) => marker.order);
    if (points.length === 0) return { tMin: 0, tMax: 1, yMin: 0, yMax: 1 };
    const times = [...points.map((point) => point.t), ...markerOrders];
    const elos = points.map((point) => point.elo);
    const min = Math.min(...elos);
    const max = Math.max(...elos);
    const range = max - min || 1;
    return {
      tMin: Math.min(...times),
      tMax: Math.max(...times) || Math.min(...times) + 1,
      yMin: min - range * 0.15,
      yMax: max + range * 0.15,
    };
  }, [validSeries, seasonMarkers]);

  const x = (time) => PAD_X + ((time - tMin) / (tMax - tMin || 1)) * (W - PAD_X * 2);
  const y = (elo) => H - PAD_Y - ((elo - yMin) / (yMax - yMin || 1)) * (H - chartTop - PAD_Y);

  if (validSeries.length === 0) {
    return <p className="text-muted">Necesitas al menos un partido jugado para ver la progresión.</p>;
  }

  function handleMove(event) {
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * W;
    const mouseY = ((event.clientY - rect.top) / rect.height) * H;
    let best = null;
    for (const entry of validSeries) {
      entry.points.forEach((point, index) => {
        const pointX = x(point.t);
        const pointY = y(point.elo);
        const distance = Math.hypot(pointX - mouseX, pointY - mouseY);
        if (!best || distance < best.distance) {
          best = { distance, seriesId: entry.id, pointIndex: index, x: pointX, y: pointY };
        }
      });
    }
    setHover(best && best.distance < 40 ? best : null);
  }

  const hoveredSeries = hover && validSeries.find((entry) => entry.id === hover.seriesId);
  const hoveredPoint =
    hoveredSeries && hover.pointIndex != null
      ? hoveredSeries.points[hover.pointIndex]
      : null;

  return (
    <div className="elo-chart">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolución de Elo" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {seasonMarkers.map((marker) => (
          <g key={marker.label}>
            <line x1={x(marker.order)} x2={x(marker.order)} y1={chartTop} y2={H - PAD_Y} stroke="rgba(237, 235, 222, 0.15)" strokeDasharray="2 4" />
            <text x={x(marker.order) + 4} y={chartTop - 6} fontSize="9" fill="var(--text-muted)">{marker.label}</text>
          </g>
        ))}
        {validSeries.map((entry) => {
          const color = isMulti ? colorForId(entry.id) : 'var(--accent)';
          const linePath = entry.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.t).toFixed(1)} ${y(point.elo).toFixed(1)}`).join(' ');
          return <path key={entry.id} d={linePath} fill="none" stroke={color} strokeWidth={hover?.seriesId === entry.id ? 3 : 2} opacity={hover && hover.seriesId !== entry.id ? 0.25 : 1} style={{ transition: 'opacity 120ms ease' }} />;
        })}
        {validSeries.map((entry) => {
          const seriesColor = isMulti ? colorForId(entry.id) : 'var(--accent)';
          const isDimmed = hover && hover.seriesId !== entry.id;
          return (
            <g key={`dots-${entry.id}`} opacity={isDimmed ? 0.25 : 1}>
              {entry.points.map((point, index) => (
                <circle
                  key={index}
                  cx={x(point.t)}
                  cy={y(point.elo)}
                  r={index === 0 ? 2.5 : isMulti ? 3 : 4}
                  fill={
                    isMulti
                      ? seriesColor
                      : index === 0
                      ? 'var(--text-muted)'
                      : point.won
                      ? 'var(--team-a)'
                      : 'var(--danger)'
                  }
                  stroke="var(--bg)"
                  strokeWidth={isMulti ? 1 : 1.5}
                />
              ))}
            </g>
          );
        })}
        {hover && <><line x1={hover.x} x2={hover.x} y1={chartTop} y2={H - PAD_Y} stroke="rgba(237, 235, 222, 0.25)" strokeDasharray="3 3" /><circle cx={hover.x} cy={hover.y} r={5} fill={isMulti ? colorForId(hover.seriesId) : 'var(--accent)'} stroke="var(--bg)" strokeWidth="2" /></>}
      </svg>

      {hoveredPoint && <div className="elo-chart__tooltip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}><strong style={{ color: isMulti ? colorForId(hover.seriesId) : 'var(--accent)' }}>{hoveredSeries.name}</strong><span className="numeric">{hoveredPoint.elo.toFixed(2)}</span></div>}
      {isMulti && <div className="elo-chart__legend elo-chart__legend--multi">{validSeries.map((entry) => <span key={entry.id} data-dimmed={(hover && hover.seriesId !== entry.id) || undefined}><i style={{ background: colorForId(entry.id) }} />{entry.name}</span>)}</div>}
      {!isMulti && <div className="elo-chart__legend"><span><i data-dot="win" /> Victoria</span><span><i data-dot="loss" /> Derrota</span></div>}
    </div>
  );
}
