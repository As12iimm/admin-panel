const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: "default", index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
    note: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
