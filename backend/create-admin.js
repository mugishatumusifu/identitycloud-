'use strict';

/**
 * Identity Cloud – Create / Update Admin User
 * -------------------------------------------
 *
 * Usage:
 *   node create-admin.js
 *
 * Or non-interactive (good for scripts / CI):
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=secret123 node create-admin.js
 *
 * If the username already exists, this script UPDATES the password.
 * If it doesn't, it creates the admin.
 *
 * The credentials defined here become the login for /admin in the
 * Identity Cloud frontend.
 */

const readline = require('readline');
const bcrypt   = require('bcryptjs');
const { getDB } = require('./db');

// ── Default credentials (used only if env vars are NOT set AND the user just
//    presses Enter at the prompts). Change these as you like. ────────────────
const DEFAULT_USERNAME = '__chre__';
const DEFAULT_PASSWORD = '*Mugisha12345#';

function ask(rl, prompt, defaultVal) {
  return new Promise(resolve => {
    rl.question(prompt, ans => {
      const v = (ans || '').trim();
      resolve(v.length ? v : defaultVal);
    });
  });
}

(async () => {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  let username = envUser;
  let password = envPass;

  if (!username || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n────────────────────────────────────────────');
    console.log('  Identity Cloud – Admin Account Setup');
    console.log('────────────────────────────────────────────\n');
    if (!username) username = await ask(rl, `Admin username  [${DEFAULT_USERNAME}]: `, DEFAULT_USERNAME);
    if (!password) password = await ask(rl, `Admin password  [${DEFAULT_PASSWORD}]: `, DEFAULT_PASSWORD);
    rl.close();
  }

  if (!username || password.length < 4) {
    console.error('\n✖ Username required and password must be at least 4 characters.\n');
    process.exit(1);
  }

  try {
    const db = await getDB();
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await db.admins.findOne({ username });

    if (existing) {
      await db.admins.findOneAndUpdate({ username }, { $set: { passwordHash } });
      await db.save();
      console.log(`\n✓ Updated existing admin "${username}".`);
    } else {
      await db.admins.create({ username, passwordHash });
      await db.save();
      console.log(`\n✓ Created admin "${username}".`);
    }

    console.log('\n  You can now sign in at:  http://localhost:5174/admin');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n✖ Failed:', err.message, '\n');
    process.exit(1);
  }
})();
