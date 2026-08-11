const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');
const { createPgStore } = require('../server/db');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

test('plot CRUD + Thai UTF-8 round-trip against a real Postgres database', { skip: !TEST_DATABASE_URL && 'set TEST_DATABASE_URL to run this against a real Postgres instance' }, async () => {
  const store = createPgStore(TEST_DATABASE_URL);
  await store.initSchema();
  const app = createApp(store);
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    const id = 'pg-test-' + Date.now();
    const payload = {
      name: 'แปลง A1', ownerName: 'สมชาย', docTitle: 'สปก 4-01ข',
      district: 'หนองกี่', province: 'บุรีรัมย์', postcode: '31210',
      boundary: [{ lat: 13.7, lng: 100.5 }, { lat: 13.71, lng: 100.5 }, { lat: 13.71, lng: 100.51 }]
    };

    let res = await fetch(`${base}/api/plots/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    assert.equal(res.status, 200);
    const saved = await res.json();
    assert.equal(saved.name, 'แปลง A1');
    assert.equal(saved.ownerName, 'สมชาย');
    assert.equal(saved.district, 'หนองกี่');
    assert.equal(saved.boundary.length, 3);

    res = await fetch(`${base}/api/trees/${id}-t1`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plotId: id, seq: 1, name: 'มะม่วง', lat: 13.705, lng: 100.505 })
    });
    assert.equal(res.status, 200);

    res = await fetch(`${base}/api/plots/${id}`, { method: 'DELETE' });
    assert.equal(res.status, 204);

    res = await fetch(`${base}/api/trees`);
    const trees = await res.json();
    assert.ok(!trees.some(t => t.plotId === id), 'tree should be cascade-deleted with its plot');
  } finally {
    server.close();
    await store.pool.end();
  }
});
