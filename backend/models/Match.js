import mongoose from 'mongoose';
const { Schema } = mongoose;

// Cada equipo son 2 jugadores (dobles). Los campos calculados
// (avgElo, winProbability, eloAfter...) se rellenan en el backend,
// nunca los manda el frontend directamente.
const teamSchema = new Schema(
  {
    players: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
      validate: {
        validator: (arr) => arr.length === 2,
        message: 'Cada equipo debe tener exactamente 2 jugadores.',
      },
      required: true,
    },
    // Nota manual por jugador (0-10), opcional. Si falta, se trata como 5 (neutro),
    // igual que en el Excel: IF(Nota="", 5, Nota).
    notes: {
      type: [Number],
      default: undefined,
    },
    // --- Campos calculados por el backend al crear/cerrar el partido ---
    eloBefore: [Number], // snapshot del elo de cada jugador antes del partido
    eloAfter: [Number], // elo resultante tras aplicar la fórmula (solo cuando hay winner)
    avgElo: Number, // "Media" del equipo
    winProbability: Number, // "Probabilidad de victoria" del equipo
  },
  { _id: false }
);

const matchSchema = new Schema(
  {
    round: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
    number: { type: Number, required: true }, // "Partido 1", "Partido 2"...
    teamA: { type: teamSchema, required: true },
    teamB: { type: teamSchema, required: true },
    eloDifference: Number, // "Diferencia de elo" (desde el punto de vista de teamA)
    // null = partido aún sin resultado. 1 = gana teamA, 2 = gana teamB.
    winner: { type: Number, enum: [1, 2, null], default: null },
    playedAt: Date,
  },
  { timestamps: true }
);

matchSchema.index({ round: 1, number: 1 }, { unique: true });

export default mongoose.model('Match', matchSchema);
