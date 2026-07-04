'use strict';
const { mongoose } = require('../db/mongo');

const OrganizationSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    slug:       { type: String, required: true, unique: true, index: true, trim: true },
    themeColor: { type: String, default: '#00e5a0' },
    logo:       { type: String, default: null },
    industry:   { type: String, default: 'education', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);
