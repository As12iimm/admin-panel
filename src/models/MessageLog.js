const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    channel: { type: String, enum: ['sms', 'email', 'whatsapp'], required: true, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate' },
    target: { type: String, required: true },
    payload: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ['queued', 'sent', 'failed', 'delivered'], default: 'queued', index: true },
    providerMessageId: String,
    error: String,
    sentAt: Date,
    deliveredAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('MessageLog', messageLogSchema);
