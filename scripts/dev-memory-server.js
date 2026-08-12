process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-not-for-production';
const { createApp } = require('../server/app');
const { createMemoryStore } = require('../test/memoryStore');
const PORT = process.env.PORT || 8934;
const app = createApp(createMemoryStore());
app.listen(PORT, () => console.log(`dev server (in-memory store, no Postgres needed) on http://localhost:${PORT}`));
