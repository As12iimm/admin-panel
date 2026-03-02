const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: String,
    ip: String,
    deviceName: String,
    revokedAt: Date,
    lastUsedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
