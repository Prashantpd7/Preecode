const mongoose = require('mongoose');

const builtResumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'My Resume' },
  personalInfo: {
    fullName: String,
    email: String,
    phone: String,
    location: String,
    linkedin: String,
    github: String,
    portfolio: String
  },
  summary: String,
  education: [{
    institution: String,
    degree: String,
    fieldOfStudy: String,
    startDate: String,
    endDate: String,
    score: String
  }],
  experience: [{
    company: String,
    role: String,
    location: String,
    startDate: String,
    endDate: String,
    description: String
  }],
  projects: [{
    name: String,
    link: String,
    description: String
  }],
  skills: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BuiltResume', builtResumeSchema);
