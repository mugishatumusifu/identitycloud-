'use strict';
const { mongoose } = require('../db/mongo');

const StudentSchema = new mongoose.Schema(
  {
    studentId:     { type: String, required: true, trim: true },
    fullName:      { type: String, required: true, trim: true },
    photoUrl:      { type: String, default: null },          // Cloudinary secure_url
    photoPublicId: { type: String, default: null },          // for future deletion
    // Ready-to-download student card PDF, pushed from CardNova Studio at
    // publish time (the exact same PDF Export produces). cardPdfUrl points
    // at the full card PDF (front, or front+back combined when the
    // template has a back side and it was included). cardPdfHasBack tells
    // the frontend whether page 2 of that PDF is the back side, so it can
    // offer a "front" and "back" download that both point at the same file
    // (front = page 1, back = page 2) without needing two separate assets.
    cardPdfUrl:      { type: String, default: null },
    cardPdfPublicId: { type: String, default: null },
    cardPdfHasBack:  { type: Boolean, default: false },
    schoolSlug:    { type: String, required: true, index: true },
    class:         { type: String, default: null },
    status:        { type: String, enum: ['active', 'expired', 'revoked'], default: 'active', index: true },
    issuedAt:      { type: String, default: null },
    expiresAt:     { type: String, default: null },
    scanCount:     { type: Number, default: 0 },
    lastScannedAt: { type: String, default: null },

    // ── Universal record support (additive, all optional) ──────────────────
    // entityType: machine key for the kind of record within its project's
    // industry, e.g. "patient", "employee", "attendee". Defaults to "student"
    // so every pre-existing document keeps behaving exactly as before.
    entityType: { type: String, default: 'student', index: true, trim: true },
    // data: free-form bag holding any industry-specific fields that don't
    // have a first-class column (e.g. department, ward, badgeLevel...).
    // `class` remains a first-class field for education records/back-compat.
    data:       { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Unique per (school, student)
StudentSchema.index({ schoolSlug: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);
