const mongoose = require('mongoose');

const pilgrimTravelHistorySchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    pilgrimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pilgrim', required: true, index: true },
    tripType: { type: String, enum: ['hajj', 'umrah', 'ziyara', 'other'], default: 'umrah' },
    packageName: String,
    departureDate: Date,
    returnDate: Date,
    status: { type: String, enum: ['planned', 'completed', 'cancelled'], default: 'planned' },
    notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('PilgrimTravelHistory', pilgrimTravelHistorySchema);
