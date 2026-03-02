const mongoose = require('mongoose');

const leadTaskSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    title: { type: String, required: true },
    dueAt: { type: Date, required: true, index: true },
    assignedTo: String,
    status: { type: String, enum: ['open', 'done', 'overdue'], default: 'open', index: true },
    reminderAt: Date,
    notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadTask', leadTaskSchema);
