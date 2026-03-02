const mongoose = require('mongoose');

const pilgrimDocumentSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    pilgrimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pilgrim', required: true, index: true },
    category: {
      type: String,
      enum: ['passport', 'visa', 'vaccine_certificate', 'ticket', 'photo', 'other'],
      default: 'other'
    },
    fileName: { type: String, required: true },
    mimeType: String,
    size: Number,
    data: { type: Buffer, required: true },
    uploadedBy: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('PilgrimDocument', pilgrimDocumentSchema);
