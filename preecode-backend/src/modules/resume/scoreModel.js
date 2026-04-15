const mongoose = require('mongoose');

const resumeScoreSchema = new mongoose.Schema({
  resumeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetRole:    { type: String, required: true },
  matchScore:    { type: Number, default: 0 },
  missingSkills: [String],
  suggestions:   [String],
  scoredAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('ResumeScore', resumeScoreSchema);
