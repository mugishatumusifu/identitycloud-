try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { getDB } = require('./db');
const { isGitHubConfigured, savePhotoToGitHub } = require('./githubStorage');

const app  = express();
const PORT = process.env.PORT || 4000;
const IDENTITY_CLOUD_PUBLIC_URL = (process.env.IDENTITY_CLOUD_PUBLIC_URL || 'https://identitycloud.vercel.app').replace(/\/$/, '');
// Backend's own public URL (used to build photo URLs served by this backend)
const IDENTITY_CLOUD_BACKEND_URL = (process.env.IDENTITY_CLOUD_BACKEND_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// ── Uploads directory (for student photos received during publish) ──────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PHOTOS_DIR  = path.join(UPLOADS_DIR, 'photos');
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ── Serve uploaded photos statically ──────────────────────────────────────────
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Admin API (authenticated dashboard) ───────────────────────────────────────
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

// ── Log helper ─────────────────────────────────────────────────────────────────
async function writeLog(action, entity, message, metadata = {}) {
  try {
    const db = await getDB();
    await db.logs.create({ action, entity, message, metadata, timestamp: new Date().toISOString() });
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/publish
//  Receives student cards from Card Studio and upserts them into LokiJS.
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/publish', async (req, res) => {
  try {
    const db = await getDB();

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

      // ── Handle photo: save to GitHub repo (primary) and local disk (fallback) ──
      let resolvedPhotoUrl = raw.photoUrl || null;
      if (raw.photoData && typeof raw.photoData === 'string') {
        try {
          const base64Data   = raw.photoData.replace(/^data:image\/\w+;base64,/, '');
          const extMatch     = raw.photoData.match(/^data:image\/(\w+);base64,/);
          const ext          = extMatch ? extMatch[1] : 'jpg';
          const photoFilename = `${schoolSlug}_${studentId.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;

          // ── Primary: commit photo to GitHub so it survives Render restarts ──
          if (isGitHubConfigured()) {
            try {
              const githubUrl = await savePhotoToGitHub(photoFilename, base64Data);
              if (githubUrl) {
                resolvedPhotoUrl = githubUrl;
                console.log('[publish] Photo saved to GitHub:', photoFilename);
              }
            } catch (ghErr) {
              console.warn('[publish] GitHub photo upload failed, falling back to local disk:', ghErr.message);
            }
          }

          // ── Fallback: save to local disk (ephemeral on Render free tier) ──
          if (!resolvedPhotoUrl || !isGitHubConfigured()) {
            const photoPath = path.join(PHOTOS_DIR, photoFilename);
            fs.writeFileSync(photoPath, Buffer.from(base64Data, 'base64'));
            resolvedPhotoUrl = `${IDENTITY_CLOUD_BACKEND_URL}/uploads/photos/${photoFilename}`;
            console.log('[publish] Photo saved to local disk (ephemeral):', photoFilename);
          }
        } catch (photoErr) {
          console.warn('[publish] Failed to save photo for', studentId, photoErr.message);
        }
      }

      const studentData = {
        studentId,
        fullName,
        photoUrl:      resolvedPhotoUrl,
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
        // Preserve scan data on re-publish
        student = await db.students.findOneAndUpdate(
          { schoolSlug, studentId },
          {
            $set: {
              fullName:   studentData.fullName,
              photoUrl:   studentData.photoUrl,
              class:      studentData.class,
              status:     studentData.status,
              issuedAt:   studentData.issuedAt,
              expiresAt:  studentData.expiresAt,
            }
          }
        );
      } else {
        student = await db.students.create(studentData);
      }

      published.push({
        studentId,
        fullName,
        verifyUrl: `${IDENTITY_CLOUD_PUBLIC_URL}/${schoolSlug}/${encodeURIComponent(studentId)}`,
      });
    }

    await db.save();

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
//  Called by Identity Cloud frontend on QR scan.
//  Increments scanCount and returns full student profile.
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/verify/:schoolSlug/:studentId', async (req, res) => {
  try {
    const db = await getDB();
    const { schoolSlug, studentId } = req.params;

    const safeSchoolSlug = toUrlSlug(schoolSlug);
    const safeStudentId  = decodeURIComponent(studentId).trim();

    // Find student
    const student = await db.students.findOne({ schoolSlug: safeSchoolSlug, studentId: safeStudentId });
    if (!student) {
      return res.status(404).json({
        error: 'Student not found',
        message: 'This identity is invalid or has not been published.',
      });
    }

    // Auto-update status if expired
    const liveStatus = calcStatus(student.expiresAt, student.status);

    // Increment scan count
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

    // Fetch school
    const school = await db.schools.findOne({ slug: safeSchoolSlug });

    await writeLog('SCAN', 'STUDENT', `QR verified: ${safeStudentId} @ ${safeSchoolSlug}`, {
      schoolSlug: safeSchoolSlug, studentId: safeStudentId,
    });

    // Calculate remaining days
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
//  Returns school metadata and student count.
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
//  Returns all students for a school (basic info).
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
//  Returns aggregate stats for monitoring.
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/stats', async (req, res) => {
  try {
    const db = await getDB();
    const totalStudents = await db.students.countDocuments();
    const totalSchools  = await db.schools.countDocuments();
    const activeStudents = (await db.students.find({ status: 'active' })).length;
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
