'use strict';

try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const { getDB } = require('./db');
const { uploadPhoto, isCloudinaryConfigured, logCloudinaryConfig } = require('./utils/cloudinary');

const app  = express();
const PORT = process.env.PORT || 4000;
const IDENTITY_CLOUD_PUBLIC_URL  = (process.env.IDENTITY_CLOUD_PUBLIC_URL  || 'https://identitycloud.vercel.app').replace(/\/$/, '');
const IDENTITY_CLOUD_BACKEND_URL = (process.env.IDENTITY_CLOUD_BACKEND_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PHOTOS_DIR  = path.join(UPLOADS_DIR, 'photos');
try { fs.mkdirSync(PHOTOS_DIR, { recursive: true }); } catch (_) {}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/api/admin', require('./admin'));

function toUrlSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'org';
}

function sanitizeId(value) {
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
//  Universal publish endpoint
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/publish', async (req, res) => {
  try {
    const db = await getDB();

    const {
      orgName,
      orgSlug: rawOrgSlug,
      schoolName,       // backward compat
      schoolSlug: rawSchoolSlug, // backward compat
      industry = 'education',
      themeColor = '#00e5a0',
      logo = null,
      records = [],
      students = [],    // backward compat
    } = req.body || {};

    const finalOrgName = orgName || schoolName;
    const finalRawSlug = rawOrgSlug || rawSchoolSlug;
    const finalRecords = (records && records.length) ? records : students;

    if (!finalOrgName) return res.status(400).json({ error: 'orgName is required' });
    if (!Array.isArray(finalRecords) || finalRecords.length === 0) {
      return res.status(400).json({ error: 'records array is required and must not be empty' });
    }

    const orgSlug = finalRawSlug ? toUrlSlug(finalRawSlug) : toUrlSlug(finalOrgName);

    // ── Upsert organization ──────────────────────────────────────────────────
    const existingOrg = await db.organizations.findOne({ slug: orgSlug });
    if (existingOrg) {
      await db.organizations.findOneAndUpdate(
        { slug: orgSlug },
        { $set: { name: finalOrgName, themeColor, logo, industry } }
      );
    } else {
      await db.organizations.create({ name: finalOrgName, slug: orgSlug, themeColor, logo, industry });
    }

    // ── Upsert records ────────────────────────────────────────────────────────
    const published = [];
    const errors    = [];

    for (const raw of finalRecords) {
      const recordId = sanitizeId(raw.recordId || raw.studentId);
      const fullName = String(raw.fullName || '').trim();

      if (!recordId || !fullName) {
        errors.push({ recordId, reason: 'Missing recordId or fullName' });
        continue;
      }

      const entityType = raw.entityType || 'student';
      const category   = raw.category   || raw.class || null;
      const issuedAt   = raw.issuedAt   || new Date().toISOString();
      const expiresAt  = raw.expiresAt  || null;
      const status     = calcStatus(expiresAt, raw.status || 'active');
      const metadata   = raw.metadata   || {};

      let resolvedPhotoUrl  = raw.photoUrl || null;
      let resolvedPublicId  = null;

      if (raw.photoData && typeof raw.photoData === 'string') {
        if (isCloudinaryConfigured()) {
          const safeId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
          const result = await uploadPhoto(raw.photoData, {
            folder: `${process.env.CLOUDINARY_FOLDER || 'identity-cloud/records'}/${orgSlug}`,
            publicId: safeId,
          });
          if (result) {
            resolvedPhotoUrl = result.url;
            resolvedPublicId = result.publicId;
          }
        }
      }

      const recordData = {
        recordId,
        fullName,
        photoUrl:      resolvedPhotoUrl,
        photoPublicId: resolvedPublicId,
        orgSlug,
        entityType,
        category,
        status,
        issuedAt,
        expiresAt,
        metadata,
      };

      const existing = await db.records.findOne({ orgSlug, recordId });

      if (existing) {
        const setFields = {
          fullName:   recordData.fullName,
          entityType: recordData.entityType,
          category:   recordData.category,
          status:     recordData.status,
          issuedAt:   recordData.issuedAt,
          expiresAt:  recordData.expiresAt,
          metadata:   recordData.metadata,
        };
        if (resolvedPhotoUrl) {
          setFields.photoUrl      = resolvedPhotoUrl;
          setFields.photoPublicId = resolvedPublicId;
        }
        await db.records.findOneAndUpdate({ orgSlug, recordId }, { $set: setFields });
      } else {
        await db.records.create(recordData);
      }

      published.push({
        recordId,
        studentId: recordId, // backward compat
        fullName,
        verifyUrl: `${IDENTITY_CLOUD_PUBLIC_URL}/${orgSlug}/${encodeURIComponent(recordId)}`,
      });
    }

    await writeLog('PUBLISH', 'ORGANIZATION', `Published ${published.length} record(s) for "${finalOrgName}"`, {
      orgSlug, count: published.length,
    });

    return res.json({
      success: true,
      orgSlug,
      schoolSlug: orgSlug, // backward compat
      orgName: finalOrgName,
      schoolName: finalOrgName, // backward compat
      count: published.length,
      records: published,
      students: published, // backward compat
      errors,
      orgUrl: `${IDENTITY_CLOUD_PUBLIC_URL}/${orgSlug}`,
      schoolUrl: `${IDENTITY_CLOUD_PUBLIC_URL}/${orgSlug}`, // backward compat
    });

  } catch (err) {
    console.error('[publish]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/verify/:orgSlug/:recordId
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/verify/:orgSlug/:recordId', async (req, res) => {
  try {
    const db = await getDB();
    const { orgSlug, recordId } = req.params;

    const safeOrgSlug = toUrlSlug(orgSlug);
    const safeRecordId = decodeURIComponent(recordId).trim();

    const record = await db.records.findOne({ orgSlug: safeOrgSlug, recordId: safeRecordId });
    if (!record) {
      return res.status(404).json({
        error: 'Identity not found',
        message: 'This identity is invalid or has not been published.',
      });
    }

    const liveStatus = calcStatus(record.expiresAt, record.status);
    const now = new Date().toISOString();

    const updated = await db.records.findOneAndUpdate(
      { orgSlug: safeOrgSlug, recordId: safeRecordId },
      {
        $set: {
          scanCount:     (record.scanCount || 0) + 1,
          lastScannedAt: now,
          status:        liveStatus,
        }
      }
    );

    const org = await db.organizations.findOne({ slug: safeOrgSlug });

    await writeLog('SCAN', 'RECORD', `QR verified: ${safeRecordId} @ ${safeOrgSlug}`, {
      orgSlug: safeOrgSlug, recordId: safeRecordId,
    });

    let remainingDays = null;
    if (record.expiresAt) {
      const diff = new Date(record.expiresAt) - new Date();
      remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return res.json({
      record: {
        ...updated,
        status: liveStatus,
        remainingDays,
      },
      student: { // backward compat
        ...updated,
        status: liveStatus,
        remainingDays,
      },
      organization: org || { name: safeOrgSlug, slug: safeOrgSlug, themeColor: '#00e5a0', industry: 'education' },
      school: org || { name: safeOrgSlug, slug: safeOrgSlug, themeColor: '#00e5a0' }, // backward compat
    });

  } catch (err) {
    console.error('[verify]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/org/:slug
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/org/:slug', async (req, res) => {
  try {
    const db = await getDB();
    const slug = toUrlSlug(req.params.slug);

    const org = await db.organizations.findOne({ slug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const recordCount = await db.records.countDocuments({ orgSlug: slug });
    return res.json({ ...org, recordCount, studentCount: recordCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compat alias
app.get('/api/school/:slug', (req, res) => {
  res.redirect(301, `/api/org/${req.params.slug}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/org/:slug/records
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/org/:slug/records', async (req, res) => {
  try {
    const db = await getDB();
    const slug = toUrlSlug(req.params.slug);
    const records = await db.records.find({ orgSlug: slug });
    return res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compat alias
app.get('/api/school/:slug/students', (req, res) => {
  res.redirect(301, `/api/org/${req.params.slug}/records`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/stats
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/stats', async (req, res) => {
  try {
    const db = await getDB();
    const totalRecords  = await db.records.countDocuments();
    const totalOrgs     = await db.organizations.countDocuments();
    const activeRecords = await db.records.countDocuments({ status: 'active' });
    return res.json({
      totalRecords, totalStudents: totalRecords,
      totalOrgs, totalSchools: totalOrgs,
      activeRecords, activeStudents: activeRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[server] Identity Cloud running on port ${PORT}`);
  logCloudinaryConfig();
});

module.exports = app;
