import mongoose from 'mongoose';
const { Schema } = mongoose;

// "Ronda 1", "Ronda 2"... dentro de una Season.
const roundSchema = new Schema(
  {
    season: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    number: { type: Number, required: true },
  },
  { timestamps: true }
);

roundSchema.index({ season: 1, number: 1 }, { unique: true });

export default mongoose.model('Round', roundSchema);
