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

async function registerAdmin(base, phone) {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password: 'longenough123' })
  });
  const user = await res.json();
  return { cookie: getCookie(res), user };
}

let nationalIdCounter = 1000000000000;

async function registerFieldUser(base, phone, dob) {
  const nationalId = String(nationalIdCounter++);
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone, password: dob.split('-').reverse().join(''),
      name: 'ทดสอบ ทดลอง', nationalId, dob, fieldRegistration: true
    })
  });
  const user = await res.json();
  return { cookie: getCookie(res), user };
}

test('admin self-registration (no fieldRegistration flag) still gets role=admin', async () => {
  const { server, base } = await startServer();
  const { user } = await registerAdmin(base, '0810000001');
  assert.equal(user.role, 'admin');
  server.close();
});

test('field-app registration gets role=user, and is denied all /api/admin/* routes', async () => {
  const { server, base } = await startServer();
  const { cookie } = await registerFieldUser(base, '0810000002', '1995-03-14');

  let res = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 403);

  res = await fetch(`${base}/api/admin/users`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 403);

  res = await fetch(`${base}/api/admin/export/plots.csv`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 403);

  res = await fetch(`${base}/api/admin/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ phone: '0899999999', password: 'longenough123' })
  });
  assert.equal(res.status, 403);

  server.close();
});

test('admin can promote a user to enterprise_admin for a specific community enterprise', async () => {
  const { server, base } = await startServer();
  const { cookie: adminCookie } = await registerAdmin(base, '0810000003');

  // create a community enterprise as admin
  let res = await fetch(`${base}/api/admin/community-enterprises/ce1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'วิสาหกิจชุมชนทดสอบ' })
  });
  assert.equal(res.status, 200);

  // register a target user (as a plain field user first)
  const { user: target } = await registerFieldUser(base, '0810000004', '1990-01-01');

  // promote to enterprise_admin, scoped to ce1
  res = await fetch(`${base}/api/admin/users/${target.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin', managedCommunityEnterpriseId: 'ce1' })
  });
  assert.equal(res.status, 200);
  const promoted = await res.json();
  assert.equal(promoted.role, 'enterprise_admin');
  assert.equal(promoted.managedCommunityEnterpriseId, 'ce1');

  // promoting to enterprise_admin without a target CE is rejected
  res = await fetch(`${base}/api/admin/users/${target.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin' })
  });
  assert.equal(res.status, 400);

  // promoting to enterprise_admin for a nonexistent CE is rejected
  res = await fetch(`${base}/api/admin/users/${target.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin', managedCommunityEnterpriseId: 'does-not-exist' })
  });
  assert.equal(res.status, 404);

  server.close();
});

test('enterprise_admin can manage only their own community enterprise', async () => {
  const { server, base } = await startServer();
  const { cookie: adminCookie } = await registerAdmin(base, '0810000005');

  await fetch(`${base}/api/admin/community-enterprises/ceA`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่ม A' })
  });
  await fetch(`${base}/api/admin/community-enterprises/ceB`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่ม B' })
  });

  const { user: target } = await registerFieldUser(base, '0810000006', '1988-07-20');
  await fetch(`${base}/api/admin/users/${target.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin', managedCommunityEnterpriseId: 'ceA' })
  });

  // log in as the newly promoted enterprise_admin to get a fresh token carrying the new role
  let res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0810000006', password: '20071988' })
  });
  assert.equal(res.status, 200);
  const enterpriseAdminCookie = getCookie(res);

  // GET list is scoped to only their own CE
  res = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: enterpriseAdminCookie } });
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'ceA');

  // can edit their own CE
  res = await fetch(`${base}/api/admin/community-enterprises/ceA`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ name: 'กลุ่ม A (แก้ไขแล้ว)' })
  });
  assert.equal(res.status, 200);

  // cannot edit a different CE
  res = await fetch(`${base}/api/admin/community-enterprises/ceB`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ name: 'แอบแก้กลุ่ม B' })
  });
  assert.equal(res.status, 403);

  // can add a member to their own CE
  const { user: member } = await registerFieldUser(base, '0810000007', '1992-02-02');
  res = await fetch(`${base}/api/admin/community-enterprises/ceA/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ userId: member.id })
  });
  assert.equal(res.status, 201);

  // cannot add a member to a different CE
  res = await fetch(`${base}/api/admin/community-enterprises/ceB/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ userId: member.id })
  });
  assert.equal(res.status, 403);

  // cannot delete their own CE even with zero members would still be forbidden by role (admin-only route)
  res = await fetch(`${base}/api/admin/community-enterprises/ceA`, {
    method: 'DELETE', headers: { Cookie: enterpriseAdminCookie }
  });
  assert.equal(res.status, 403);

  // can list registered users (needed for the member picker)
  res = await fetch(`${base}/api/admin/users`, { headers: { Cookie: enterpriseAdminCookie } });
  assert.equal(res.status, 200);

  // cannot create new user accounts directly
  res = await fetch(`${base}/api/admin/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ phone: '0888888888', password: 'longenough123' })
  });
  assert.equal(res.status, 403);

  // cannot promote other users
  res = await fetch(`${base}/api/admin/users/${member.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ role: 'admin' })
  });
  assert.equal(res.status, 403);

  server.close();
});

test('enterprise_admin exports are scoped to their own community enterprise plots/trees', async () => {
  const { server, base } = await startServer();
  const { cookie: adminCookie } = await registerAdmin(base, '0810000008');

  await fetch(`${base}/api/admin/community-enterprises/ceX`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่ม X' })
  });

  await fetch(`${base}/api/plots/p1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลงในกลุ่ม X', boundary: [], communityEnterpriseId: 'ceX' })
  });
  await fetch(`${base}/api/plots/p2`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลงนอกกลุ่ม', boundary: [] })
  });
  await fetch(`${base}/api/trees/t1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId: 'p1', seq: 1, lat: 13.7, lng: 100.5 })
  });
  await fetch(`${base}/api/trees/t2`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId: 'p2', seq: 1, lat: 13.8, lng: 100.6 })
  });

  const { user: target } = await registerFieldUser(base, '0810000009', '1985-12-25');
  await fetch(`${base}/api/admin/users/${target.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin', managedCommunityEnterpriseId: 'ceX' })
  });
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0810000009', password: '25121985' })
  });
  const enterpriseAdminCookie = getCookie(loginRes);

  let res = await fetch(`${base}/api/admin/export/plots.csv`, { headers: { Cookie: enterpriseAdminCookie } });
  let csv = await res.text();
  assert.match(csv, /แปลงในกลุ่ม X/);
  assert.doesNotMatch(csv, /แปลงนอกกลุ่ม/);

  res = await fetch(`${base}/api/admin/export/geojson`, { headers: { Cookie: enterpriseAdminCookie } });
  const geojson = await res.json();
  // 1 plot polygon skipped (no boundary), only tree points remain -> expect just t1
  const ids = geojson.features.map(f => f.properties.id);
  assert.ok(ids.includes('t1'));
  assert.ok(!ids.includes('t2'));

  // admin's own export is unscoped (sees everything)
  res = await fetch(`${base}/api/admin/export/plots.csv`, { headers: { Cookie: adminCookie } });
  csv = await res.text();
  assert.match(csv, /แปลงในกลุ่ม X/);
  assert.match(csv, /แปลงนอกกลุ่ม/);

  server.close();
});
