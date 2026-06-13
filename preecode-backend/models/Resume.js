const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileName: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'docx', 'txt'], default: 'pdf' },
  fileSize: { type: Number },
  fileData: { type: Buffer },
  textContent: { type: String },
  targetRole: { type: String },
  atsScore: { type: Number, default: 0 },
  structureScore: { type: Number, default: 0 },
  skills: [String],
  analysis: {
    matchScore: { type: Number, default: 0 },
    missingSkills: [String],
    missingKeywords: [String],
    strengths: [String],
    weaknesses: [String],
    suggestions: [String],
    rawAnalysis: { type: String },
  },
  uploadedAt: { type: Date, default: Date.now },
});

resumeSchema.index({ userId: 1, uploadedAt: -1 });

module.exports = mongoose.model('Resume', resumeSchema);
