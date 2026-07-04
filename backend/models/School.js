'use strict';
const { mongoose } = require('../db/mongo');

const FieldDefSchema = new mongoose.Schema(
  {
    key:        { type: String, required: true, trim: true },
    label:      { type: String, required: true, trim: true },
    type:       { type: String, default: 'text' },
    showOnCard: { type: Boolean, default: true },
  },
  { _id: false }
);

const SchoolSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    slug:       { type: String, required: true, unique: true, index: true, trim: true },
    themeColor: { type: String, default: '#00e5a0' },
    logo:       { type: String, default: null },

    industry:          { type: String, default: 'education', index: true, trim: true },
    entityLabel:       { type: String, default: 'Student' },
    entityLabelPlural: { type: String, default: 'Students' },
    fieldDefinitions:  { type: [FieldDefSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.School || mongoose.model('School', SchoolSchema);
