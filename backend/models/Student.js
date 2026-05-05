'use strict';
const { mongoose } = require('../db/mongo');

const StudentSchema = new mongoose.Schema(
  {
    studentId:     { type: String, required: true, trim: true },
    fullName:      { type: String, required: true, trim: true },
    photoUrl:      { type: String, default: null },          // Cloudinary secure_url
    photoPublicId: { type: String, default: null },          // for future deletion
    schoolSlug:    { type: String, required: true, index: true },
    class:         { type: String, default: null },
    status:        { type: String, enum: ['active', 'expired', 'revoked'], default: 'active', index: true },
    issuedAt:      { type: String, default: null },
    expiresAt:     { type: String, default: null },
    scanCount:     { type: Number, default: 0 },
    lastScannedAt: { type: String, default: null },
  },
  { timestamps: true }
);

// Unique per (school, student)
StudentSchema.index({ schoolSlug: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);
