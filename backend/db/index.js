'use strict';

/**
 * Identity Cloud — Database Facade (MongoDB Atlas via Mongoose)
 * ─────────────────────────────────────────────────────────────
 * Exposes the SAME async API surface previously provided by the LokiJS adapter
 * so existing callers (app.js, admin.js, create-admin.js) continue to work
 * unchanged:
 *
 *   const db = await getDB();
 *   await db.schools.findOne({ slug });
 *   await db.students.find({ schoolSlug });
 *   await db.students.create({...});
 *   await db.students.findOneAndUpdate(filter, { $set: {...} });
 *   await db.save();   // no-op for Mongo (writes are immediate)
 *
 * No data is ever lost: legacy Loki data is preserved on disk and can be
 * imported via `node scripts/migrate-loki-to-mongo.js`.
 */

const path = require('path');
const fs   = require('fs');

const { connectMongo, mongoose } = require('./mongo');

const School  = require('../models/School');
const Student = require('../models/Student');
const Log     = require('../models/Log');
const Admin   = require('../models/Admin');

// Kept so legacy code (admin secret file, migration script) still resolves paths.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE  = process.env.DB_FILE  || path.join(DATA_DIR, 'identity-cloud.db');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Strip Mongoose internals so responses look like the previous API.
function clean(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  // Coerce _id to a string (was UUID string under Loki).
  if (o._id && typeof o._id !== 'string') o._id = String(o._id);
  delete o.__v;
  return o;
}

function buildQuery(filter = {}) {
  // Mongoose understands the same operators ($in, $regex, $eq...). Pass through.
  return filter || {};
}

function wrap(Model) {
  return {
    _model: Model,

    async countDocuments(filter = {}) {
      return Model.countDocuments(buildQuery(filter));
    },

    async find(filter = {}) {
      const docs = await Model.find(buildQuery(filter)).lean();
      return docs.map(clean);
    },

    async findOne(filter = {}) {
      const doc = await Model.findOne(buildQuery(filter)).lean();
      return clean(doc);
    },

    async findById(id) {
      try {
        const doc = await Model.findById(id).lean();
        return clean(doc);
      } catch (_) { return null; }
    },

    async create(data) {
      const doc = await Model.create(data);
      return clean(doc);
    },

    async findOneAndUpdate(filter = {}, update = {}, opts = {}) {
      const fields = update.$set ? update : { $set: update };
      const doc = await Model.findOneAndUpdate(
        buildQuery(filter),
        fields,
        { new: true, upsert: !!opts.upsert, setDefaultsOnInsert: true }
      ).lean();
      return clean(doc);
    },

    async findByIdAndUpdate(id, update = {}, opts = {}) {
      const fields = update.$set ? update : { $set: update };
      const doc = await Model.findByIdAndUpdate(id, fields, {
        new: true, upsert: !!opts.upsert, setDefaultsOnInsert: true,
      }).lean();
      return clean(doc);
    },

    async updateMany(filter = {}, update = {}) {
      const fields = update.$set ? update : { $set: update };
      const r = await Model.updateMany(buildQuery(filter), fields);
      return { modifiedCount: r.modifiedCount || 0 };
    },

    async findOneAndDelete(filter = {}) {
      const doc = await Model.findOneAndDelete(buildQuery(filter)).lean();
      return clean(doc);
    },

    async deleteMany(filter = {}) {
      const r = await Model.deleteMany(buildQuery(filter));
      return { deletedCount: r.deletedCount || 0 };
    },

    async save() { /* no-op — Mongo writes are immediate */ },
  };
}

let _dbPromise = null;

async function initDB() {
  await connectMongo();
  const api = {
    schools:  wrap(School),
    students: wrap(Student),
    logs:     wrap(Log),
    admins:   wrap(Admin),
    _mongoose: mongoose,
    async save() { /* no-op for Mongo */ },
  };
  return api;
}

async function getDB() {
  if (!_dbPromise) _dbPromise = initDB();
  return _dbPromise;
}

module.exports = { getDB, DB_FILE, DATA_DIR };
