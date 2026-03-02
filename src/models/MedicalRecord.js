const mongoose = require('mongoose');

const clearanceStepSchema = new mongoose.Schema(
  {
    step: { type: String, enum: ['nurse_review', 'doctor_review', 'chief_medical_approval'], required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: String,
    reviewedAt: Date,
    note: String
  },
  { _id: false }
);

const medicalRecordSchema = new mongoose.Schema(
  {
    branchId: { type: String, default: 'default', index: true },
    pilgrimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pilgrim', required: true, index: true },
    bloodGroup: String,
    chronicConditions: [String],
    allergies: [String],
    fitnessStatus: { type: String, enum: ['fit', 'unfit', 'pending'], default: 'pending', index: true },
    vaccinationStatus: { type: String, enum: ['pending', 'partial', 'complete'], default: 'pending', index: true },
    clearanceWorkflowStatus: { type: String, enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'], default: 'draft', index: true },
    clearanceSteps: {
      type: [clearanceStepSchema],
      default: [
        { step: 'nurse_review', status: 'pending' },
        { step: 'doctor_review', status: 'pending' },
        { step: 'chief_medical_approval', status: 'pending' }
      ]
    },
    nextReviewDueAt: Date,
    clearanceDate: Date,
    doctorNotes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
