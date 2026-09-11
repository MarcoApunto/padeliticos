import mongoose from 'mongoose';
const { Schema } = mongoose;

// Equivale a una hoja "Semana X" del Excel.
const seasonSchema = new Schema(
  {
    name: { type: String, required: true }, // "Semana 1"
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    closed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Season', seasonSchema);
