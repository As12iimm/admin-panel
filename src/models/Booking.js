const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    bookingRef: { type: String, required: true, unique: true, index: true },
    pilgrimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pilgrim', required: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true, index: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending', index: true },
    roomType: { type: String, enum: ['quad', 'triple', 'double', 'single'], default: 'quad' },
    roomAllocation: String,
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    cancellationReason: String,
    cancelledAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
