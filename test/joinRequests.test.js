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
  return { cookie: getCookie(res), user: await res.json() };
}

async function registerFieldUser(base, phone, dob, nationalId) {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone, password: dob.split('-').reverse().join(''),
      name: 'ทดสอบ ทดลอง', nationalId, dob, fieldRegistration: true
    })
  });
  return res.json();
}

test('GET /api/purposes and /api/community-enterprises are public (no auth needed)', async () => {
  const { server, base } = await startServer();
  const { cookie } = await registerAdmin(base, 'join_admin1@example.com');

  const purposeRes = await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'เพื่อ carbon credit' })
  });
  const purpose = await purposeRes.json();
  await fetch(`${base}/api/admin/community-enterprises/ce1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'กลุ่มทดสอบ', purposeId: purpose.id })
  });

  let res = await fetch(`${base}/api/purposes`);
  assert.equal(res.status, 200);
  let list = await res.json();
  assert.equal(list.length, 1);

  res = await fetch(`${base}/api/community-enterprises`);
  assert.equal(res.status, 200);
  list = await res.json();
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), ['id', 'name', 'purposeId']);

  server.close();
});

test('linking a plot to a community enterprise with mismatched purpose is rejected', async () => {
  const { server, base } = await startServer();
  const { cookie } = await registerAdmin(base, 'join_admin2@example.com');

  const p1 = await (await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'เพื่อ carbon credit' })
  })).json();
  const p2 = await (await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'เพื่อกลุ่มไร่อ้อย' })
  })).json();
  await fetch(`${base}/api/admin/community-enterprises/ceA`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'กลุ่ม A', purposeId: p1.id })
  });

  // plot has a DIFFERENT purpose than the group -> rejected
  let res = await fetch(`${base}/api/plots/pMismatch`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลงไม่ตรง', boundary: [], purposeId: p2.id, communityEnterpriseId: 'ceA' })
  });
  assert.equal(res.status, 400);

  // plot has NO purpose at all while the group does -> also rejected
  res = await fetch(`${base}/api/plots/pNoPurpose`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลงไม่มีวัตถุประสงค์', boundary: [], communityEnterpriseId: 'ceA' })
  });
  assert.equal(res.status, 400);

  server.close();
});

test('linking with matching purpose lands as pending (not approved), and the client cannot self-approve', async () => {
  const { server, base } = await startServer();
  const { cookie } = await registerAdmin(base, 'join_admin3@example.com');

  const purpose = await (await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'เพื่อกลุ่มผลไม้' })
  })).json();
  await fetch(`${base}/api/admin/community-enterprises/ceB`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'กลุ่ม B', purposeId: purpose.id })
  });

  // client tries to sneak in communityEnterpriseStatus: 'approved' directly -- must be ignored
  let res = await fetch(`${base}/api/plots/pJoin`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'แปลงขอเข้าร่วม', boundary: [], purposeId: purpose.id,
      communityEnterpriseId: 'ceB', communityEnterpriseStatus: 'approved'
    })
  });
  assert.equal(res.status, 200);
  let plot = await res.json();
  assert.equal(plot.communityEnterpriseId, 'ceB');
  assert.equal(plot.communityEnterpriseStatus, 'pending');

  // editing an unrelated field without touching communityEnterpriseId keeps status untouched
  res = await fetch(`${base}/api/plots/pJoin`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'แปลงขอเข้าร่วม (แก้ชื่อ)', boundary: [], purposeId: purpose.id,
      communityEnterpriseId: 'ceB'
    })
  });
  plot = await res.json();
  assert.equal(plot.communityEnterpriseStatus, 'pending');

  server.close();
});

test('admin approves a pending plot join request, which also grants the owner CE membership', async () => {
  const { server, base } = await startServer();
  const { cookie: adminCookie } = await registerAdmin(base, 'join_admin4@example.com');

  const purpose = await (await fetch(`${base}/api/admin/purposes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'เพื่อ carbon credit' })
  })).json();
  await fetch(`${base}/api/admin/community-enterprises/ceC`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่ม C', purposeId: purpose.id })
  });

  const owner = await registerFieldUser(base, '0810000101', '1992-05-10', '1010101010101');

  await fetch(`${base}/api/plots/pOwned`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'แปลงของทดสอบ', boundary: [], purposeId: purpose.id,
      communityEnterpriseId: 'ceC', createdBy: owner.id
    })
  });

  // not-owning enterprise_admin cannot approve
  const otherEA = await registerFieldUser(base, '0810000102', '1990-01-01', '2020202020202');
  await fetch(`${base}/api/admin/community-enterprises/ceOther`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่มอื่น' })
  });
  await fetch(`${base}/api/admin/users/${otherEA.id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin', managedCommunityEnterpriseId: 'ceOther' })
  });
  const otherEALogin = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0810000102', password: '01011990' })
  });
  const otherEACookie = getCookie(otherEALogin);
  let res = await fetch(`${base}/api/admin/community-enterprises/ceC/plots/pOwned/approve`, {
    method: 'PATCH', headers: { Cookie: otherEACookie }
  });
  assert.equal(res.status, 403);

  // admin approves
  res = await fetch(`${base}/api/admin/community-enterprises/ceC/plots/pOwned/approve`, {
    method: 'PATCH', headers: { Cookie: adminCookie }
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.plot.communityEnterpriseStatus, 'approved');
  assert.ok(body.members.some(m => m.id === owner.id));

  // owner is now a real member of the group
  const listRes = await fetch(`${base}/api/admin/community-enterprises`, { headers: { Cookie: adminCookie } });
  const entities = await listRes.json();
  const ceC = entities.find(e => e.id === 'ceC');
  assert.ok(ceC.members.some(m => m.id === owner.id));

  server.close();
});

test('unlinking a plot from its community enterprise clears the join status, and legacy no-purpose links still work', async () => {
  const { server, base } = await startServer();
  const { cookie } = await registerAdmin(base, 'join_admin5@example.com');

  await fetch(`${base}/api/admin/community-enterprises/ceLegacy`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'กลุ่มเก่าไม่มีวัตถุประสงค์' })
  });

  // both plot and group have no purpose set at all -> still allowed (backward compatible)
  let res = await fetch(`${base}/api/plots/pLegacy`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลงเก่า', boundary: [], communityEnterpriseId: 'ceLegacy' })
  });
  assert.equal(res.status, 200);
  let plot = await res.json();
  assert.equal(plot.communityEnterpriseId, 'ceLegacy');
  assert.equal(plot.communityEnterpriseStatus, 'pending');

  // unlink
  res = await fetch(`${base}/api/plots/pLegacy`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'แปลงเก่า', boundary: [], communityEnterpriseId: null })
  });
  plot = await res.json();
  assert.equal(plot.communityEnterpriseId, null);
  assert.equal(plot.communityEnterpriseStatus, null);

  server.close();
});
