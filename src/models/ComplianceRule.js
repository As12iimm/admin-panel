const mongoose = require('mongoose');

const complianceRuleSchema = new mongoose.Schema(
  {
    nationality: { type: String, required: true, index: true },
    packageType: { type: String, enum: ['hajj', 'umrah', 'other'], required: true, index: true },
    requiredDocs: { type: [String], default: [] },
    slaDays: { type: Number, default: 7 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ComplianceRule', complianceRuleSchema);
