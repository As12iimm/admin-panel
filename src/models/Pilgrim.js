const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema(
  {
    name: String,
    relation: String,
    phone: String,
    priority: { type: Number, default: 1 }
  },
  { _id: false }
);

const pilgrimSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    fullName: { type: String, required: true, index: true },
    phone: { type: String, index: true },
    email: String,
    passportNo: { type: String, index: true },
    nationality: { type: String, index: true },
    gender: String,
    dateOfBirth: Date,
    familyGroupId: { type: String, index: true },
    groupRole: { type: String, enum: ['head', 'member'], default: 'member' },
    assignedTo: String,
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    medicalNotes: String,
    vaccineStatus: { type: String, enum: ['pending', 'complete'], default: 'pending' },
    visaStatus: { type: String, enum: ['not_started', 'in_review', 'approved', 'rejected'], default: 'not_started' },
    visaStage: { type: String, enum: ['draft', 'submitted', 'embassy_review', 'stamped', 'issued', 'rejected'], default: 'draft', index: true },
    visaSlaDueAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pilgrim', pilgrimSchema);
