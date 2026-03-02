const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    fullName: { type: String, required: true, index: true },
    phone: String,
    source: { type: String, default: 'walk_in', index: true },
    campaign: { type: String, default: 'direct', index: true },
    assignedTo: String,
    status: {
      type: String,
      enum: ['new', 'follow_up', 'qualified', 'proposal_sent', 'converted', 'lost'],
      default: 'new',
      index: true
    },
    slaDueAt: Date,
    convertedAt: Date,
    notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
