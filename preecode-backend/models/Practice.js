const mongoose = require('mongoose');

const practiceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true },
  timeTaken: { type: String, required: true },
  hintsUsed: { type: Number, default: 0 },
  solutionViewed: { type: Boolean, default: false },
  language: { type: String, required: true },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Practice', practiceSchema);
