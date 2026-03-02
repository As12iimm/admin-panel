const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    invoiceNo: { type: String, required: true, unique: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    pilgrimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pilgrim', required: true, index: true },
    subtotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['draft', 'issued', 'approved', 'paid', 'cancelled'], default: 'issued', index: true },
    approvedBy: String,
    approvedAt: Date,
    pdfBase64: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
