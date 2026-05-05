'use strict';

/**
 * Identity Cloud — MongoDB Atlas connection module.
 * Reusable singleton; safe to import from anywhere.
 */

const mongoose = require('mongoose');

let _connPromise = null;

function maskUri(uri = '') {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/, '$1$2:***@');
}

async function connectMongo() {
  if (_connPromise) return _connPromise;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    const err = new Error('MONGO_URI is not set');
    console.error('[mongo] ✖', err.message);
    throw err;
  }

  mongoose.set('strictQuery', true);

  _connPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
    })
    .then((m) => {
      console.log(`[mongo] ✓ Connected to ${maskUri(uri)}`);
      return m.connection;
    })
    .catch((err) => {
      console.error('[mongo] ✖ Connection failed:', err.message);
      _connPromise = null;
      throw err;
    });

  mongoose.connection.on('disconnected', () => console.warn('[mongo] disconnected'));
  mongoose.connection.on('reconnected',  () => console.log('[mongo] reconnected'));
  mongoose.connection.on('error', (e) => console.error('[mongo] error:', e.message));

  return _connPromise;
}

module.exports = { connectMongo, mongoose };
