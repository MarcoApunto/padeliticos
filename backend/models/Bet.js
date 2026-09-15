import mongoose from 'mongoose';
const { Schema } = mongoose;

// Apuesta de un apostador a un lado (1|2) de un partido pendiente.
// La cuota se congela al apostar (1 / probabilidad del lado elegido) y el
// saldo del apostador solo se mueve al liquidar el partido (status won/lost),
// nunca antes. settledDelta guarda el efecto total aplicado al saldo para
// poder revertirlo si el resultado se corrige (PUT /result) y re-liquidar.
const betSchema = new Schema(
  {
    bettor: { type: Schema.Types.ObjectId, ref: 'Bettor', required: true },
    match: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    team: { type: Number, enum: [1, 2], required: true },
    // Megalitos apostados (stake)
    amount: { type: Number, required: true, min: 0.01 },
    // Cuota congelada: Megalitos * (Cuota - 1)
    cuota: { type: Number, required: true },
    // Cancelar una apuesta no la borra: pasa a 'cancelled' para que el
    // historial quede fijo e imborrable.
    status: {
      type: String,
      enum: ['pending', 'won', 'lost', 'cancelled'],
      default: 'pending',
    },
    settledDelta: { type: Number, default: 0 },
    settledAt: Date,
  },
  { timestamps: true }
);

betSchema.index({ match: 1, status: 1 });
betSchema.index({ bettor: 1, status: 1 });

export default mongoose.model('Bet', betSchema);