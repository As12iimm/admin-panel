const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['hajj', 'umrah'], required: true },
    startDate: Date,
    endDate: Date,
    hotel: String,
    transport: String,
    capacity: { type: Number, default: 0 },
    bookedSeats: { type: Number, default: 0 },
    basePrice: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Package', packageSchema);
