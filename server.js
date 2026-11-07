const { createApp } = require('./server/app');
const { createPgStore } = require('./server/db');
const { createMysqlStore } = require('./server/mysql');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable.');
  process.exit(1);
}

// mysql:// (MariaDB on Plesk/hostatom) or postgres:// (Render)
const store = DATABASE_URL.startsWith("mysql://") ? createMysqlStore(DATABASE_URL) : createPgStore(DATABASE_URL);

async function start(retriesLeft = 10) {
  try {
    await store.initSchema();
  } catch (err) {
    if (retriesLeft <= 0) {
      console.error('Could not initialize database schema, giving up:', err.message);
      process.exit(1);
    }
    console.warn(`Database not ready yet (${err.message}), retrying in 3s... (${retriesLeft} left)`);
    await new Promise(r => setTimeout(r, 3000));
    return start(retriesLeft - 1);
  }
  if (!process.env.JWT_SECRET) {
    // No JWT_SECRET env var (e.g. Plesk): generate one on first boot and keep it in the
    // database so sessions survive restarts. Insert-if-absent + re-read is race-safe.
    await store.setSettingIfAbsent('jwt_secret', crypto.randomBytes(48).toString('hex'));
    process.env.JWT_SECRET = await store.getSetting('jwt_secret');
    console.log('JWT_SECRET not set; using the secret stored in app_settings.');
  }
  const app = createApp(store);
  app.listen(PORT, () => console.log(`tree-map server listening on port ${PORT}`));
}

start();
