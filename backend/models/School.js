'use strict';
const { mongoose } = require('../db/mongo');

const SchoolSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    slug:       { type: String, required: true, unique: true, index: true, trim: true },
    themeColor: { type: String, default: '#00e5a0' },
    logo:       { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.School || mongoose.model('School', SchoolSchema);
