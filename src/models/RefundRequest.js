const mongoose = require('mongoose');

const refundRequestSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    amount: { type: Number, required: true },
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'processed'], default: 'pending', index: true },
    requestedBy: String,
    approvedBy: String,
    approvedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('RefundRequest', refundRequestSchema);
