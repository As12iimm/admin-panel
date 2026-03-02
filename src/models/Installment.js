const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'overdue', 'paid'], default: 'pending', index: true },
    reminderSentAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Installment', installmentSchema);
