const mongoose = require('mongoose');

const pilgrimTimelineNoteSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    pilgrimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pilgrim', required: true, index: true },
    note: { type: String, required: true },
    type: { type: String, enum: ['activity', 'assignment', 'medical', 'visa', 'general'], default: 'general' },
    createdBy: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('PilgrimTimelineNote', pilgrimTimelineNoteSchema);
