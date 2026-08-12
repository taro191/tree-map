const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');
const { createMemoryStore } = require('./memoryStore');

function startServer() {
  const store = createMemoryStore();
  const app = createApp(store);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

test('health check', async () => {
  const { server, base } = await startServer();
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  server.close();
});

test('serves index.html at /', async () => {
  const { server, base } = await startServer();
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /html/);
  server.close();
});

test('plot CRUD lifecycle', async () => {
  const { server, base } = await startServer();

  // no plots initially
  let res = await fetch(`${base}/api/plots`);
  assert.deepEqual(await res.json(), []);

  // reject missing name
  res = await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
  });
  assert.equal(res.status, 400);

  // create plot
  const plot = {
    name: 'แปลง A1', ownerName: 'สมชาย', ownerContact: '0812345678',
    docTitle: 'สปก 4-01ข', areaRai: '6', areaNgan: '1', areaWa: '',
    district: 'หนองกี่', province: 'บุรีรัมย์', postcode: '31210',
    color: '#3D6B4A', boundary: [{ lat: 13.7, lng: 100.5 }, { lat: 13.71, lng: 100.5 }, { lat: 13.71, lng: 100.51 }],
    photo: null, docPhoto: null
  };
  res = await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plot)
  });
  assert.equal(res.status, 200);
  const saved = await res.json();
  assert.equal(saved.id, 'p1');
  assert.equal(saved.name, 'แปลง A1');
  assert.equal(saved.postcode, '31210');
  assert.equal(saved.boundary.length, 3);

  // appears in list
  res = await fetch(`${base}/api/plots`);
  const list = await res.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'p1');

  // update (upsert) same id
  res = await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...plot, name: 'แปลง A1 แก้ไข', photo: 'data:image/jpeg;base64,xxx' })
  });
  const updated = await res.json();
  assert.equal(updated.name, 'แปลง A1 แก้ไข');
  assert.equal(updated.photo, 'data:image/jpeg;base64,xxx');
  res = await fetch(`${base}/api/plots`);
  assert.equal((await res.json()).length, 1);

  server.close();
});

test('plot subdistrict persists, and created_by is set on create but immutable on later edits', async () => {
  const { server, base } = await startServer();

  const plot = {
    name: 'แปลง B1', subdistrict: 'วัดเกต', district: 'เมืองเชียงใหม่', province: 'เชียงใหม่', postcode: '50000',
    boundary: [{ lat: 13.7, lng: 100.5 }, { lat: 13.71, lng: 100.5 }, { lat: 13.71, lng: 100.51 }],
    createdBy: 'user-1'
  };
  let res = await fetch(`${base}/api/plots/p-created-by`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plot)
  });
  let saved = await res.json();
  assert.equal(saved.subdistrict, 'วัดเกต');
  assert.equal(saved.createdBy, 'user-1');

  // editing with a different createdBy must not change the original creator
  res = await fetch(`${base}/api/plots/p-created-by`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...plot, name: 'แปลง B1 แก้ไข', subdistrict: 'ท่าศาลา', createdBy: 'user-2' })
  });
  saved = await res.json();
  assert.equal(saved.name, 'แปลง B1 แก้ไข');
  assert.equal(saved.subdistrict, 'ท่าศาลา');
  assert.equal(saved.createdBy, 'user-1'); // unchanged despite the request sending user-2

  server.close();
});

test('plot reference point round-trip', async () => {
  const { server, base } = await startServer();

  const plot = { name: 'แปลง B1', boundary: [] };
  let res = await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plot)
  });
  let saved = await res.json();
  assert.equal(saved.refPoint, null);

  const refPoint = {
    lat: 13.71, lng: 100.51, description: 'หลักเขตหินก้อนใหญ่',
    photos: ['data:image/jpeg;base64,aaa', 'data:image/jpeg;base64,bbb']
  };
  res = await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...plot, refPoint })
  });
  saved = await res.json();
  assert.deepEqual(saved.refPoint, refPoint);

  res = await fetch(`${base}/api/plots`);
  const list = await res.json();
  assert.deepEqual(list[0].refPoint, refPoint);

  server.close();
});

test('tree CRUD + validation + cascade delete on plot removal', async () => {
  const { server, base } = await startServer();

  // create a plot first
  await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลง A1', boundary: [] })
  });

  // reject missing plotId
  let res = await fetch(`${base}/api/trees/t1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: 13.7, lng: 100.5 })
  });
  assert.equal(res.status, 400);

  // reject non-numeric lat/lng
  res = await fetch(`${base}/api/trees/t1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId: 'p1', lat: '13.7', lng: 100.5 })
  });
  assert.equal(res.status, 400);

  // create tree
  res = await fetch(`${base}/api/trees/t1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId: 'p1', seq: 1, name: 'มะม่วง', note: '', lat: 13.705, lng: 100.505 })
  });
  assert.equal(res.status, 200);
  const tree = await res.json();
  assert.equal(tree.plotId, 'p1');
  assert.equal(tree.lat, 13.705);

  res = await fetch(`${base}/api/trees`);
  assert.equal((await res.json()).length, 1);

  // delete the plot -> tree should cascade delete
  res = await fetch(`${base}/api/plots/p1`, { method: 'DELETE' });
  assert.equal(res.status, 204);

  res = await fetch(`${base}/api/trees`);
  assert.deepEqual(await res.json(), []);

  res = await fetch(`${base}/api/plots`);
  assert.deepEqual(await res.json(), []);

  server.close();
});

test('tree code/codePhoto round-trip and edit (seq, photo, code) via upsert', async () => {
  const { server, base } = await startServer();

  await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลง A1', boundary: [] })
  });

  let res = await fetch(`${base}/api/trees/t1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plotId: 'p1', seq: 1, name: 'มะม่วง', code: 'TAG-001',
      photoUrl: 'data:image/jpeg;base64,aaa', codePhoto: 'data:image/jpeg;base64,bbb',
      note: '', lat: 13.705, lng: 100.505
    })
  });
  assert.equal(res.status, 200);
  let tree = await res.json();
  assert.equal(tree.code, 'TAG-001');
  assert.equal(tree.codePhoto, 'data:image/jpeg;base64,bbb');
  assert.equal(tree.photoUrl, 'data:image/jpeg;base64,aaa');

  // edit: change seq, replace photo, change code
  res = await fetch(`${base}/api/trees/t1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plotId: 'p1', seq: 5, name: 'มะม่วง', code: 'TAG-002',
      photoUrl: 'data:image/jpeg;base64,ccc', codePhoto: 'data:image/jpeg;base64,bbb',
      note: 'แก้ไขแล้ว', lat: 13.705, lng: 100.505
    })
  });
  assert.equal(res.status, 200);
  tree = await res.json();
  assert.equal(tree.seq, 5);
  assert.equal(tree.code, 'TAG-002');
  assert.equal(tree.photoUrl, 'data:image/jpeg;base64,ccc');
  assert.equal(tree.note, 'แก้ไขแล้ว');

  res = await fetch(`${base}/api/trees`);
  const list = await res.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].seq, 5);

  server.close();
});

test('deleting a nonexistent tree is idempotent', async () => {
  const { server, base } = await startServer();
  const res = await fetch(`${base}/api/trees/does-not-exist`, { method: 'DELETE' });
  assert.equal(res.status, 204);
  server.close();
});
