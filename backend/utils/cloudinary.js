'use strict';

/**
 * Identity Cloud — Cloudinary upload helper.
 *
 * Accepts:
 *   - data URL string  ("data:image/png;base64,....")
 *   - raw base64 string
 *   - Buffer
 *   - local file path
 *
 * Returns: { url, publicId }  or null on failure.
 */

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

let _configured = false;
function configure() {
  if (_configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  _configured = true;
}

function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function logCloudinaryConfig() {
  if (isCloudinaryConfigured()) {
    console.log(`[cloudinary] ✓ Configured for cloud "${process.env.CLOUDINARY_CLOUD_NAME}"`);
  } else {
    console.warn('[cloudinary] ✖ Not configured — set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET');
  }
}

const MAX_BYTES = parseInt(process.env.CLOUDINARY_MAX_BYTES || '10485760', 10); // 10 MB default
const ALLOWED_MIME = /^image\/(png|jpe?g|gif|webp|bmp)$/i;

function detectMimeFromDataUrl(s) {
  const m = /^data:(image\/[\w.+-]+);base64,/.exec(s);
  return m ? m[1] : null;
}

function inputToBuffer(input) {
  if (Buffer.isBuffer(input)) return { buffer: input, mime: null };

  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const mime = detectMimeFromDataUrl(input);
      const b64  = input.replace(/^data:image\/[\w.+-]+;base64,/, '');
      return { buffer: Buffer.from(b64, 'base64'), mime };
    }
    if (/^https?:\/\//i.test(input)) {
      return { remote: input };
    }
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(input) && input.length > 100) {
      return { buffer: Buffer.from(input, 'base64'), mime: null };
    }
    // local file path
    return { path: input };
  }
  return null;
}

function uploadStream(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/**
 * Upload a photo to Cloudinary.
 * @param {*} input  data URL / base64 / Buffer / file path / remote URL
 * @param {object} opts { folder, publicId }
 * @returns {Promise<{url:string, publicId:string} | null>}
 */
async function uploadPhoto(input, opts = {}) {
  if (!isCloudinaryConfigured()) {
    console.warn('[cloudinary] skip upload — not configured');
    return null;
  }
  if (input == null || input === '') return null;

  configure();

  const folder = opts.folder || process.env.CLOUDINARY_FOLDER || 'identity-cloud/students';
  const publicId = opts.publicId || undefined;

  try {
    const parsed = inputToBuffer(input);
    if (!parsed) return null;

    // Validate file type if we know it
    if (parsed.mime && !ALLOWED_MIME.test(parsed.mime)) {
      console.warn('[cloudinary] rejected — unsupported image type:', parsed.mime);
      return null;
    }
    if (parsed.buffer && parsed.buffer.length > MAX_BYTES) {
      console.warn(`[cloudinary] rejected — image exceeds ${MAX_BYTES} bytes (${parsed.buffer.length})`);
      return null;
    }

    const baseOptions = {
      folder,
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
      // keep modest transformation to bound storage costs
      transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
    };

    let result;
    if (parsed.buffer) {
      result = await uploadStream(parsed.buffer, baseOptions);
    } else if (parsed.path) {
      result = await cloudinary.uploader.upload(parsed.path, baseOptions);
    } else if (parsed.remote) {
      result = await cloudinary.uploader.upload(parsed.remote, baseOptions);
    } else {
      return null;
    }

    console.log('[cloudinary] ✓ uploaded', result.public_id);
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    console.error('[cloudinary] ✖ upload failed:', err.message);
    return null;
  }
}

async function deletePhoto(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return false;
  configure();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return true;
  } catch (err) {
    console.warn('[cloudinary] delete failed for', publicId, err.message);
    return false;
  }
}

const MAX_PDF_BYTES = parseInt(process.env.CLOUDINARY_MAX_PDF_BYTES || '20971520', 10); // 20 MB default

function inputToPdfBuffer(input) {
  if (Buffer.isBuffer(input)) return { buffer: input };
  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const b64 = input.replace(/^data:application\/pdf;base64,/, '');
      return { buffer: Buffer.from(b64, 'base64') };
    }
    if (/^https?:\/\//i.test(input)) return { remote: input };
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(input) && input.length > 100) {
      return { buffer: Buffer.from(input, 'base64') };
    }
    return { path: input };
  }
  return null;
}

/**
 * Upload a student card PDF to Cloudinary as a raw resource, so it can be
 * downloaded (front/back pages) from the verification page.
 * @param {*} input  data URL / base64 / Buffer / file path / remote URL
 * @param {object} opts { folder, publicId }
 * @returns {Promise<{url:string, publicId:string} | null>}
 */
async function uploadPdf(input, opts = {}) {
  if (!isCloudinaryConfigured()) {
    console.warn('[cloudinary] skip PDF upload — not configured');
    return null;
  }
  if (input == null || input === '') return null;

  configure();

  const folder = opts.folder || process.env.CLOUDINARY_FOLDER || 'identity-cloud/students';
  const publicId = opts.publicId || undefined;

  try {
    const parsed = inputToPdfBuffer(input);
    if (!parsed) return null;

    if (parsed.buffer && parsed.buffer.length > MAX_PDF_BYTES) {
      console.warn(`[cloudinary] rejected — PDF exceeds ${MAX_PDF_BYTES} bytes (${parsed.buffer.length})`);
      return null;
    }

    const baseOptions = {
      folder,
      public_id: publicId,
      overwrite: true,
      // Uploaded as an "image" resource (Cloudinary's document delivery
      // type) rather than "raw" so per-page delivery (pg_1 / pg_2 URL
      // transformations) works — this is what lets the front and back
      // sides of a combined card PDF be downloaded as separate files.
      resource_type: 'image',
      format: 'pdf',
    };

    let result;
    if (parsed.buffer) {
      result = await uploadStream(parsed.buffer, baseOptions);
    } else if (parsed.path) {
      result = await cloudinary.uploader.upload(parsed.path, baseOptions);
    } else if (parsed.remote) {
      result = await cloudinary.uploader.upload(parsed.remote, baseOptions);
    } else {
      return null;
    }

    console.log('[cloudinary] ✓ uploaded PDF', result.public_id);
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    console.error('[cloudinary] ✖ PDF upload failed:', err.message);
    return null;
  }
}

async function deletePdf(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return false;
  configure();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return true;
  } catch (err) {
    console.warn('[cloudinary] PDF delete failed for', publicId, err.message);
    return false;
  }
}

/**
 * Build a Cloudinary delivery URL for a single page of an uploaded card PDF
 * (uploaded via uploadPdf, resource_type "image"), so the front (page 1)
 * and back (page 2) sides can be downloaded as separate single-page PDFs.
 */
function buildPdfPageUrl(publicId, page = 1) {
  if (!publicId) return null;
  configure();
  return cloudinary.url(publicId, {
    resource_type: 'image',
    format: 'pdf',
    transformation: [{ page }],
    secure: true,
  });
}

module.exports = {
  cloudinary,
  configure,
  isCloudinaryConfigured,
  logCloudinaryConfig,
  uploadPhoto,
  deletePhoto,
  uploadPdf,
  deletePdf,
  buildPdfPageUrl,
};
