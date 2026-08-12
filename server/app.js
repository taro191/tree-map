const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { hashPassword, comparePassword, setSessionCookie, clearSessionCookie, requireAuth } = require('./auth');
const { plotsToCSV, treesToCSV, toGeoJSON } = require('./export');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0\d{9}$/;
const NATIONAL_ID_RE = /^\d{13}$/;

function normalizePhone(phone) {
  return (phone || '').replace(/[\s-]/g, '');
}

function validateRegistration(email, phone, password) {
  if (!email && !phone) return 'must provide an email or phone number';
  if (email && !EMAIL_RE.test(email)) return 'invalid email';
  if (phone && !PHONE_RE.test(phone)) return 'invalid phone number (must be 10 digits starting with 0)';
  if (password.length < 8) return 'password must be at least 8 characters';
  return null;
}

function createApp(store) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  async function createAccount(email, phone, password, extra) {
    extra = extra || {};
    const validationError = validateRegistration(email, phone, password);
    if (validationError) return { status: 400, error: validationError };
    if (extra.nationalId && !NATIONAL_ID_RE.test(extra.nationalId)) {
      return { status: 400, error: 'invalid national ID (must be 13 digits)' };
    }
    if (email && await store.findUserByEmail(email)) {
      return { status: 409, error: 'an account with this email already exists' };
    }
    if (phone && await store.findUserByPhone(phone)) {
      return { status: 409, error: 'an account with this phone number already exists' };
    }
    if (extra.nationalId && await store.findUserByNationalId(extra.nationalId)) {
      return { status: 409, error: 'an account with this national ID already exists' };
    }
    const passwordHash = await hashPassword(password);
    const user = await store.createUser(crypto.randomUUID(), email || null, phone || null, passwordHash, extra);
    return { user };
  }

  const rootDir = path.join(__dirname, '..');
  const adminDist = path.join(rootDir, 'admin', 'dist');

  app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
    app.get(/^\/admin(\/.*)?$/, (req, res) => {
      res.sendFile(path.join(adminDist, 'index.html'));
    });
  }

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const email = (req.body && req.body.email || '').trim().toLowerCase() || null;
      const phone = normalizePhone(req.body && req.body.phone) || null;
      const password = (req.body && req.body.password) || '';
      const name = (req.body && req.body.name || '').trim() || null;
      const nationalId = (req.body && req.body.nationalId || '').trim() || null;
      const dob = (req.body && req.body.dob || '').trim() || null;
      const result = await createAccount(email, phone, password, { name, nationalId, dob });
      if (result.error) return res.status(result.status).json({ error: result.error });
      setSessionCookie(res, result.user);
      res.status(201).json({
        id: result.user.id, email: result.user.email, phone: result.user.phone, name: result.user.name
      });
    } catch (err) { next(err); }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const identifier = (req.body && req.body.identifier || '').trim();
      const password = (req.body && req.body.password) || '';
      const user = EMAIL_RE.test(identifier)
        ? await store.findUserByEmail(identifier.toLowerCase())
        : await store.findUserByPhone(normalizePhone(identifier));
      if (!user || !(await comparePassword(password, user.passwordHash))) {
        return res.status(401).json({ error: 'invalid email/phone or password' });
      }
      setSessionCookie(res, user);
      res.json({ id: user.id, email: user.email, phone: user.phone });
    } catch (err) { next(err); }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ id: req.user.sub, email: req.user.email, phone: req.user.phone });
  });

  app.get('/api/plots', async (req, res, next) => {
    try {
      res.json(await store.listPlots());
    } catch (err) { next(err); }
  });

  app.put('/api/plots/:id', async (req, res, next) => {
    try {
      const name = (req.body && req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      const plot = { ...req.body, id: req.params.id, name };
      res.json(await store.upsertPlot(plot));
    } catch (err) { next(err); }
  });

  app.delete('/api/plots/:id', async (req, res, next) => {
    try {
      await store.deletePlot(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  app.get('/api/trees', async (req, res, next) => {
    try {
      res.json(await store.listTrees());
    } catch (err) { next(err); }
  });

  app.put('/api/trees/:id', async (req, res, next) => {
    try {
      const { plotId, lat, lng } = req.body || {};
      if (!plotId) return res.status(400).json({ error: 'plotId is required' });
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({ error: 'lat and lng must be numbers' });
      }
      const tree = { ...req.body, id: req.params.id };
      res.json(await store.upsertTree(tree));
    } catch (err) { next(err); }
  });

  app.delete('/api/trees/:id', async (req, res, next) => {
    try {
      await store.deleteTree(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  app.get('/api/admin/users', requireAuth, async (req, res, next) => {
    try {
      const users = await store.listUsers();
      res.json(users.map(u => ({ id: u.id, email: u.email, phone: u.phone, createdAt: u.createdAt })));
    } catch (err) { next(err); }
  });

  app.post('/api/admin/users', requireAuth, async (req, res, next) => {
    try {
      const email = (req.body && req.body.email || '').trim().toLowerCase() || null;
      const phone = normalizePhone(req.body && req.body.phone) || null;
      const password = (req.body && req.body.password) || '';
      const result = await createAccount(email, phone, password);
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(201).json({ id: result.user.id, email: result.user.email, phone: result.user.phone, createdAt: result.user.createdAt });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/community-enterprises', requireAuth, async (req, res, next) => {
    try {
      const entities = await store.listCommunityEnterprises();
      const withMembers = await Promise.all(entities.map(async e => ({
        ...e,
        members: (await store.listCommunityEnterpriseMembers(e.id)).map(u => ({ id: u.id, email: u.email, phone: u.phone }))
      })));
      res.json(withMembers);
    } catch (err) { next(err); }
  });

  app.put('/api/admin/community-enterprises/:id', requireAuth, async (req, res, next) => {
    try {
      const name = (req.body && req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      const entity = { ...req.body, id: req.params.id, name };
      res.json(await store.upsertCommunityEnterprise(entity));
    } catch (err) { next(err); }
  });

  app.delete('/api/admin/community-enterprises/:id', requireAuth, async (req, res, next) => {
    try {
      const memberCount = await store.countCommunityEnterpriseMembers(req.params.id);
      if (memberCount > 0) {
        return res.status(409).json({ error: 'ยังมีสมาชิกอยู่ในกลุ่ม ต้องนำสมาชิกออกให้หมดก่อนจึงจะลบได้' });
      }
      await store.deleteCommunityEnterprise(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  app.post('/api/admin/community-enterprises/:id/members', requireAuth, async (req, res, next) => {
    try {
      const userId = req.body && req.body.userId;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const user = await store.findUserById(userId);
      if (!user) return res.status(404).json({ error: 'user not found' });
      await store.addCommunityEnterpriseMember(req.params.id, userId);
      const members = await store.listCommunityEnterpriseMembers(req.params.id);
      res.status(201).json(members.map(u => ({ id: u.id, email: u.email, phone: u.phone })));
    } catch (err) { next(err); }
  });

  app.delete('/api/admin/community-enterprises/:id/members/:userId', requireAuth, async (req, res, next) => {
    try {
      await store.removeCommunityEnterpriseMember(req.params.id, req.params.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  app.get('/api/admin/export/plots.csv', requireAuth, async (req, res, next) => {
    try {
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="plots.csv"');
      res.send('﻿' + plotsToCSV(await store.listPlots()));
    } catch (err) { next(err); }
  });

  app.get('/api/admin/export/trees.csv', requireAuth, async (req, res, next) => {
    try {
      const [plots, trees] = await Promise.all([store.listPlots(), store.listTrees()]);
      const plotsById = new Map(plots.map(p => [p.id, p]));
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="trees.csv"');
      res.send('﻿' + treesToCSV(trees, plotsById));
    } catch (err) { next(err); }
  });

  app.get('/api/admin/export/geojson', requireAuth, async (req, res, next) => {
    try {
      const [plots, trees] = await Promise.all([store.listPlots(), store.listTrees()]);
      res.set('Content-Type', 'application/geo+json; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="tree-map.geojson"');
      res.json(toGeoJSON(plots, trees));
    } catch (err) { next(err); }
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp };
