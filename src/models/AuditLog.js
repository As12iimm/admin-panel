const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    changes: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
