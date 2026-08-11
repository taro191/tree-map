const { createApp } = require('./server/app');
const { createPgStore } = require('./server/db');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable.');
  process.exit(1);
}

const store = createPgStore(DATABASE_URL);

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
  const app = createApp(store);
  app.listen(PORT, () => console.log(`tree-map server listening on port ${PORT}`));
}

start();
