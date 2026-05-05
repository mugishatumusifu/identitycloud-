'use strict';
const { mongoose } = require('../db/mongo');

const AdminSchema = new mongoose.Schema(
  {
    username:     { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
