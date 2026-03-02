const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    channel: { type: String, enum: ['sms', 'email', 'whatsapp', 'in_app'], default: 'in_app' },
    target: String,
    message: { type: String, required: true },
    type: { type: String, enum: ['due_reminder', 'doc_expiry', 'visa_sla', 'medical_review'], default: 'due_reminder' },
    sentAt: Date,
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
