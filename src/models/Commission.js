const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    agentId: String,
    ratePercent: { type: Number, default: 0 },
    baseAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved', 'paid'], default: 'pending', index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Commission', commissionSchema);
