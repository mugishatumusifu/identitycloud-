/**
 * githubStorage.js
 * Uploads student photos to the GitHub repository's backend/uploads/photos/
 * folder using the GitHub Contents API so images persist across Render restarts.
 *
 * Required env vars (set in Render dashboard → Environment):
 *   GITHUB_TOKEN   – a GitHub Personal Access Token with `repo` scope
 *   GITHUB_OWNER   – GitHub username or org (e.g. "myusername")
 *   GITHUB_REPO    – repository name        (e.g. "identity-cloud")
 *   GITHUB_BRANCH  – branch to commit to    (default: "main")
 *
 * If these vars are not set, savePhotoToGitHub() returns null and the caller
 * falls back to serving the photo from Render's local disk (ephemeral).
 */

'use strict';

const https = require('https');

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN  || '';
const GITHUB_OWNER  = process.env.GITHUB_OWNER  || '';
const GITHUB_REPO   = process.env.GITHUB_REPO   || '';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Path inside the repo where photos live (no leading slash)
const REPO_PHOTOS_PATH = 'backend/uploads/photos';

// Path inside the repo where the LokiJS DB lives (no leading slash)
const REPO_DB_PATH = 'backend/data/identity-cloud.db';

/**
 * Returns true when all required GitHub env vars are configured.
 */
function isGitHubConfigured() {
  return !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);
}

/**
 * Calls the GitHub Contents API.
 * @param {string} method  – HTTP method (GET, PUT)
 * @param {string} apiPath – path relative to /repos/{owner}/{repo}/contents/
 * @param {object|null} body – request body (will be JSON-stringified)
 */
function ghRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${apiPath}`,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent':    'IdentityCloud-Backend/1.0',
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
      },
    };

    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch (_) { data = raw; }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
        reject(new Error(`GitHub API ${res.statusCode}: ${data?.message || raw}`));
      });
    });

    req.setTimeout(30000, () => { req.destroy(); reject(new Error('GitHub API timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Gets the SHA of an existing file in the repo (needed to update it).
 * Returns null if the file does not exist yet.
 */
async function getFileSha(repoFilePath) {
  try {
    const data = await ghRequest('GET', `${repoFilePath}?ref=${GITHUB_BRANCH}`);
    return data?.sha || null;
  } catch (err) {
    // 404 means file doesn't exist – that's fine
    if (err.message && err.message.includes('404')) return null;
    throw err;
  }
}

/**
 * Saves a base64-encoded photo to the GitHub repo.
 *
 * @param {string} filename   – final filename, e.g. "school_STU001.jpg"
 * @param {string} base64Data – raw base64 string (NO data URI prefix)
 * @returns {string|null}     – raw.githubusercontent.com URL, or null on failure
 */
async function savePhotoToGitHub(filename, base64Data) {
  if (!isGitHubConfigured()) return null;

  const repoFilePath = `${REPO_PHOTOS_PATH}/${filename}`;

  // Get existing SHA (required by GitHub API to update an existing file)
  const existingSha = await getFileSha(repoFilePath);

  const body = {
    message: `chore: upload student photo ${filename}`,
    content: base64Data,   // GitHub API expects raw base64 (no data URI prefix)
    branch:  GITHUB_BRANCH,
  };
  if (existingSha) body.sha = existingSha;

  await ghRequest('PUT', repoFilePath, body);

  // Return the raw content URL so it can be used anywhere without auth
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${repoFilePath}`;
}

/**
 * Downloads the latest identity-cloud.db from the GitHub repo and writes it
 * to localPath.  Call this at startup BEFORE LokiJS loads the file.
 *
 * @param {string} localPath – absolute path where the DB file should be written
 * @returns {boolean} true if the file was pulled, false if it didn't exist yet
 */
async function pullDbFromGitHub(localPath) {
  if (!isGitHubConfigured()) return false;
  let data;
  try {
    data = await ghRequest('GET', `${REPO_DB_PATH}?ref=${GITHUB_BRANCH}`);
  } catch (err) {
    if (err.message && err.message.includes('404')) return false; // not in repo yet
    throw err;
  }
  if (!data || !data.content) return false;
  // GitHub returns content with line-breaks; strip them before decoding
  const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64');
  require('fs').writeFileSync(localPath, raw);
  console.log('[githubStorage] DB pulled from GitHub (' + raw.length + ' bytes)');
  return true;
}

// Debounce state for DB commits – group rapid saves into one GitHub commit
let _dbSaveTimer = null;
const DB_DEBOUNCE_MS = 30_000; // 30 seconds

/**
 * Schedules a commit of the local DB file to GitHub.
 * Multiple calls within DB_DEBOUNCE_MS are collapsed into a single commit.
 *
 * @param {string} localPath – absolute path of the DB file to commit
 */
function saveDbToGitHub(localPath) {
  if (!isGitHubConfigured()) return;
  if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
  _dbSaveTimer = setTimeout(async () => {
    _dbSaveTimer = null;
    try {
      const content = require('fs').readFileSync(localPath);
      const base64  = content.toString('base64');
      const existingSha = await getFileSha(REPO_DB_PATH);
      const body = {
        message: 'chore: persist identity-cloud.db [auto]',
        content: base64,
        branch:  GITHUB_BRANCH,
      };
      if (existingSha) body.sha = existingSha;
      await ghRequest('PUT', REPO_DB_PATH, body);
      console.log('[githubStorage] DB committed to GitHub');
    } catch (err) {
      console.warn('[githubStorage] Failed to commit DB to GitHub:', err.message);
    }
  }, DB_DEBOUNCE_MS);
}

module.exports = { isGitHubConfigured, savePhotoToGitHub, pullDbFromGitHub, saveDbToGitHub };
