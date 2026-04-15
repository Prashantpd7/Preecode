const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:          { type: String, required: true },
  difficulty:    { type: String, required: true },
  resumeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
  questions:     { type: Array, default: [] },
  status:        { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  overallScore:  { type: Number, default: 0 },
  createdAt:     { type: Date, default: Date.now },
  completedAt:   { type: Date },
});

module.exports = mongoose.model('Interview', interviewSchema);
