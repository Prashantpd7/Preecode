const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionText: { type: String },
  expectedKeywords: [String],
  audioBase64: { type: String },
  transcription: { type: String },
  aiFeedback: { type: String },
  answerScore: {
    relevance: { type: Number, default: 0 },
    completeness: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
  },
  speechMetrics: {
    speechRate: { type: Number, default: 0 },
    fillerWordPercent: { type: Number, default: 0 },
    clarityScore: { type: Number, default: 0 },
    energyScore: { type: Number, default: 0 },
  },
}, { _id: false });

const interviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true },
  difficulty: { type: String, required: true },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
  overallScore: { type: Number, default: 0 },
  currentQuestion: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 5 },
  questions: [answerSchema],
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

interviewSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Interview', interviewSchema);
