'use strict';
const { mongoose } = require('../db/mongo');

const LogSchema = new mongoose.Schema(
  {
    action:    { type: String, required: true, index: true },
    entity:    { type: String, required: true },
    message:   { type: String, default: '' },
    metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: String, default: () => new Date().toISOString(), index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Log || mongoose.model('Log', LogSchema);
