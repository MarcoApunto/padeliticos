import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';

import playersRouter from './routes/players.js';
import seasonsRouter from './routes/seasons.js';
import roundsRouter from './routes/rounds.js';
import matchesRouter from './routes/matches.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/players', playersRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/rounds', roundsRouter);
app.use('/api/matches', matchesRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Manejador de errores genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
});

export default app;
