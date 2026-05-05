'use strict';

/**
 * Identity Cloud – LokiJS Database Adapter
 * ─────────────────────────────────────────
 * Provides a simple async API over LokiJS with file persistence.
 *
 * Collections:
 *   schools   – one doc per school (slug is the unique key)
 *   students  – one doc per student (schoolSlug + studentId is the unique key)
 */

const Loki = require('lokijs');
const path = require('fs') && require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const { isGitHubConfigured, pullDbFromGitHub, saveDbToGitHub } = require('../githubStorage');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE  = process.env.DB_FILE  || path.join(DATA_DIR, 'identity-cloud.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Internal helpers ──────────────────────────────────────────────────────────

function stripLoki(doc) {
  if (!doc) return null;
  const out = {};
  for (const k of Object.keys(doc)) {
    if (k !== '$loki' && k !== 'meta') out[k] = doc[k];
  }
  return out;
}

/**
 * Build a LokiJS query from a plain filter object.
 * Supports: exact match, $in, $regex.
 */
function buildQuery(filter = {}) {
  if (!filter || Object.keys(filter).length === 0) return {};
  const query = {};
  for (const [key, val] of Object.entries(filter)) {
    if (val === undefined || val === null) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      query[key] = val; // pass through $in, $regex, etc.
    } else {
      query[key] = { $eq: val };
    }
  }
  return query;
}

// ── Database singleton ────────────────────────────────────────────────────────

let _db = null;
let _ready = false;

function getOrCreate(db, name, options = {}) {
  return db.getCollection(name) || db.addCollection(name, options);
}

async function initDB() {
  // ── Pull latest DB from GitHub before LokiJS loads the file ─────────────────
  if (isGitHubConfigured()) {
    try {
      const pulled = await pullDbFromGitHub(DB_FILE);
      if (pulled) console.log('[db] Loaded latest DB from GitHub');
    } catch (err) {
      console.warn('[db] Could not pull DB from GitHub on startup:', err.message);
    }
  }

  return new Promise((resolve, reject) => {
    const db = new Loki(DB_FILE, {
      autoload: true,
      autoloadCallback: () => {
        try {
          const schools  = getOrCreate(db, 'schools',  { unique: ['slug'] });
          const students = getOrCreate(db, 'students', { indices: ['schoolSlug', 'studentId'] });
          const logs     = getOrCreate(db, 'logs');
          const admins   = getOrCreate(db, 'admins',   { unique: ['username'] });

          // ── Intercept saveDatabase to sync to GitHub after every local save ──
          const _origSave = db.saveDatabase.bind(db);
          db.saveDatabase = function (cb) {
            _origSave(function (err) {
              if (!err) saveDbToGitHub(DB_FILE);
              if (cb) cb(err);
            });
          };

          // Wrapper to give a clean, promise-based API
          const wrap = (col) => ({
            _col: col,

            // ── Count ──────────────────────────────────────────────
            countDocuments(filter = {}) {
              const q = buildQuery(filter);
              const results = col.find(q);
              return Promise.resolve(results.length);
            },

            // ── Find (returns array immediately) ───────────────────
            find(filter = {}) {
              const q = buildQuery(filter);
              const results = col.find(q).map(stripLoki);
              return Promise.resolve(results);
            },

            // ── FindOne ────────────────────────────────────────────
            findOne(filter = {}) {
              const q = buildQuery(filter);
              const raw = col.findOne(q);
              return Promise.resolve(stripLoki(raw));
            },

            // ── FindById ───────────────────────────────────────────
            findById(id) {
              const raw = col.findOne({ _id: { $eq: id } });
              return Promise.resolve(stripLoki(raw));
            },

            // ── Create ─────────────────────────────────────────────
            create(data) {
              const doc = {
                _id: uuidv4(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...data,
              };
              col.insert(doc);
              db.saveDatabase(() => {});
              return Promise.resolve(stripLoki(doc));
            },

            // ── FindOneAndUpdate ───────────────────────────────────
            findOneAndUpdate(filter = {}, update = {}, opts = {}) {
              const q = buildQuery(filter);
              const raw = col.findOne(q);
              if (!raw) {
                if (opts.upsert) {
                  const merged = {
                    _id: uuidv4(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...filter,
                    ...update,
                  };
                  col.insert(merged);
                  db.saveDatabase(() => {});
                  return Promise.resolve(stripLoki(merged));
                }
                return Promise.resolve(null);
              }
              const fields = update.$set || update;
              Object.assign(raw, fields, { updatedAt: new Date().toISOString() });
              col.update(raw);
              db.saveDatabase(() => {});
              return Promise.resolve(stripLoki(raw));
            },

            // ── FindByIdAndUpdate ──────────────────────────────────
            findByIdAndUpdate(id, update = {}, opts = {}) {
              return this.findOneAndUpdate({ _id: id }, update, opts);
            },

            // ── UpdateMany ─────────────────────────────────────────
            updateMany(filter = {}, update = {}) {
              const q = buildQuery(filter);
              const recs = col.find(q);
              const fields = update.$set || update;
              recs.forEach(raw => {
                Object.assign(raw, fields, { updatedAt: new Date().toISOString() });
                col.update(raw);
              });
              db.saveDatabase(() => {});
              return Promise.resolve({ modifiedCount: recs.length });
            },

            // ── FindOneAndDelete ───────────────────────────────────
            findOneAndDelete(filter = {}) {
              const q = buildQuery(filter);
              const raw = col.findOne(q);
              if (!raw) return Promise.resolve(null);
              const snapshot = stripLoki(raw);
              col.remove(raw);
              db.saveDatabase(() => {});
              return Promise.resolve(snapshot);
            },

            // ── DeleteMany ─────────────────────────────────────────
            deleteMany(filter = {}) {
              const q = buildQuery(filter);
              const recs = col.find(q);
              recs.forEach(r => col.remove(r));
              db.saveDatabase(() => {});
              return Promise.resolve({ deletedCount: recs.length });
            },

            // ── Save (persist) ─────────────────────────────────────
            save() {
              return new Promise((res, rej) => {
                db.saveDatabase(err => err ? rej(err) : res());
              });
            },
          });

          resolve({
            schools:  wrap(schools),
            students: wrap(students),
            logs:     wrap(logs),
            admins:   wrap(admins),
            _loki: db,
            save() {
              return new Promise((res, rej) => {
                db.saveDatabase(err => err ? rej(err) : res());
              });
            },
          });
        } catch (err) {
          reject(err);
        }
      },
      autosave: true,
      autosaveInterval: 10000,
    });
  });
}

let _dbPromise = null;

async function getDB() {
  if (!_dbPromise) _dbPromise = initDB();
  return _dbPromise;
}

module.exports = { getDB, DB_FILE, DATA_DIR };
