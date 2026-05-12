'use strict';

/**
 * Identity Cloud – Admin API
 * --------------------------
 * Mounted at /api/admin in app.js.
 * Token format: base64url(payloadJSON) + "." + hex(HMAC-SHA256(payload, secret))
 */

const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const { getDB, DATA_DIR } = require('./db');
const { deletePhoto: deleteCloudinaryPhoto } = require('./utils/cloudinary');

const router = express.Router();

// ── Secret resolution ────────────────────────────────────────────────────────
const SECRET_FILE = path.join(DATA_DIR, '.admin-secret');
function getSecret() {
  if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length >= 16) {
    return process.env.ADMIN_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } catch (_) {}
  const fresh = crypto.randomBytes(32).toString('hex');
  try { fs.writeFileSync(SECRET_FILE, fresh, { mode: 0o600 }); } catch (_) {}
  return fresh;
}

// ── Token helpers ────────────────────────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}
function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig  = crypto.createHmac('sha256', getSecret()).update(body).digest('hex');
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('hex');
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (_) { return null; }
}

// ── Middleware ───────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session.' });
  req.admin = payload;
  next();
}

// ── Logging helper (mirrors app.js writeLog) ─────────────────────────────────
async function writeLog(action, entity, message, metadata = {}) {
  try {
    const db = await getDB();
    await db.logs.create({ action, entity, message, metadata, timestamp: new Date().toISOString() });
  } catch (_) {}
}

// ── Photo cleanup helper ─────────────────────────────────────────────────────
const PHOTOS_DIR = path.join(__dirname, 'uploads', 'photos');
function deletePhotoFor(schoolSlug, studentId) {
  try {
    const safeId = String(studentId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = `${schoolSlug}_${safeId}.`;
    if (!fs.existsSync(PHOTOS_DIR)) return;
    for (const f of fs.readdirSync(PHOTOS_DIR)) {
      if (f.startsWith(prefix)) {
        try { fs.unlinkSync(path.join(PHOTOS_DIR, f)); } catch (_) {}
      }
    }
  } catch (_) {}
}

// Delete the Cloudinary asset for a student (best-effort).
async function deleteCloudinaryFor(student) {
  if (!student) return;
  if (student.photoPublicId) {
    try { await deleteCloudinaryPhoto(student.photoPublicId); } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/admin/login
// ═══════════════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const db = await getDB();
    const admin = await db.admins.findOne({ username: String(username).trim() });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), admin.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const exp = Date.now() + 12 * 60 * 60 * 1000; // 12h
    const token = sign({ username: admin.username, exp });

    await writeLog('LOGIN', 'ADMIN', `Admin "${admin.username}" signed in`, { username: admin.username });
    return res.json({ token, username: admin.username, expiresAt: exp });
  } catch (err) {
    console.error('[admin/login]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  Verify session
// ═══════════════════════════════════════════════════════════════════════════
router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, expiresAt: req.admin.exp });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/admin/overview
// ═══════════════════════════════════════════════════════════════════════════
router.get('/overview', requireAdmin, async (_req, res) => {
  try {
    const db = await getDB();
    const [schools, students, logs] = await Promise.all([
      db.schools.find({}),
      db.students.find({}),
      db.logs.find({}),
    ]);

    const counts = { active: 0, expired: 0, revoked: 0 };
    let totalScans = 0;
    const dayAgo = Date.now() - 86400000;
    let scans24h = 0;

    for (const s of students) {
      counts[s.status] = (counts[s.status] || 0) + 1;
      totalScans += s.scanCount || 0;
      if (s.lastScannedAt && new Date(s.lastScannedAt).getTime() > dayAgo) scans24h++;
    }

    const recent = logs
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, 12);

    res.json({
      totals: {
        schools: schools.length,
        students: students.length,
        active: counts.active || 0,
        expired: counts.expired || 0,
        revoked: counts.revoked || 0,
        totalScans,
        scans24h,
      },
      recentActivity: recent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/admin/schools
// ═══════════════════════════════════════════════════════════════════════════
router.get('/schools', requireAdmin, async (_req, res) => {
  try {
    const db = await getDB();
    const schools = await db.schools.find({});
    const allStudents = await db.students.find({});
    const grouped = {};
    for (const s of allStudents) {
      grouped[s.schoolSlug] = grouped[s.schoolSlug] || { total: 0, active: 0 };
      grouped[s.schoolSlug].total++;
      if (s.status === 'active') grouped[s.schoolSlug].active++;
    }
    const out = schools.map(sc => ({
      ...sc,
      studentCount: grouped[sc.slug]?.total || 0,
      activeCount:  grouped[sc.slug]?.active || 0,
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/admin/schools/:slug
// ═══════════════════════════════════════════════════════════════════════════
router.get('/schools/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug   = req.params.slug;
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const school = await db.schools.findOne({ slug });
    if (!school) return res.status(404).json({ error: 'School not found' });

    const filter = { schoolSlug: slug };
    if (status) filter.status = status;
    if (search) filter.$or = [
      { fullName:  { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } },
      { class:     { $regex: search, $options: 'i' } },
    ];

    const { docs: students, total } = await db.students.findPaginated(
      filter, { skip: (page - 1) * limit, limit, sort: { fullName: 1 } }
    );

    res.json({
      school,
      students,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /api/admin/schools/:slug
// ═══════════════════════════════════════════════════════════════════════════
router.patch('/schools/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug = req.params.slug;
    const { name, themeColor, logo } = req.body || {};
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof themeColor === 'string') update.themeColor = themeColor;
    if (typeof logo === 'string' || logo === null) update.logo = logo;

    const school = await db.schools.findOneAndUpdate({ slug }, { $set: update });
    if (!school) return res.status(404).json({ error: 'School not found' });
    await writeLog('UPDATE', 'SCHOOL', `Updated school "${slug}"`, { slug, fields: Object.keys(update) });
    res.json(school);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /api/admin/schools/:slug  (cascade)
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/schools/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug = req.params.slug;
    const school = await db.schools.findOne({ slug });
    if (!school) return res.status(404).json({ error: 'School not found' });

    const students = await db.students.find({ schoolSlug: slug });
    for (const s of students) {
      deletePhotoFor(slug, s.studentId);   // legacy disk cleanup (no-op if missing)
      await deleteCloudinaryFor(s);        // Cloudinary cleanup
    }

    const { deletedCount } = await db.students.deleteMany({ schoolSlug: slug });
    await db.schools.findOneAndDelete({ slug });
    await db.save();
    await writeLog('DELETE', 'SCHOOL', `Deleted school "${slug}" and ${deletedCount} students`, { slug });
    res.json({ success: true, deletedStudents: deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /api/admin/schools/:slug/students/:studentId
// ═══════════════════════════════════════════════════════════════════════════
router.patch('/schools/:slug/students/:studentId', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const { slug, studentId } = req.params;
    const safeStudentId = decodeURIComponent(studentId);
    const allowed = ['fullName', 'class', 'status', 'expiresAt', 'photoUrl'];
    const update = {};
    for (const k of allowed) if (k in (req.body || {})) update[k] = req.body[k];

    const student = await db.students.findOneAndUpdate(
      { schoolSlug: slug, studentId: safeStudentId },
      { $set: update }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    await writeLog('UPDATE', 'STUDENT', `Updated student ${safeStudentId} @ ${slug}`,
      { slug, studentId: safeStudentId, fields: Object.keys(update) });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/admin/schools/:slug/students/:studentId/revoke|restore
// ═══════════════════════════════════════════════════════════════════════════
router.post('/schools/:slug/students/:studentId/:action(revoke|restore)', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const { slug, studentId, action } = req.params;
    const safeStudentId = decodeURIComponent(studentId);
    const newStatus = action === 'revoke' ? 'revoked' : 'active';
    const student = await db.students.findOneAndUpdate(
      { schoolSlug: slug, studentId: safeStudentId },
      { $set: { status: newStatus } }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    await writeLog(action.toUpperCase(), 'STUDENT', `${action} ${safeStudentId} @ ${slug}`, { slug, studentId: safeStudentId });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /api/admin/schools/:slug/students/:studentId
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/schools/:slug/students/:studentId', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const { slug, studentId } = req.params;
    const safeStudentId = decodeURIComponent(studentId);
    const removed = await db.students.findOneAndDelete({ schoolSlug: slug, studentId: safeStudentId });
    if (!removed) return res.status(404).json({ error: 'Student not found' });
    deletePhotoFor(slug, safeStudentId);
    await deleteCloudinaryFor(removed);
    await db.save();
    await writeLog('DELETE', 'STUDENT', `Deleted student ${safeStudentId} @ ${slug}`, { slug, studentId: safeStudentId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/admin/logs?limit=
// ═══════════════════════════════════════════════════════════════════════════
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const logs = await db.logs.find({});
    res.json(logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, limit));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
