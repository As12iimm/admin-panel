const mongoose = require('mongoose');

const complianceDocumentSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    pilgrimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pilgrim', required: true, index: true },
    packageType: { type: String, enum: ['hajj', 'umrah', 'other'], default: 'umrah', index: true },
    nationality: { type: String, index: true },
    docType: {
      type: String,
      enum: ['passport', 'visa', 'vaccine_certificate', 'photo', 'ticket', 'hotel_voucher', 'other'],
      required: true
    },
    status: { type: String, enum: ['missing', 'submitted', 'verified', 'rejected'], default: 'missing', index: true },
    expiryDate: Date,
    slaDueAt: Date,
    notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('ComplianceDocument', complianceDocumentSchema);
