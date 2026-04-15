const mongoose = require('mongoose');

const interviewAnswerSchema = new mongoose.Schema({
  interviewId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionText:  { type: String, required: true },
  audioUrl:      { type: String, default: '' },
  transcription: { type: String, default: '' },
  speechMetrics: {
    speechRate:          { type: Number, default: 0 },
    fillerWordPercent:   { type: Number, default: 0 },
    clarityScore:        { type: Number, default: 0 },
    energyScore:         { type: Number, default: 0 },
  },
  answerScore: {
    relevance:     { type: Number, default: 0 },
    completeness:  { type: Number, default: 0 },
    clarity:       { type: Number, default: 0 },
  },
  aiFeedback:  { type: String, default: '' },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('InterviewAnswer', interviewAnswerSchema);
