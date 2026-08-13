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

test('purpose routes require auth, and only admin can create/edit/delete', async () => {
  const { server, base } = await startServer();
  const adminCookie = await registerAdmin(base, 'purpose_admin1@example.com');

  let res = await fetch(`${base}/api/admin/purposes`);
  assert.equal(res.status, 401);

  res = await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'carbon credit' })
  });
  assert.equal(res.status, 401);

  // create requires a non-empty name
  res = await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: '' })
  });
  assert.equal(res.status, 400);

  server.close();
});

test('admin can create, list, edit, and delete a purpose', async () => {
  const { server, base } = await startServer();
  const adminCookie = await registerAdmin(base, 'purpose_admin2@example.com');

  let res = await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'เพื่อ carbon credit' })
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.name, 'เพื่อ carbon credit');
  assert.ok(created.id);

  res = await fetch(`${base}/api/admin/purposes`, { headers: { Cookie: adminCookie } });
  assert.equal(res.status, 200);
  let list = await res.json();
  assert.equal(list.length, 1);

  res = await fetch(`${base}/api/admin/purposes/${created.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'เพื่อกลุ่มไร่อ้อย' })
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.id, created.id);
  assert.equal(updated.name, 'เพื่อกลุ่มไร่อ้อย');

  res = await fetch(`${base}/api/admin/purposes/${created.id}`, {
    method: 'DELETE', headers: { Cookie: adminCookie }
  });
  assert.equal(res.status, 204);

  res = await fetch(`${base}/api/admin/purposes`, { headers: { Cookie: adminCookie } });
  list = await res.json();
  assert.equal(list.length, 0);

  server.close();
});

test('enterprise_admin can read purposes but not create/edit/delete', async () => {
  const { server, base } = await startServer();
  const adminCookie = await registerAdmin(base, 'purpose_admin3@example.com');

  await fetch(`${base}/api/admin/community-enterprises/ceP`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่มทดสอบ' })
  });

  const regRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '0899990001', password: '15031990',
      name: 'ทดสอบ', nationalId: '9999999990001', dob: '1990-03-15', fieldRegistration: true
    })
  });
  const target = await regRes.json();
  await fetch(`${base}/api/admin/users/${target.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin', managedCommunityEnterpriseId: 'ceP' })
  });
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0899990001', password: '15031990' })
  });
  const enterpriseAdminCookie = getCookie(loginRes);

  let res = await fetch(`${base}/api/admin/purposes`, { headers: { Cookie: enterpriseAdminCookie } });
  assert.equal(res.status, 200);

  res = await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ name: 'ไม่ควรสร้างได้' })
  });
  assert.equal(res.status, 403);

  server.close();
});

test('a plot and a community enterprise can each be linked to a purpose, and deleting the purpose unlinks them', async () => {
  const { server, base } = await startServer();
  const adminCookie = await registerAdmin(base, 'purpose_admin4@example.com');

  const purposeRes = await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'เพื่อกลุ่มผลไม้' })
  });
  const purpose = await purposeRes.json();

  await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลงทดสอบวัตถุประสงค์', boundary: [], purposeId: purpose.id })
  });
  await fetch(`${base}/api/admin/community-enterprises/ceQ`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่มทดสอบวัตถุประสงค์', purposeId: purpose.id, purpose: 'รายละเอียดเพิ่มเติม' })
  });

  let res = await fetch(`${base}/api/plots`);
  let plots = await res.json();
  let plot = plots.find(p => p.id === 'p1');
  assert.equal(plot.purposeId, purpose.id);

  res = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: adminCookie } });
  let entities = await res.json();
  let entity = entities.find(e => e.id === 'ceQ');
  assert.equal(entity.purposeId, purpose.id);
  assert.equal(entity.purpose, 'รายละเอียดเพิ่มเติม');

  await fetch(`${base}/api/admin/purposes/${purpose.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });

  res = await fetch(`${base}/api/plots`);
  plots = await res.json();
  plot = plots.find(p => p.id === 'p1');
  assert.equal(plot.purposeId, null);

  res = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: adminCookie } });
  entities = await res.json();
  entity = entities.find(e => e.id === 'ceQ');
  assert.equal(entity.purposeId, null);
  assert.equal(entity.purpose, 'รายละเอียดเพิ่มเติม');

  server.close();
});
