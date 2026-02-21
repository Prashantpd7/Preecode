const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  provider: { type: String, enum: ['local', 'google'], default: 'local' },
  providerId: { type: String },
  avatar: { type: String },
  totalSolved: { type: Number, default: 0 },
  easySolved: { type: Number, default: 0 },
  mediumSolved: { type: Number, default: 0 },
  hardSolved: { type: Number, default: 0 },

  // Early Access & Plan fields
  plan: { type: String, enum: ['free', 'pro'], default: 'pro' },
  subscriptionStatus: { type: String, enum: ['active', 'inactive'], default: 'active' },
  earlyAccessEndDate: { type: Date },
  earlyAccessMonthsGranted: { type: Number, default: 3 },
  hasShared: { type: Boolean, default: false },
  foundingBadgeLevel: { type: String, enum: ['basic', 'elite'], default: 'basic' },
  certificateId: { type: String, unique: true, sparse: true },

  createdAt: { type: Date, default: Date.now },
});

// Set early access defaults before first save
userSchema.pre('save', async function (next) {
  // Hash password if modified (skip for OAuth users with no password)
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  // Set early access fields on new user creation
  if (this.isNew) {
    if (!this.earlyAccessEndDate) {
      var end = new Date();
      end.setMonth(end.getMonth() + 3);
      this.earlyAccessEndDate = end;
    }
    if (!this.certificateId) {
      this.certificateId = crypto.randomUUID();
    }
  }

  next();
});

// Compare candidate password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
