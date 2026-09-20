# 🎾 Padeliticos

Web full-stack para gestionar el ranking de un grupo de pádel: registro de jugadores, partidos por rondas/temporadas y un **sistema de puntuación tipo Elo adaptado a dobles**, calculado en el backend.

Nació para sustituir un Excel con fórmulas de Elo hechas a mano que el grupo llevaba semana a semana. Sigue en uso real por el grupo.

🔗 **Demo:** [padeliticos.vercel.app](https://padeliticos.vercel.app)

---

## Stack

| | |
|---|---|
| **Frontend** | React 18 · Vite · [dnd-kit](https://dndkit.com/) (drag & drop) |
| **Backend** | Node.js · Express · Mongoose (MongoDB) |
| **Tests** | Node.js test runner (`node --test`) |
| **Deploy** | Vercel |

---

## Funcionalidades

- **Montar partidos** arrastrando jugadores a la pista (parejas de dobles), con previsualización instantánea de probabilidades antes de guardar.
- **Ranking** general de jugadores por Elo.
- **Historial** de partidos jugados, con una gráfica propia (SVG, sin librería externa) de la evolución del Elo de cada jugador a lo largo de las temporadas.
- **Estadísticas por pareja**: histórico de victorias/derrotas de los mismos dos jugadores jugando juntos.
- **Zona de apuestas internas** (oculta, `/apuestas`), con moneda ficticia ("Megalitos"), cuotas calculadas a partir de la probabilidad de victoria y liquidación automática al cerrar el partido.
- **Panel de administración** (oculto, `/admin`) para corregir resultados, jugadores, rondas y temporadas.

---

## Lo más interesante del proyecto

### Elo adaptado a dobles

El Elo clásico (1 vs 1) no encaja tal cual con partidos de parejas. Cada jugador calcula su probabilidad de subir Elo usando un **Elo "efectivo"**: una mezcla del suyo propio (60%) y el de su compañero de equipo (40%). Así, un jugador de nivel bajo que gana al lado de un jugador muy fuerte sube mucho menos que si el cálculo usara solo su propio Elo — el compañero absorbe parte del "mérito".

```js
const PARTNER_WEIGHT = 0.4;

function blendedElo(eloPlayer, eloPartner) {
  return (1 - PARTNER_WEIGHT) * eloPlayer + PARTNER_WEIGHT * eloPartner;
}

function playerWinProbability(eloPlayer, eloPartner, rivalTeamAvg) {
  return 1 / (1 + 10 ** ((rivalTeamAvg - blendedElo(eloPlayer, eloPartner)) / 4));
}
```

Este comportamiento está cubierto por tests unitarios que comparan la fórmula real contra una fórmula de referencia más simple (solo Elo propio, sin mezclar con el compañero), para garantizar que el efecto es el esperado:

```js
test('un jugador débil sube mucho menos al ganar con un crack que en el Excel', () => {
  const pre = computePreMatch([0.5, 3.5], [2.5, 2.5]);
  const [probDebil, probCrack] = pre.teamA.playerProbabilities;
  const subida = (p) => 0.5 * (1 - p);

  assert.ok(subida(probDebil) > subida(probCrack));
  // ...pero mucho menos que con la fórmula de referencia (solo Elo propio)
});
```

### Otras decisiones de diseño

- **Elo de pretemporada como base fija por temporada**: dentro de una misma temporada, todos los partidos se calculan contra el Elo con el que empezó esa temporada, no contra el acumulado ronda a ronda — así ganar la ronda 1 no infla artificialmente las probabilidades de la ronda 2. El ranking global, en cambio, sí acumula los cambios partido a partido.
- **Recalculo idempotente del ranking**: al corregir el resultado de un partido, el histórico completo se reconstruye desde cero en orden cronológico, en vez de aplicar parches incrementales — evita errores de arrastre.
- **Transacciones de MongoDB** al cerrar un partido: actualizar el Elo de los 4 jugadores, guardar el historial y liquidar las apuestas asociadas ocurre de forma atómica.
- **Mini sistema de apuestas internas** ("Megalitos") sobre los partidos pendientes, con cuotas congeladas al apostar y liquidación reversible si se corrige un resultado.

---

## Estructura del proyecto

```
padeliticos/
├── backend/
│   ├── config/            # conexión a MongoDB
│   ├── models/             # Player, Match, Season, Round, EloHistory, Bet, Bettor
│   ├── services/           # eloService, ratingService, betService, matchStatsService
│   ├── controllers/        # lógica de cada endpoint
│   ├── routes/              # definición de rutas REST
│   ├── middleware/          # auth de admin y de apuestas
│   ├── test/                # tests unitarios (node --test)
│   └── app.js                # punto de entrada del servidor
└── frontend/
    ├── components/
    │   ├── match/            # CourtBuilder (drag & drop), pistas, panel de resultado
    │   ├── ranking/
    │   ├── matches/
    │   ├── history/           # historial + gráfica de evolución de Elo
    │   ├── bets/               # zona de apuestas
    │   ├── players/
    │   ├── admin/
    │   └── layout/
    ├── utils/elo.js            # espejo del cálculo de Elo, solo para preview en cliente
    ├── api/client.js            # cliente HTTP hacia el backend
    └── App.jsx                  # enrutado simple por pathname
```

---

## Cómo correrlo en local

### Backend

```bash
cd backend
cp .env.example .env   # define MONGO_URI, ADMIN_KEY y BETS_KEY
npm install
npm run dev             # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173
```

### Tests

```bash
cd backend
npm test
```

---

## Notas

- `/admin` y `/apuestas` son rutas sin enlace visible en la navegación, protegidas por claves distintas vía cabecera HTTP (`x-admin-key`, `x-bets-key`).
- El cálculo de Elo del frontend (`utils/elo.js`) es solo para previsualización instantánea en la UI; el resultado que se persiste siempre lo valida y calcula el backend.
- Los secretos reales (`.env`) están excluidos del control de versiones vía `.gitignore`; `.env.example` solo contiene los nombres de las variables necesarias, no valores reales.