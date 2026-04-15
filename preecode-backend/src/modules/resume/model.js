const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName:      { type: String, required: true },
  fileUrl:       { type: String, default: '' },
  extractedText: { type: String, default: '' },
  skills:        [String],
  experience:    [String],
  keywords:      [String],
  atsScore:      { type: Number, default: 0 },
  structureScore:{ type: Number, default: 0 },
  uploadedAt:    { type: Date, default: Date.now },
});

module.exports = mongoose.model('Resume', resumeSchema);
