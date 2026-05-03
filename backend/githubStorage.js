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

// Path inside the repo where photos live (no leading slash)
const REPO_PHOTOS_PATH = 'backend/uploads/photos';

// Path inside the repo where the LokiJS DB lives (no leading slash)
const REPO_DB_PATH = 'backend/data/identity-cloud.db';

/**
 * Reads GitHub config from env vars at call time (not cached at module load).
 * Handles GITHUB_REPO values that are accidentally set as full URLs, e.g.:
 *   "github.com/owner/repo"  → "repo"
 *   "https://github.com/owner/repo" → "repo"
 *   "owner/repo"             → "repo"
 *   "repo"                   → "repo"   (correct — unchanged)
 */
function getConfig() {
  const token  = process.env.GITHUB_TOKEN  || '';
  const owner  = process.env.GITHUB_OWNER  || '';
  const branch = process.env.GITHUB_BRANCH || 'main';

  let repo = process.env.GITHUB_REPO || '';

  // Strip protocol prefix if present
  repo = repo.replace(/^https?:\/\//i, '');

  // If it contains "github.com/" strip everything up to and including the second slash
  // e.g. "github.com/mugishatumusifu/identitycloud-" → "identitycloud-"
  if (repo.toLowerCase().includes('github.com/')) {
    const parts = repo.split('/');
    repo = parts[parts.length - 1] || parts[parts.length - 2] || repo;
  } else if (repo.includes('/')) {
    // "owner/repo" format — keep only the repo part
    repo = repo.split('/').pop();
  }

  // Strip trailing slash or whitespace
  repo = repo.trim().replace(/\/$/, '');

  return { token, owner, repo, branch };
}

/**
 * Returns true when all required GitHub env vars are configured.
 */
function isGitHubConfigured() {
  const { token, owner, repo } = getConfig();
  return !!(token && owner && repo);
}

/**
 * Logs the resolved GitHub config on startup so it's visible in Render logs.
 * Call this once after the server starts.
 */
function logGitHubConfig() {
  const { token, owner, repo, branch } = getConfig();
  if (token && owner && repo) {
    console.log(`[githubStorage] GitHub configured: owner=${owner} repo=${repo} branch=${branch} token=${token.slice(0, 12)}...`);
  } else {
    console.warn('[githubStorage] GitHub NOT fully configured — photos will use ephemeral local disk only.');
    console.warn(`[githubStorage]   GITHUB_TOKEN  = ${token  ? '(set)' : '(MISSING)'}`);
    console.warn(`[githubStorage]   GITHUB_OWNER  = ${owner  || '(MISSING)'}`);
    console.warn(`[githubStorage]   GITHUB_REPO   = ${repo   || '(MISSING)'} (raw: "${process.env.GITHUB_REPO || ''}")`);
  }
}

/**
 * Calls the GitHub Contents API.
 * @param {string} method  – HTTP method (GET, PUT)
 * @param {string} apiPath – path relative to /repos/{owner}/{repo}/contents/
 * @param {object|null} body – request body (will be JSON-stringified)
 */
function ghRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const { token, owner, repo } = getConfig();
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${owner}/${repo}/contents/${apiPath}`,
      method,
      headers: {
        'Authorization': `token ${token}`,
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
  const { branch } = getConfig();
  try {
    const data = await ghRequest('GET', `${repoFilePath}?ref=${branch}`);
    return data?.sha || null;
  } catch (err) {
    // 404 = file doesn't exist yet (normal for first upload) → return null so PUT creates it.
    // Any other error (401, 403, 422…) → also return null and let the PUT attempt proceed;
    // if the PUT also fails it will throw and the caller will log the real error.
    if (!err.message.includes('404')) {
      console.warn('[githubStorage] getFileSha warning:', err.message);
    }
    return null;
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
  if (!isGitHubConfigured()) {
    console.warn('[githubStorage] savePhotoToGitHub called but GitHub is not configured.');
    return null;
  }

  const { owner, repo, branch } = getConfig();
  const repoFilePath = `${REPO_PHOTOS_PATH}/${filename}`;

  console.log(`[githubStorage] Uploading photo: ${filename} → ${owner}/${repo}/${repoFilePath}`);

  // Get existing SHA (required by GitHub API to update an existing file).
  // Returns null if file is new — that's fine for a fresh upload.
  const existingSha = await getFileSha(repoFilePath);

  const body = {
    message: `chore: upload student photo ${filename}`,
    content: base64Data,   // GitHub API expects raw base64 (no data URI prefix)
    branch,
  };
  if (existingSha) {
    body.sha = existingSha;
    console.log(`[githubStorage] Updating existing file (sha=${existingSha.slice(0, 8)}...)`);
  }

  await ghRequest('PUT', repoFilePath, body);

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${repoFilePath}`;
  console.log(`[githubStorage] Photo committed successfully: ${url}`);
  return url;
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
  const { branch } = getConfig();
  let data;
  try {
    data = await ghRequest('GET', `${REPO_DB_PATH}?ref=${branch}`);
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
    const { branch } = getConfig();
    try {
      const content = require('fs').readFileSync(localPath);
      const base64  = content.toString('base64');
      const existingSha = await getFileSha(REPO_DB_PATH);
      const body = {
        message: 'chore: persist identity-cloud.db [auto]',
        content: base64,
        branch,
      };
      if (existingSha) body.sha = existingSha;
      await ghRequest('PUT', REPO_DB_PATH, body);
      console.log('[githubStorage] DB committed to GitHub');
    } catch (err) {
      console.warn('[githubStorage] Failed to commit DB to GitHub:', err.message);
    }
  }, DB_DEBOUNCE_MS);
}

module.exports = { isGitHubConfigured, logGitHubConfig, savePhotoToGitHub, pullDbFromGitHub, saveDbToGitHub };
