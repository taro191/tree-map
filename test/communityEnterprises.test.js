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

async function registerAdmin(base, email) {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'longenough123' })
  });
  return getCookie(res);
}

test('community enterprise routes require auth', async () => {
  const { server, base } = await startServer();

  let res = await fetch(`${base}/api/admin/community-enterprises`);
  assert.equal(res.status, 401);

  res = await fetch(`${base}/api/admin/community-enterprises/e1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x' })
  });
  assert.equal(res.status, 401);

  server.close();
});

test('create, list, edit a community enterprise', async () => {
  const { server, base } = await startServer();
  const cookie = await registerAdmin(base, 'admin@example.com');

  // reject missing name
  let res = await fetch(`${base}/api/admin/community-enterprises/e1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({})
  });
  assert.equal(res.status, 400);

  res = await fetch(`${base}/api/admin/community-enterprises/e1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      name: 'วิสาหกิจชุมชนบ้านหนองกี่', registrationNo: '31-2568-001',
      district: 'หนองกี่', province: 'บุรีรัมย์', postcode: '31210',
      registeredDate: '2026-01-15', chairperson: 'สมชาย ใจดี', contactPhone: '0812345678',
      purpose: 'ปลูกป่าเศรษฐกิจ'
    })
  });
  assert.equal(res.status, 200);
  const saved = await res.json();
  assert.equal(saved.id, 'e1');
  assert.equal(saved.name, 'วิสาหกิจชุมชนบ้านหนองกี่');

  res = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: cookie } });
  const list = await res.json();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].members, []);

  // edit
  res = await fetch(`${base}/api/admin/community-enterprises/e1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'วิสาหกิจชุมชนบ้านหนองกี่ (แก้ไข)' })
  });
  assert.equal((await res.json()).name, 'วิสาหกิจชุมชนบ้านหนองกี่ (แก้ไข)');

  server.close();
});

test('members can only be added from registered users, and deletion is blocked while members remain', async () => {
  const { server, base } = await startServer();
  const cookie = await registerAdmin(base, 'admin2@example.com');

  await fetch(`${base}/api/admin/community-enterprises/e1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'กลุ่มทดสอบ' })
  });

  // adding a nonexistent user fails
  let res = await fetch(`${base}/api/admin/community-enterprises/e1/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ userId: 'does-not-exist' })
  });
  assert.equal(res.status, 404);

  // register a real user to add as a member
  const memberReg = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0899999999', password: 'longenough123' })
  });
  const member = await memberReg.json();

  res = await fetch(`${base}/api/admin/community-enterprises/e1/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ userId: member.id })
  });
  assert.equal(res.status, 201);
  const members = await res.json();
  assert.equal(members.length, 1);
  assert.equal(members[0].phone, '0899999999');

  // deletion is blocked while a member remains
  res = await fetch(`${base}/api/admin/community-enterprises/e1`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(res.status, 409);

  // remove the member, then deletion succeeds
  res = await fetch(`${base}/api/admin/community-enterprises/e1/members/${member.id}`, {
    method: 'DELETE', headers: { Cookie: cookie }
  });
  assert.equal(res.status, 204);

  res = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: cookie } });
  assert.deepEqual((await res.json())[0].members, []);

  res = await fetch(`${base}/api/admin/community-enterprises/e1`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(res.status, 204);

  res = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: cookie } });
  assert.deepEqual(await res.json(), []);

  server.close();
});

test('a plot can be linked to a community enterprise via the existing plots endpoint', async () => {
  const { server, base } = await startServer();
  const cookie = await registerAdmin(base, 'admin3@example.com');

  await fetch(`${base}/api/admin/community-enterprises/e1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'กลุ่มเชื่อมแปลง' })
  });

  let res = await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลง A1', boundary: [], communityEnterpriseId: 'e1' })
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).communityEnterpriseId, 'e1');

  res = await fetch(`${base}/api/plots`);
  const plots = await res.json();
  assert.equal(plots[0].communityEnterpriseId, 'e1');

  // unlink
  res = await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลง A1', boundary: [], communityEnterpriseId: null })
  });
  assert.equal((await res.json()).communityEnterpriseId, null);

  server.close();
});
