'use strict';

/**
 * Identity Cloud — Backfill industry metadata onto pre-existing documents.
 *
 * This is optional and safe to run any number of times. Every field it
 * writes already has a schema-level default (`industry: 'education'`,
 * `entityType: 'student'`, `data: {}`), so the app works correctly even
 * without running this script — Mongoose applies those defaults whenever a
 * document is loaded and the field is missing. This script simply makes the
 * defaults explicit at rest, which is convenient for:
 *   - raw aggregation pipelines that don't go through Mongoose
 *   - external tools/dashboards reading MongoDB directly
 *   - clarity when inspecting the database by hand
 *
 * Run with:
 *   MONGO_URI=... node scripts/backfill-industry-metadata.js
 */

try { require('dotenv').config(); } catch (_) {}

const { connectMongo } = require('../db/mongo');
const School  = require('../models/School');
const Student = require('../models/Student');

async function run() {
  await connectMongo();

  const schoolResult = await School.updateMany(
    { industry: { $exists: false } },
    { $set: { industry: 'education', entityLabel: 'Student', entityLabelPlural: 'Students', fieldDefinitions: [] } }
  );
  console.log(`[backfill] schools updated: ${schoolResult.modifiedCount || 0}`);

  const studentResult = await Student.updateMany(
    { entityType: { $exists: false } },
    { $set: { entityType: 'student', data: {} } }
  );
  console.log(`[backfill] students updated: ${studentResult.modifiedCount || 0}`);

  console.log('[backfill] done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[backfill] failed:', err);
  process.exit(1);
});
