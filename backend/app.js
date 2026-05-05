'use strict';

try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const { getDB } = require('./db');
const { uploadPhoto, isCloudinaryConfigured, logCloudinaryConfig } = require('./utils/cloudinary');

// ── Optional dual-write to legacy LokiJS during the migration window ─────────
// Enable with DUAL_WRITE_LOKI=1 (default OFF in the new MongoDB-only world).
const DUAL_WRITE_LOKI = String(process.env.DUAL_WRITE_LOKI || '').trim() === '1';
let lokiDbPromise = null;
function getLokiDB() {
  if (!DUAL_WRITE_LOKI) return null;
  if (!lokiDbPromise) {
    try {
      const legacy = require('./db/lokijs');
      lokiDbPromise = legacy.getDB();
    } catch (err) {
      console.warn('[dual-write] Loki adapter unavailable:', err.message);
      lokiDbPromise = Promise.resolve(null);
    }
  }
  return lokiDbPromise;
}

const app  = express();
const PORT = process.env.PORT || 4000;
const IDENTITY_CLOUD_PUBLIC_URL  = (process.env.IDENTITY_CLOUD_PUBLIC_URL  || 'https://identitycloud.vercel.app').replace(/\/$/, '');
const IDENTITY_CLOUD_BACKEND_URL = (process.env.IDENTITY_CLOUD_BACKEND_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// ── Legacy uploads dir kept ONLY to serve any pre-existing photos that have ──
// not yet been migrated to Cloudinary. New photos are NOT written here.
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PHOTOS_DIR  = path.join(UPLOADS_DIR, 'photos');
try { fs.mkdirSync(PHOTOS_DIR, { recursive: true }); } catch (_) {}

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve any leftover legacy photos (read-only fallback).
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Admin API ────────────────────────────────────────────────────────────────
app.use('/api/admin', require('./admin'));

// ── Helpers ────────────────────────────────────────────────────────────────────
function toUrlSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'school';
}

function sanitizeStudentId(value) {
  return String(value || '').trim();
}

function calcStatus(expiresAt, currentStatus) {
  if (currentStatus === 'revoked') return 'revoked';
  if (expiresAt && new Date(expiresAt) < new Date()) return 'expired';
  return 'active';
}

async function writeLog(action, entity, message, metadata = {}) {
  try {
    const db = await getDB();
    await db.logs.create({ action, entity, message, metadata, timestamp: new Date().toISOString() });
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/publish
//  Receives student cards from Card Studio. Photos are uploaded to Cloudinary;
//  only the resulting secure_url is persisted in MongoDB.
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/publish', async (req, res) => {
  try {
    const db = await getDB();
    const lokiDb = DUAL_WRITE_LOKI ? await getLokiDB() : null;

    const {
      schoolName,
      schoolSlug: rawSlug,
      themeColor = '#00e5a0',
      logo = null,
      students = [],
    } = req.body || {};

    if (!schoolName) return res.status(400).json({ error: 'schoolName is required' });
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'students array is required and must not be empty' });
    }

    const schoolSlug = rawSlug ? toUrlSlug(rawSlug) : toUrlSlug(schoolName);

    // ── Upsert school ──────────────────────────────────────────────────────────
    const existingSchool = await db.schools.findOne({ slug: schoolSlug });
    let school;
    if (existingSchool) {
      school = await db.schools.findOneAndUpdate(
        { slug: schoolSlug },
        { $set: { name: schoolName, themeColor, logo } }
      );
    } else {
      school = await db.schools.create({ name: schoolName, slug: schoolSlug, themeColor, logo });
    }

    if (lokiDb) {
      try {
        const existingL = await lokiDb.schools.findOne({ slug: schoolSlug });
        if (existingL) {
          await lokiDb.schools.findOneAndUpdate({ slug: schoolSlug }, { $set: { name: schoolName, themeColor, logo } });
        } else {
          await lokiDb.schools.create({ name: schoolName, slug: schoolSlug, themeColor, logo });
        }
      } catch (e) { console.warn('[dual-write] school upsert failed:', e.message); }
    }

    // ── Upsert students ────────────────────────────────────────────────────────
    const published = [];
    const errors    = [];

    for (const raw of students) {
      const studentId = sanitizeStudentId(raw.studentId);
      const fullName  = String(raw.fullName || '').trim();

      if (!studentId || !fullName) {
        errors.push({ studentId, reason: 'Missing studentId or fullName' });
        continue;
      }

      const issuedAt  = raw.issuedAt  || new Date().toISOString();
      const expiresAt = raw.expiresAt || null;
      const status    = calcStatus(expiresAt, raw.status || 'active');

      // ── Image handling: upload to Cloudinary, keep only the URL ──
      let resolvedPhotoUrl  = raw.photoUrl || null;
      let resolvedPublicId  = null;

      if (raw.photoData && typeof raw.photoData === 'string') {
        if (isCloudinaryConfigured()) {
          const safeId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
          const result = await uploadPhoto(raw.photoData, {
            folder: `${process.env.CLOUDINARY_FOLDER || 'identity-cloud/students'}/${schoolSlug}`,
            publicId: safeId,
          });
          if (result) {
            resolvedPhotoUrl = result.url;
            resolvedPublicId = result.publicId;
          } else {
            console.warn('[publish] Cloudinary upload failed for', studentId);
          }
        } else {
          console.warn('[publish] Cloudinary not configured — photo for', studentId, 'will not be stored.');
        }
      }

      const studentData = {
        studentId,
        fullName,
        photoUrl:      resolvedPhotoUrl,
        photoPublicId: resolvedPublicId,
        schoolSlug,
        class:         raw.class     || null,
        status,
        issuedAt,
        expiresAt,
        scanCount:     0,
        lastScannedAt: null,
      };

      const existing = await db.students.findOne({ schoolSlug, studentId });

      let student;
      if (existing) {
        const setFields = {
          fullName:  studentData.fullName,
          class:     studentData.class,
          status:    studentData.status,
          issuedAt:  studentData.issuedAt,
          expiresAt: studentData.expiresAt,
        };
        // Don't wipe an existing photo if no new one was uploaded.
        if (resolvedPhotoUrl) {
          setFields.photoUrl      = resolvedPhotoUrl;
          setFields.photoPublicId = resolvedPublicId;
        }
        student = await db.students.findOneAndUpdate(
          { schoolSlug, studentId },
          { $set: setFields }
        );
      } else {
        student = await db.students.create(studentData);
      }

      // Mirror to Loki if enabled (best-effort).
      if (lokiDb) {
        try {
          const existingL = await lokiDb.students.findOne({ schoolSlug, studentId });
          if (existingL) {
            await lokiDb.students.findOneAndUpdate(
              { schoolSlug, studentId },
              { $set: {
                  fullName:  studentData.fullName,
                  photoUrl:  studentData.photoUrl,
                  class:     studentData.class,
                  status:    studentData.status,
                  issuedAt:  studentData.issuedAt,
                  expiresAt: studentData.expiresAt,
                } }
            );
          } else {
            await lokiDb.students.create(studentData);
          }
        } catch (e) { console.warn('[dual-write] student upsert failed:', e.message); }
      }

      published.push({
        studentId,
        fullName,
        verifyUrl: `${IDENTITY_CLOUD_PUBLIC_URL}/${schoolSlug}/${encodeURIComponent(studentId)}`,
      });
    }

    await writeLog('PUBLISH', 'SCHOOL', `Published ${published.length} student(s) for "${schoolName}"`, {
      schoolSlug, count: published.length,
    });

    return res.json({
      success: true,
      schoolSlug,
      schoolName,
      count: published.length,
      students: published,
      errors,
      schoolUrl: `${IDENTITY_CLOUD_PUBLIC_URL}/${schoolSlug}`,
    });

  } catch (err) {
    console.error('[publish]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/verify/:schoolSlug/:studentId
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/verify/:schoolSlug/:studentId', async (req, res) => {
  try {
    const db = await getDB();
    const { schoolSlug, studentId } = req.params;

    const safeSchoolSlug = toUrlSlug(schoolSlug);
    const safeStudentId  = decodeURIComponent(studentId).trim();

    const student = await db.students.findOne({ schoolSlug: safeSchoolSlug, studentId: safeStudentId });
    if (!student) {
      return res.status(404).json({
        error: 'Student not found',
        message: 'This identity is invalid or has not been published.',
      });
    }

    const liveStatus = calcStatus(student.expiresAt, student.status);
    const now = new Date().toISOString();

    const updated = await db.students.findOneAndUpdate(
      { schoolSlug: safeSchoolSlug, studentId: safeStudentId },
      {
        $set: {
          scanCount:     (student.scanCount || 0) + 1,
          lastScannedAt: now,
          status:        liveStatus,
        }
      }
    );

    const school = await db.schools.findOne({ slug: safeSchoolSlug });

    await writeLog('SCAN', 'STUDENT', `QR verified: ${safeStudentId} @ ${safeSchoolSlug}`, {
      schoolSlug: safeSchoolSlug, studentId: safeStudentId,
    });

    let remainingDays = null;
    if (student.expiresAt) {
      const diff = new Date(student.expiresAt) - new Date();
      remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return res.json({
      student: {
        ...updated,
        status: liveStatus,
        remainingDays,
      },
      school: school || { name: safeSchoolSlug, slug: safeSchoolSlug, themeColor: '#00e5a0' },
    });

  } catch (err) {
    console.error('[verify]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/school/:slug
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/school/:slug', async (req, res) => {
  try {
    const db = await getDB();
    const slug = toUrlSlug(req.params.slug);

    const school = await db.schools.findOne({ slug });
    if (!school) return res.status(404).json({ error: 'School not found' });

    const studentCount = await db.students.countDocuments({ schoolSlug: slug });
    return res.json({ ...school, studentCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/school/:slug/students
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/school/:slug/students', async (req, res) => {
  try {
    const db = await getDB();
    const slug = toUrlSlug(req.params.slug);
    const students = await db.students.find({ schoolSlug: slug });
    return res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/stats
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/stats', async (req, res) => {
  try {
    const db = await getDB();
    const totalStudents  = await db.students.countDocuments();
    const totalSchools   = await db.schools.countDocuments();
    const activeStudents = await db.students.countDocuments({ status: 'active' });
    return res.json({ totalStudents, totalSchools, activeStudents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Health check
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Start ──────────────────────────────────────────────────────────────────────
getDB().then(() => {
  logCloudinaryConfig();
  if (DUAL_WRITE_LOKI) console.log('[startup] Dual-write to LokiJS is ENABLED (DUAL_WRITE_LOKI=1).');
  app.listen(PORT, () => {
    console.log(`\n🌐  Identity Cloud Backend running on http://localhost:${PORT}`);
    console.log(`    POST /api/publish           – receive cards from Card Studio`);
    console.log(`    GET  /api/verify/:slug/:id  – verify student on QR scan`);
    console.log(`    GET  /api/school/:slug       – school metadata\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
