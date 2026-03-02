const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'operations', 'accounts', 'medical', 'agent'],
      default: 'agent'
    },
    active: { type: Boolean, default: true },
    branchIds: { type: [String], default: ['default'] },
    assignedPackageIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Package', default: [] },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    mfaEnabled: { type: Boolean, default: true },
    mfaCodeHash: String,
    mfaCodeExpiresAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
