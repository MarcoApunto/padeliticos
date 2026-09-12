import mongoose from 'mongoose';
const { Schema } = mongoose;

// Equivale a una hoja "Semana X" del Excel.
const seasonSchema = new Schema(
  {
    name: { type: String, required: true }, // "Semana 1"
    // Base de ELO de PRETEMPORADA por jugador (snapshot del currentElo de cada
    // jugador al CREAR la temporada, es decir, lo acumulado de la temporada
    // anterior). Es la referencia FIJA con la que se calcula probabilidad y
    // eloBefore de TODOS los partidos de la temporada: la Ronda 2 no tiene en
    // cuenta lo ganado o perdido en la Ronda 1. currentElo (del jugador) sigue
    // acumulando los deltas para el ranking y para ser la base de la siguiente
    // temporada. Si un jugador no aparece (temporada antigua sin snapshot o
    // dado de alta a mitad de temporada), se usa su elo acumulado como base.
    baseEloByPlayer: { type: Map, of: Number, default: () => new Map() },
  },
  { timestamps: true }
);

export default mongoose.model('Season', seasonSchema);
