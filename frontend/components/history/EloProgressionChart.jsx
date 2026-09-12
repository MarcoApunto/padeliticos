import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 70%, 62%)`;
}

const MIN_W = 640;
const PAD_X = 24;
const PAD_Y = 20;
const PAD_TOP_LABELS = 18;
// Debajo de esta Y el tooltip se gira hacia abajo para no cortarse arriba.
const TIP_FLIP_LIMIT = 140;
// Cota de seguridad: aunque no se haya medido aún un tooltip, nunca se clampará
// a menos de TIP_FALLBACK px de los bordes.
const TIP_FALLBACK = 264;

// Semana (columna) a la que pertenece un paso: la temporada cuyo marker es el
// mayor `order` ≤ t. Las `t` son índices secuenciales globales (rankMap) y los
// markers van en `order = rank - 0.5`, por eso NO se puede usar /1000.
function weekIndexFor(time, markers) {
  let w = -1;
  for (const marker of markers) {
    if (marker.order <= time) w += 1;
    else break;
  }
  return Math.max(0, w);
}

export default function EloProgressionChart({ series, seasonMarkers = [] }) {
  const svgRef = useRef(null);
  const scrollerRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [viewportW, setViewportW] = useState(0);
  const [weekIndex, setWeekIndex] = useState(0);
  const [tipWidth, setTipWidth] = useState(0);
  const tooltipRef = useRef(null);
  const validSeries = series.filter((entry) => entry.points.length >= 2);
  const isMulti = validSeries.length > 1;
  // En la vista general (Todos) la gráfica es más grande.
  const H = isMulti ? 440 : 350;
  const chartTop = seasonMarkers.length > 0 ? PAD_Y + PAD_TOP_LABELS : PAD_Y;

  // Mide el ancho disponible para que la vista de 2 semanas se adapte a la página.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setViewportW((prev) => (Math.abs(w - prev) > 1 ? w : prev));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pasos del eje X: cada valor de `t` (temporada→ronda) ocupa una posición.
  const steps = useMemo(() => {
    const values = new Set(
      validSeries.flatMap((entry) => entry.points.map((point) => point.t))
    );
    seasonMarkers.forEach((marker) => values.add(marker.order));
    return [...values].sort((a, b) => a - b);
  }, [validSeries, seasonMarkers]);

  // Nº de semanas = temporadas detectadas (markers), o la mayor semana con datos.
  const weeks = useMemo(() => {
    let maxWeek = 0;
    for (const t of steps) maxWeek = Math.max(maxWeek, weekIndexFor(t, seasonMarkers));
    return Math.max(1, seasonMarkers.length, maxWeek + 1);
  }, [seasonMarkers, steps]);

  const stepsByWeek = useMemo(() => {
    const map = new Map();
    for (const t of steps) {
      const w = weekIndexFor(t, seasonMarkers);
      if (!map.has(w)) map.set(w, []);
      map.get(w).push(t);
    }
    return map;
  }, [steps, seasonMarkers]);

  // Cada semana ocupa una columna; la pantalla muestra 2 de golpe a "tamaño de
  // siempre" y las demás se alcanzan desplazándose de una en una (1+2 → 2+3...).
  const weekPx = Math.round((viewportW || MIN_W) / Math.min(2, weeks));
  const W = Math.max(viewportW || MIN_W, weeks * weekPx);
  const maxWeekIndex = Math.max(0, weeks - 2);

  // Posición X de cada paso dentro de la columna de su semana.
  const x = (time) => {
    const w = weekIndexFor(time, seasonMarkers);
    const list = stepsByWeek.get(w) || [time];
    const idx = list.indexOf(time);
    const col = list.length > 1 ? idx / (list.length - 1) : 0.5;
    return w * weekPx + PAD_X + col * (weekPx - PAD_X * 2);
  };

  // Al añadir una semana nueva saltamos al final para ver lo más reciente;
  // al cargar, en cambio, se empieza viendo Semana 1 + Semana 2.
  const lastWeeks = useRef(weeks);
  useEffect(() => {
    if (lastWeeks.current === weeks) return;
    lastWeeks.current = weeks;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [weeks, W]);

  // La posición actual del scroll determina qué semana queda a la izquierda,
  // para habilitar/deshabilitar las flechas.
  function handleScroll() {
    const el = scrollerRef.current;
    if (el) setWeekIndex(Math.max(0, Math.min(maxWeekIndex, Math.round(el.scrollLeft / weekPx))));
  }

  function goToWeek(index) {
    const next = Math.max(0, Math.min(index, maxWeekIndex));
    scrollerRef.current?.scrollTo({ left: next * weekPx, behavior: 'smooth' });
  }

  const { yMin, yMax } = useMemo(() => {
    const elos = validSeries.flatMap((entry) => entry.points.map((point) => point.elo));
    if (elos.length === 0) return { yMin: 0, yMax: 1 };
    const min = Math.min(...elos);
    const max = Math.max(...elos);
    const range = max - min || 1;
    return { yMin: min - range * 0.15, yMax: max + range * 0.15 };
  }, [validSeries]);

  const y = (elo) => H - PAD_Y - ((elo - yMin) / (yMax - yMin || 1)) * (H - chartTop - PAD_Y);

  const hoveredSeries = hover && validSeries.find((entry) => entry.id === hover.seriesId);
  const hoveredPoint =
    hoveredSeries && hover.pointIndex != null
      ? hoveredSeries.points[hover.pointIndex]
      : null;

  // Mide el ancho real de la tarjeta (nowrap) para clamparla sin cortar nombres.
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    setTipWidth((prev) => (Math.abs(w - prev) > 1 ? w : prev));
  }, [hoveredPoint, hover, viewportW]);

  // Posición del tooltip "a prueba de recortes": clampa la X dentro de la
  // ventana visible del scroller según el ancho medido y gira hacia abajo si
  // el nodo está arriba.
  const tipStyle = hover
    ? (() => {
        const winLeft = scrollerRef.current?.scrollLeft || 0;
        const winWidth = viewportW || MIN_W;
        const width = tipWidth || TIP_FALLBACK;
        const half = Math.min(width, winWidth - 16) / 2 + 8;
        const clampedX = Math.max(
          winLeft + half,
          Math.min(hover.x, winLeft + winWidth - half)
        );
        return {
          left: `${(clampedX / W) * 100}%`,
          top: `${(hover.y / H) * 100}%`,
          transform:
            hover.y < TIP_FLIP_LIMIT ? 'translate(-50%, 18px)' : undefined,
        };
      })()
    : null;

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

  return (
    <>
      {weeks > 2 && (
        <div className="elo-chart__nav">
          <span className="elo-chart__nav-label">Semana {weekIndex + 1} y {weekIndex + 2}</span>
          <button type="button" className="elo-chart__arrow" onClick={() => goToWeek(weekIndex - 1)} disabled={weekIndex <= 0} aria-label="Semana anterior">‹</button>
          <button type="button" className="elo-chart__arrow" onClick={() => goToWeek(weekIndex + 1)} disabled={weekIndex >= maxWeekIndex} aria-label="Semana siguiente">›</button>
        </div>
      )}
      <div className="elo-chart__scroller" ref={scrollerRef} onScroll={handleScroll}>
        <div className="elo-chart" style={{ width: W, minWidth: '100%' }}>
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
              return <path key={entry.id} d={linePath} fill="none" stroke={color} strokeWidth={hover?.seriesId === entry.id ? 3.5 : isMulti ? 2.2 : 2.5} opacity={hover && hover.seriesId !== entry.id ? 0.25 : 1} style={{ transition: 'opacity 120ms ease' }} />;
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
                      r={index === 0 ? 4 : isMulti ? 4.5 : 5}
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
            {hover && <><line x1={hover.x} x2={hover.x} y1={chartTop} y2={H - PAD_Y} stroke="rgba(237, 235, 222, 0.25)" strokeDasharray="3 3" /><circle cx={hover.x} cy={hover.y} r={6} fill={isMulti ? colorForId(hover.seriesId) : 'var(--accent)'} stroke="var(--bg)" strokeWidth="2" /></>}
          </svg>

          {/* Puntos de anclaje del scroll: cada columna de semana alinea su
              inicio con la pantalla, así avanza de una en una (1+2 → 2+3...). */}
          {Array.from({ length: Math.max(0, weeks - 1) }, (_, i) => (
            <span key={`snap-${i}`} className="elo-chart__snap" style={{ left: i * weekPx }} aria-hidden />
          ))}

          {hoveredPoint && (
            <div className="elo-chart__tooltip" ref={tooltipRef} style={tipStyle}>
              <strong style={{ color: isMulti ? colorForId(hover.seriesId) : 'var(--accent)' }}>{hoveredSeries.name}</strong>
              {hoveredPoint.match ? (
                <>
                  <span className="elo-chart__tooltip-vs">
                    {hoveredPoint.match.partners.length > 0 ? `Con ${hoveredPoint.match.partners.join(' + ')} · ` : ''}vs {hoveredPoint.match.opponents.join(' + ') || '—'}
                  </span>
                  <span className="elo-chart__tooltip-result" data-result={hoveredPoint.match.won ? 'win' : 'loss'}>
                    {hoveredPoint.match.won ? 'Victoria' : 'Derrota'}
                    {hoveredPoint.match.score?.teamA != null ? ` · ${hoveredPoint.match.score.teamA}–${hoveredPoint.match.score.teamB}` : ''}
                  </span>
                  <span className="elo-chart__tooltip-elo numeric">
                    {hoveredPoint.match.eloBefore.toFixed(2)} → {hoveredPoint.elo.toFixed(2)}
                    <b data-result={hoveredPoint.match.won ? 'win' : 'loss'}>
                      {' '}{hoveredPoint.match.won ? '+' : ''}{(hoveredPoint.elo - hoveredPoint.match.eloBefore).toFixed(2)}
                    </b>
                  </span>
                </>
              ) : (
                <span className="numeric">{hoveredPoint.elo.toFixed(2)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {isMulti && <div className="elo-chart__legend elo-chart__legend--multi">{validSeries.map((entry) => <span key={entry.id} data-dimmed={(hover && hover.seriesId !== entry.id) || undefined}><i style={{ background: colorForId(entry.id) }} />{entry.name}</span>)}</div>}
      {!isMulti && <div className="elo-chart__legend"><span><i data-dot="win" /> Victoria</span><span><i data-dot="loss" /> Derrota</span></div>}
    </>
  );
}
