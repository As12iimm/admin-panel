const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    name: { type: String, required: true, index: true },
    channel: { type: String, enum: ['sms', 'email', 'whatsapp'], required: true },
    triggerType: { type: String, enum: ['due_reminder', 'doc_expiry', 'departure', 'visa_sla', 'custom'], default: 'custom', index: true },
    subject: String,
    body: { type: String, required: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);
