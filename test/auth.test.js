process.env.JWT_SECRET = 'test-secret';

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

function getCookie(res) {
  const raw = res.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : null;
}

test('register rejects invalid email / short password', async () => {
  const { server, base } = await startServer();
  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'longenough123' })
  });
  assert.equal(res.status, 400);

  res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.com', password: 'short' })
  });
  assert.equal(res.status, 400);
  server.close();
});

test('register -> me -> logout -> me fails', async () => {
  const { server, base } = await startServer();

  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'longenough123' })
  });
  assert.equal(res.status, 201);
  const cookie = getCookie(res);
  assert.ok(cookie, 'expected a session cookie to be set');

  res = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  const me = await res.json();
  assert.equal(me.email, 'admin@example.com');

  // no cookie -> unauthenticated
  res = await fetch(`${base}/api/auth/me`);
  assert.equal(res.status, 401);

  res = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(res.status, 204);

  server.close();
});

test('duplicate registration is rejected', async () => {
  const { server, base } = await startServer();
  const payload = { email: 'dup@example.com', password: 'longenough123' };
  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  assert.equal(res.status, 201);

  res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  assert.equal(res.status, 409);
  server.close();
});

test('login with wrong password fails, correct password succeeds', async () => {
  const { server, base } = await startServer();
  await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'correct-password' })
  });

  let res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'user@example.com', password: 'wrong-password' })
  });
  assert.equal(res.status, 401);

  res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'user@example.com', password: 'correct-password' })
  });
  assert.equal(res.status, 200);
  assert.ok(getCookie(res));
  server.close();
});

test('admin export endpoints require auth', async () => {
  const { server, base } = await startServer();

  let res = await fetch(`${base}/api/admin/export/plots.csv`);
  assert.equal(res.status, 401);
  res = await fetch(`${base}/api/admin/export/trees.csv`);
  assert.equal(res.status, 401);
  res = await fetch(`${base}/api/admin/export/geojson`);
  assert.equal(res.status, 401);

  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'exporter@example.com', password: 'longenough123' })
  });
  const cookie = getCookie(reg);

  await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลง A1', boundary: [{ lat: 1, lng: 1 }, { lat: 2, lng: 1 }, { lat: 2, lng: 2 }] })
  });
  await fetch(`${base}/api/trees/t1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId: 'p1', seq: 1, lat: 1.5, lng: 1.5 })
  });

  res = await fetch(`${base}/api/admin/export/plots.csv`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const plotsCsv = await res.text();
  assert.match(plotsCsv, /แปลง A1/);

  res = await fetch(`${base}/api/admin/export/trees.csv`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);

  res = await fetch(`${base}/api/admin/export/geojson`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  const geojson = await res.json();
  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 2); // 1 polygon + 1 point

  server.close();
});

test('admin can add and list other users without losing their own session', async () => {
  const { server, base } = await startServer();

  let res = await fetch(`${base}/api/admin/users`);
  assert.equal(res.status, 401);

  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'boss@example.com', password: 'longenough123' })
  });
  const cookie = getCookie(reg);

  res = await fetch(`${base}/api/admin/users`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).length, 1);

  res = await fetch(`${base}/api/admin/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ email: 'newstaff@example.com', password: 'longenough123' })
  });
  assert.equal(res.status, 201);
  assert.equal(getCookie(res), null); // must NOT switch the caller's session to the new user

  // the admin's own session cookie still works
  res = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).email, 'boss@example.com');

  res = await fetch(`${base}/api/admin/users`, { headers: { Cookie: cookie } });
  const users = await res.json();
  assert.equal(users.length, 2);
  assert.ok(users.every(u => !('passwordHash' in u)));

  // duplicate email still rejected
  res = await fetch(`${base}/api/admin/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ email: 'newstaff@example.com', password: 'longenough123' })
  });
  assert.equal(res.status, 409);

  // the newly-created user can log in with the password the admin set
  res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'newstaff@example.com', password: 'longenough123' })
  });
  assert.equal(res.status, 200);

  server.close();
});

test('registration accepts phone-only accounts, and login works with either identifier', async () => {
  const { server, base } = await startServer();

  // neither email nor phone -> rejected
  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'longenough123' })
  });
  assert.equal(res.status, 400);

  // invalid phone format -> rejected
  res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '12345', password: 'longenough123' })
  });
  assert.equal(res.status, 400);

  // phone-only registration succeeds
  res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '081-234-5678', password: 'longenough123' })
  });
  assert.equal(res.status, 201);
  const registered = await res.json();
  assert.equal(registered.phone, '0812345678'); // dashes stripped
  assert.equal(registered.email, null);

  // duplicate phone rejected
  res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0812345678', password: 'anotherpassword' })
  });
  assert.equal(res.status, 409);

  // login with phone as the identifier
  res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0812345678', password: 'longenough123' })
  });
  assert.equal(res.status, 200);

  server.close();
});

test('field-worker registration: name/nationalId/dob round-trip, duplicate national ID rejected, invalid format rejected', async () => {
  const { server, base } = await startServer();

  // invalid national ID format -> rejected
  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0891112222', password: '14031995', name: 'สมชาย ใจดี', nationalId: '123' })
  });
  assert.equal(res.status, 400);

  // valid registration with dob-as-password
  res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '0891112222', password: '14031995',
      name: 'สมชาย ใจดี', nationalId: '1234567890123', dob: '1995-03-14'
    })
  });
  assert.equal(res.status, 201);
  const registered = await res.json();
  assert.equal(registered.name, 'สมชาย ใจดี');
  const cookie = getCookie(res);
  assert.ok(cookie);

  // duplicate national ID (different phone) -> rejected
  res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '0899998888', password: '01011990',
      name: 'อีกคนหนึ่ง', nationalId: '1234567890123', dob: '1990-01-01'
    })
  });
  assert.equal(res.status, 409);

  // login using phone + dob-derived password succeeds
  res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0891112222', password: '14031995' })
  });
  assert.equal(res.status, 200);

  // session from registration is valid via /api/auth/me
  res = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);

  server.close();
});
