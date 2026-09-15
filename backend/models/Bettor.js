import mongoose from 'mongoose';
const { Schema } = mongoose;

// Apostador del banco de Megalitos. El saldo (balance) solo cambia al
// recargarlo (clave de ADMIN) o cuando sus apuestas se liquidan (won/lost).
// Mientras una apuesta está pendiente, su importe queda "reservado" y no se
// puede volver a apostar ese saldo, aunque aún no se haya movido el balance.
const bettorSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Bettor', bettorSchema);