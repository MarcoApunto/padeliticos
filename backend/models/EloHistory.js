import mongoose from 'mongoose';
const { Schema } = mongoose;

// Un documento por jugador y por partido jugado.
// Permite reconstruir la evolución del Elo semana a semana,
// tal como las columnas "Semana 0/1/2/3" de la hoja "Ranking" del Excel.
const eloHistorySchema = new Schema(
  {
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    season: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    match: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    eloBefore: { type: Number, required: true },
    eloAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

eloHistorySchema.index({ player: 1, createdAt: 1 });

export default mongoose.model('EloHistory', eloHistorySchema);
