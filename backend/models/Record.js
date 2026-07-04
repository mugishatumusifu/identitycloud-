'use strict';
const { mongoose } = require('../db/mongo');

const RecordSchema = new mongoose.Schema(
  {
    recordId:      { type: String, required: true, trim: true }, // e.g. studentId, employeeId, patientId
    fullName:      { type: String, required: true, trim: true },
    photoUrl:      { type: String, default: null },          // Cloudinary secure_url
    photoPublicId: { type: String, default: null },          // for future deletion
    orgSlug:       { type: String, required: true, index: true },
    entityType:    { type: String, default: 'student', index: true }, // e.g. student, employee, patient
    category:      { type: String, default: null },          // e.g. class, department, ward
    status:        { type: String, enum: ['active', 'expired', 'revoked'], default: 'active', index: true },
    issuedAt:      { type: String, default: null },
    expiresAt:     { type: String, default: null },
    scanCount:     { type: Number, default: 0 },
    lastScannedAt: { type: String, default: null },
    metadata:      { type: Map, of: String, default: {} },   // extra fields
  },
  { timestamps: true }
);

// Unique per (org, record)
RecordSchema.index({ orgSlug: 1, recordId: 1 }, { unique: true });

// Aliases for backward compatibility
RecordSchema.virtual('studentId').get(function() { return this.recordId; }).set(function(v) { this.recordId = v; });
RecordSchema.virtual('schoolSlug').get(function() { return this.orgSlug; }).set(function(v) { this.orgSlug = v; });
RecordSchema.virtual('class').get(function() { return this.category; }).set(function(v) { this.category = v; });

RecordSchema.set('toJSON', { virtuals: true });
RecordSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Record || mongoose.model('Record', RecordSchema);
