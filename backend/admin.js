'use strict';

const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const { getDB, DATA_DIR } = require('./db');
const { deletePhoto: deleteCloudinaryPhoto } = require('./utils/cloudinary');

const router = express.Router();

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

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session.' });
  req.admin = payload;
  next();
}

async function writeLog(action, entity, message, metadata = {}) {
  try {
    const db = await getDB();
    await db.logs.create({ action, entity, message, metadata, timestamp: new Date().toISOString() });
  } catch (_) {}
}

async function deleteCloudinaryFor(record) {
  if (!record) return;
  if (record.photoPublicId) {
    try { await deleteCloudinaryPhoto(record.photoPublicId); } catch (_) {}
  }
}

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

router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, expiresAt: req.admin.exp });
});

router.get('/overview', requireAdmin, async (_req, res) => {
  try {
    const db = await getDB();
    const [orgs, records, logs] = await Promise.all([
      db.organizations.find({}),
      db.records.find({}),
      db.logs.find({}),
    ]);

    const counts = { active: 0, expired: 0, revoked: 0 };
    let totalScans = 0;
    const dayAgo = Date.now() - 86400000;
    let scans24h = 0;

    for (const r of records) {
      counts[r.status] = (counts[r.status] || 0) + 1;
      totalScans += r.scanCount || 0;
      if (r.lastScannedAt && new Date(r.lastScannedAt).getTime() > dayAgo) scans24h++;
    }

    const recent = logs
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, 12);

    res.json({
      totals: {
        orgs: orgs.length,
        schools: orgs.length, // backward compat
        records: records.length,
        students: records.length, // backward compat
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

router.get('/orgs', requireAdmin, async (_req, res) => {
  try {
    const db = await getDB();
    const orgs = await db.organizations.find({});
    const allRecords = await db.records.find({});
    const grouped = {};
    for (const r of allRecords) {
      grouped[r.orgSlug] = grouped[r.orgSlug] || { total: 0, active: 0 };
      grouped[r.orgSlug].total++;
      if (r.status === 'active') grouped[r.orgSlug].active++;
    }
    const out = orgs.map(org => ({
      ...org,
      recordCount: grouped[org.slug]?.total || 0,
      activeCount: grouped[org.slug]?.active || 0,
      studentCount: grouped[org.slug]?.total || 0, // backward compat
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Alias for backward compatibility
router.get('/schools', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const orgs = await db.organizations.find({});
    const allRecords = await db.records.find({});
    const grouped = {};
    for (const r of allRecords) {
      grouped[r.orgSlug] = grouped[r.orgSlug] || { total: 0, active: 0 };
      grouped[r.orgSlug].total++;
      if (r.status === 'active') grouped[r.orgSlug].active++;
    }
    const out = orgs.map(org => ({
      ...org,
      slug: org.slug,
      name: org.name,
      themeColor: org.themeColor,
      logo: org.logo,
      studentCount: grouped[org.slug]?.total || 0,
      activeCount: grouped[org.slug]?.active || 0,
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/orgs/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug   = req.params.slug;
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const org = await db.organizations.findOne({ slug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const filter = { orgSlug: slug };
    if (status) filter.status = status;
    if (search) filter.$or = [
      { fullName:  { $regex: search, $options: 'i' } },
      { recordId:  { $regex: search, $options: 'i' } },
      { category:  { $regex: search, $options: 'i' } },
    ];

    const { docs: records, total } = await db.records.findPaginated(
      filter, { skip: (page - 1) * limit, limit, sort: { fullName: 1 } }
    );

    res.json({
      org,
      organization: org,
      school: org, // backward compat
      records,
      students: records, // backward compat
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Alias for backward compatibility
router.get('/schools/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug   = req.params.slug;
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const org = await db.organizations.findOne({ slug });
    if (!org) return res.status(404).json({ error: 'School not found' });

    const filter = { orgSlug: slug };
    if (status) filter.status = status;
    if (search) filter.$or = [
      { fullName:  { $regex: search, $options: 'i' } },
      { recordId:  { $regex: search, $options: 'i' } },
      { category:  { $regex: search, $options: 'i' } },
    ];

    const { docs: records, total } = await db.records.findPaginated(
      filter, { skip: (page - 1) * limit, limit, sort: { fullName: 1 } }
    );

    res.json({
      school: org,
      students: records,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/orgs/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug = req.params.slug;
    const { name, themeColor, logo, industry } = req.body || {};
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof themeColor === 'string') update.themeColor = themeColor;
    if (typeof logo === 'string' || logo === null) update.logo = logo;
    if (typeof industry === 'string') update.industry = industry;

    const org = await db.organizations.findOneAndUpdate({ slug }, { $set: update });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    await writeLog('UPDATE', 'ORGANIZATION', `Updated organization "${slug}"`, { slug, fields: Object.keys(update) });
    res.json(org);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Alias for backward compatibility
router.patch('/schools/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug = req.params.slug;
    const { name, themeColor, logo } = req.body || {};
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof themeColor === 'string') update.themeColor = themeColor;
    if (typeof logo === 'string' || logo === null) update.logo = logo;

    const org = await db.organizations.findOneAndUpdate({ slug }, { $set: update });
    if (!org) return res.status(404).json({ error: 'School not found' });
    await writeLog('UPDATE', 'ORGANIZATION', `Updated organization "${slug}"`, { slug, fields: Object.keys(update) });
    res.json(org);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/orgs/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug = req.params.slug;
    const org = await db.organizations.findOne({ slug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const records = await db.records.find({ orgSlug: slug });
    for (const r of records) {
      await deleteCloudinaryFor(r);
    }

    const { deletedCount } = await db.records.deleteMany({ orgSlug: slug });
    await db.organizations.findOneAndDelete({ slug });
    await writeLog('DELETE', 'ORGANIZATION', `Deleted organization "${slug}" and ${deletedCount} records`, { slug });
    res.json({ success: true, deletedRecords: deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Alias for backward compatibility
router.delete('/schools/:slug', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const slug = req.params.slug;
    const org = await db.organizations.findOne({ slug });
    if (!org) return res.status(404).json({ error: 'School not found' });

    const records = await db.records.find({ orgSlug: slug });
    for (const r of records) {
      await deleteCloudinaryFor(r);
    }

    const { deletedCount } = await db.records.deleteMany({ orgSlug: slug });
    await db.organizations.findOneAndDelete({ slug });
    await writeLog('DELETE', 'ORGANIZATION', `Deleted organization "${slug}" and ${deletedCount} records`, { slug });
    res.json({ success: true, deletedStudents: deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/orgs/:slug/records/:recordId', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const { slug, recordId } = req.params;
    const safeRecordId = decodeURIComponent(recordId);
    const allowed = ['fullName', 'category', 'entityType', 'status', 'expiresAt', 'photoUrl', 'metadata'];
    const update = {};
    for (const k of allowed) if (k in (req.body || {})) update[k] = req.body[k];

    const record = await db.records.findOneAndUpdate(
      { orgSlug: slug, recordId: safeRecordId },
      { $set: update }
    );
    if (!record) return res.status(404).json({ error: 'Record not found' });
    await writeLog('UPDATE', 'RECORD', `Updated record ${safeRecordId} @ ${slug}`,
      { slug, recordId: safeRecordId, fields: Object.keys(update) });
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Alias for backward compatibility
router.patch('/schools/:slug/students/:studentId', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const { slug, studentId } = req.params;
    const safeRecordId = decodeURIComponent(studentId);
    const allowed = ['fullName', 'class', 'status', 'expiresAt', 'photoUrl'];
    const update = {};
    for (const k of allowed) {
      if (k === 'class') {
        if (k in (req.body || {})) update.category = req.body[k];
      } else {
        if (k in (req.body || {})) update[k] = req.body[k];
      }
    }

    const record = await db.records.findOneAndUpdate(
      { orgSlug: slug, recordId: safeRecordId },
      { $set: update }
    );
    if (!record) return res.status(404).json({ error: 'Student not found' });
    await writeLog('UPDATE', 'RECORD', `Updated record ${safeRecordId} @ ${slug}`,
      { slug, recordId: safeRecordId, fields: Object.keys(update) });
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/orgs/:slug/records/:recordId', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const { slug, recordId } = req.params;
    const safeRecordId = decodeURIComponent(recordId);
    const record = await db.records.findOne({ orgSlug: slug, recordId: safeRecordId });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    await deleteCloudinaryFor(record);
    await db.records.findOneAndDelete({ orgSlug: slug, recordId: safeRecordId });
    await writeLog('DELETE', 'RECORD', `Deleted record ${safeRecordId} @ ${slug}`, { slug, recordId: safeRecordId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Alias for backward compatibility
router.delete('/schools/:slug/students/:studentId', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const { slug, studentId } = req.params;
    const safeRecordId = decodeURIComponent(studentId);
    const record = await db.records.findOne({ orgSlug: slug, recordId: safeRecordId });
    if (!record) return res.status(404).json({ error: 'Student not found' });

    await deleteCloudinaryFor(record);
    await db.records.findOneAndDelete({ orgSlug: slug, recordId: safeRecordId });
    await writeLog('DELETE', 'RECORD', `Deleted record ${safeRecordId} @ ${slug}`, { slug, recordId: safeRecordId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
