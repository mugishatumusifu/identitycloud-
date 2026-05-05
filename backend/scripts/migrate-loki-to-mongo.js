'use strict';

/**
 * Identity Cloud — One-shot migration: LokiJS → MongoDB Atlas + Cloudinary.
 *
 * Behaviour:
 *   • Reads every record from the legacy LokiJS database (data/identity-cloud.db).
 *   • For each student, if a local photo file exists under uploads/photos/, OR
 *     the existing photoUrl points to a remote URL, it's uploaded to Cloudinary.
 *   • Inserts/updates documents in MongoDB using upsert (idempotent — safe to
 *     re-run; existing photos already on Cloudinary are not re-uploaded).
 *
 * Run with:
 *   MONGO_URI=...  CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... \
 *     CLOUDINARY_API_SECRET=...  node scripts/migrate-loki-to-mongo.js
 */

try { require('dotenv').config(); } catch (_) {}

const path = require('path');
const fs   = require('fs');

const { connectMongo, mongoose } = require('../db/mongo');
const School  = require('../models/School');
const Student = require('../models/Student');
const Log     = require('../models/Log');
const Admin   = require('../models/Admin');
const { uploadPhoto, isCloudinaryConfigured, logCloudinaryConfig } = require('../utils/cloudinary');

const PHOTOS_DIR = path.join(__dirname, '..', 'uploads', 'photos');

function findLocalPhoto(schoolSlug, studentId) {
  const safeId = String(studentId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = `${schoolSlug}_${safeId}.`;
  if (!fs.existsSync(PHOTOS_DIR)) return null;
  for (const f of fs.readdirSync(PHOTOS_DIR)) {
    if (f.startsWith(prefix)) return path.join(PHOTOS_DIR, f);
  }
  return null;
}

async function migratePhotoIfNeeded(student) {
  if (!isCloudinaryConfigured()) return null;

  // Already on Cloudinary?
  if (student.photoUrl && /res\.cloudinary\.com/.test(student.photoUrl) && student.photoPublicId) {
    return null;
  }

  const folder = `${process.env.CLOUDINARY_FOLDER || 'identity-cloud/students'}/${student.schoolSlug}`;
  const safeId = String(student.studentId).replace(/[^a-zA-Z0-9_-]/g, '_');

  const localPath = findLocalPhoto(student.schoolSlug, student.studentId);
  if (localPath) {
    const r = await uploadPhoto(localPath, { folder, publicId: safeId });
    if (r) return r;
  }

  if (student.photoUrl && /^https?:\/\//i.test(student.photoUrl)) {
    const r = await uploadPhoto(student.photoUrl, { folder, publicId: safeId });
    if (r) return r;
  }
  return null;
}

(async () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Identity Cloud — Loki → MongoDB migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  logCloudinaryConfig();
  await connectMongo();

  const legacy = require('../db/lokijs');
  const lokiDb = await legacy.getDB();

  const schools  = await lokiDb.schools.find({});
  const students = await lokiDb.students.find({});
  const logs     = await lokiDb.logs.find({});
  const admins   = await lokiDb.admins.find({});

  console.log(`Loki snapshot: ${schools.length} schools, ${students.length} students, ${logs.length} logs, ${admins.length} admins.`);

  // ── Schools ──
  for (const s of schools) {
    await School.updateOne(
      { slug: s.slug },
      { $set: { name: s.name, slug: s.slug, themeColor: s.themeColor || '#00e5a0', logo: s.logo || null } },
      { upsert: true }
    );
  }
  console.log(`✓ Imported ${schools.length} schools.`);

  // ── Students (with Cloudinary photo migration) ──
  let photosMigrated = 0;
  for (const st of students) {
    let photoUrl      = st.photoUrl || null;
    let photoPublicId = st.photoPublicId || null;

    try {
      const r = await migratePhotoIfNeeded(st);
      if (r) {
        photoUrl = r.url;
        photoPublicId = r.publicId;
        photosMigrated++;
      }
    } catch (e) {
      console.warn(`  ! photo migration failed for ${st.schoolSlug}/${st.studentId}:`, e.message);
    }

    await Student.updateOne(
      { schoolSlug: st.schoolSlug, studentId: st.studentId },
      {
        $set: {
          studentId:     st.studentId,
          fullName:      st.fullName,
          photoUrl,
          photoPublicId,
          schoolSlug:    st.schoolSlug,
          class:         st.class || null,
          status:        st.status || 'active',
          issuedAt:      st.issuedAt || null,
          expiresAt:     st.expiresAt || null,
          scanCount:     st.scanCount || 0,
          lastScannedAt: st.lastScannedAt || null,
        }
      },
      { upsert: true }
    );
  }
  console.log(`✓ Imported ${students.length} students (uploaded ${photosMigrated} photos to Cloudinary).`);

  // ── Logs (append, keep history) ──
  if (logs.length) {
    // Avoid duplicate inserts on re-runs by using a deterministic-ish dedupe key.
    const ops = logs.map((l) => ({
      updateOne: {
        filter: { action: l.action, entity: l.entity, message: l.message, timestamp: l.timestamp },
        update: { $setOnInsert: { ...l } },
        upsert: true,
      }
    }));
    await Log.bulkWrite(ops, { ordered: false });
    console.log(`✓ Imported ${logs.length} log entries.`);
  }

  // ── Admins ──
  for (const a of admins) {
    await Admin.updateOne(
      { username: a.username },
      { $set: { username: a.username, passwordHash: a.passwordHash } },
      { upsert: true }
    );
  }
  console.log(`✓ Imported ${admins.length} admins.`);

  console.log('\n✓ Migration complete.\n');
  await mongoose.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('\n✖ Migration failed:', err);
  process.exit(1);
});
