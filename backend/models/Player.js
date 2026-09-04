import mongoose from 'mongoose';
const { Schema } = mongoose;
import { ELO_MIN, ELO_MAX } from '../services/eloService.js';

const eloRange = {
  min: [ELO_MIN, `El elo no puede ser menor que ${ELO_MIN}`],
  max: [ELO_MAX, `El elo no puede ser mayor que ${ELO_MAX}`],
};

const playerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Elo "en vivo": se actualiza cada vez que el jugador cierra un partido.
    // Rango tipo Playtomic: [0.5, 7].
    currentElo: {
      type: Number,
      required: true,
      default: 1.0,
      ...eloRange,
    },
    // Elo con el que el jugador entró al sistema (equivale a "Semana 0" del Excel).
    initialElo: {
      type: Number,
      required: true,
      ...eloRange,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Player', playerSchema);
