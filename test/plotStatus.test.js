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

const BOUNDARY = [{ lat: 13.7, lng: 100.5 }, { lat: 13.71, lng: 100.5 }, { lat: 13.71, lng: 100.51 }];

async function putPlot(base, id, body, cookie) {
  return fetch(`${base}/api/plots/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ name: 'แปลงทดสอบ', boundary: BOUNDARY, ...body })
  });
}

async function putTree(base, id, body) {
  return fetch(`${base}/api/trees/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId: 'p1', seq: 1, lat: 13.705, lng: 100.505, ...body })
  });
}

test('new plot defaults to data_entry status', async () => {
  const { server, base } = await startServer();
  const res = await putPlot(base, 'p1', {});
  const plot = await res.json();
  assert.equal(plot.status, 'data_entry');
  server.close();
});

test('adding the first tree bumps plot status to tree_survey, later trees do not change it further', async () => {
  const { server, base } = await startServer();
  await putPlot(base, 'p1', {});

  let res = await putTree(base, 't1', {});
  assert.equal(res.status, 200);
  let plot = await (await fetch(`${base}/api/plots`)).json().then(list => list[0]);
  assert.equal(plot.status, 'tree_survey');

  res = await putTree(base, 't2', { seq: 2 });
  assert.equal(res.status, 200);
  plot = await (await fetch(`${base}/api/plots`)).json().then(list => list[0]);
  assert.equal(plot.status, 'tree_survey');

  server.close();
});

test('submit requires tree_survey status; blocked from data_entry', async () => {
  const { server, base } = await startServer();
  await putPlot(base, 'p1', {});
  const res = await fetch(`${base}/api/plots/p1/submit`, { method: 'POST' });
  assert.equal(res.status, 409);
  server.close();
});

test('submit succeeds from tree_survey, then plot and its trees become locked', async () => {
  const { server, base } = await startServer();
  await putPlot(base, 'p1', {});
  await putTree(base, 't1', {});

  let res = await fetch(`${base}/api/plots/p1/submit`, { method: 'POST' });
  assert.equal(res.status, 200);
  let plot = await res.json();
  assert.equal(plot.status, 'submitted');

  // editing the locked plot is rejected
  res = await putPlot(base, 'p1', { docTitle: 'แก้ไขระหว่างล็อก' });
  assert.equal(res.status, 409);

  // editing an existing tree on the locked plot is rejected
  res = await putTree(base, 't1', { name: 'ชื่อใหม่' });
  assert.equal(res.status, 409);

  // adding a new tree to the locked plot is rejected
  res = await putTree(base, 't2', { seq: 2 });
  assert.equal(res.status, 409);

  server.close();
});

test('admin status-change endpoint requires auth, a valid status, and a non-empty note', async () => {
  const { server, base } = await startServer();
  await putPlot(base, 'p1', {});

  let res = await fetch(`${base}/api/admin/plots/p1/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'approved', note: 'ok' })
  });
  assert.equal(res.status, 401);

  const registerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0810000001', password: 'longenough123' })
  });
  const cookie = getCookie(registerRes);

  res = await fetch(`${base}/api/admin/plots/p1/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'not-a-real-status', note: 'ok' })
  });
  assert.equal(res.status, 400);

  res = await fetch(`${base}/api/admin/plots/p1/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'approved', note: '' })
  });
  assert.equal(res.status, 400);

  res = await fetch(`${base}/api/admin/plots/p1/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'approved', note: 'ข้อมูลครบถ้วนถูกต้อง' })
  });
  assert.equal(res.status, 200);
  const plot = await res.json();
  assert.equal(plot.status, 'approved');
  assert.equal(plot.reviewNote, 'ข้อมูลครบถ้วนถูกต้อง');

  server.close();
});

test('reject flow: admin sends a submitted plot back to tree_survey with a note and photos, unlocking it', async () => {
  const { server, base } = await startServer();
  await putPlot(base, 'p1', {});
  await putTree(base, 't1', {});
  await fetch(`${base}/api/plots/p1/submit`, { method: 'POST' });

  const registerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0810000002', password: 'longenough123' })
  });
  const cookie = getCookie(registerRes);

  const res = await fetch(`${base}/api/admin/plots/p1/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'tree_survey', note: 'ขอบเขตแปลงไม่ตรงกับพิกัดจริง กรุณาแก้ไข', photos: ['data:image/png;base64,aaa'] })
  });
  assert.equal(res.status, 200);
  const plot = await res.json();
  assert.equal(plot.status, 'tree_survey');
  assert.equal(plot.reviewNote, 'ขอบเขตแปลงไม่ตรงกับพิกัดจริง กรุณาแก้ไข');
  assert.deepEqual(plot.reviewPhotos, ['data:image/png;base64,aaa']);

  // now unlocked again: editing succeeds
  const editRes = await putPlot(base, 'p1', { docTitle: 'แก้ไขตามคำแนะนำแล้ว' });
  assert.equal(editRes.status, 200);

  server.close();
});

test('enterprise_admin can only change status for plots in their own community enterprise', async () => {
  const { server, base } = await startServer();

  const adminRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0810000003', password: 'longenough123' })
  });
  const adminCookie = getCookie(adminRes);

  await fetch(`${base}/api/admin/community-enterprises/ceA`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่ม A' })
  });
  await fetch(`${base}/api/admin/community-enterprises/ceB`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'กลุ่ม B' })
  });

  await putPlot(base, 'p-a', { communityEnterpriseId: 'ceA' });
  await putPlot(base, 'p-b', { communityEnterpriseId: 'ceB' });

  const fieldUserRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0810000004', password: '01011990', name: 'ทดสอบ', nationalId: '1234567890123', dob: '1990-01-01', fieldRegistration: true })
  });
  const fieldUserId = (await fieldUserRes.json()).id;
  await fetch(`${base}/api/admin/users/${fieldUserId}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ role: 'enterprise_admin', managedCommunityEnterpriseId: 'ceA' })
  });
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0810000004', password: '01011990' })
  });
  const enterpriseAdminCookie = getCookie(loginRes);

  let res = await fetch(`${base}/api/admin/plots/p-a/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ status: 'approved', note: 'ผ่านการตรวจสอบ' })
  });
  assert.equal(res.status, 200);

  res = await fetch(`${base}/api/admin/plots/p-b/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: enterpriseAdminCookie },
    body: JSON.stringify({ status: 'approved', note: 'ผ่านการตรวจสอบ' })
  });
  assert.equal(res.status, 403);

  server.close();
});
