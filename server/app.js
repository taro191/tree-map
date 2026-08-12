const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { hashPassword, comparePassword, setSessionCookie, clearSessionCookie, requireAuth } = require('./auth');
const { plotsToCSV, treesToCSV, toGeoJSON } = require('./export');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email, password) {
  if (!EMAIL_RE.test(email)) return 'invalid email';
  if (password.length < 8) return 'password must be at least 8 characters';
  return null;
}

function createApp(store) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

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
      const email = (req.body && req.body.email || '').trim().toLowerCase();
      const password = (req.body && req.body.password) || '';
      const validationError = validateCredentials(email, password);
      if (validationError) return res.status(400).json({ error: validationError });
      const existing = await store.findUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'an account with this email already exists' });
      const passwordHash = await hashPassword(password);
      const user = await store.createUser(crypto.randomUUID(), email, passwordHash);
      setSessionCookie(res, user);
      res.status(201).json({ id: user.id, email: user.email });
    } catch (err) { next(err); }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = (req.body && req.body.email || '').trim().toLowerCase();
      const password = (req.body && req.body.password) || '';
      const user = await store.findUserByEmail(email);
      if (!user || !(await comparePassword(password, user.passwordHash))) {
        return res.status(401).json({ error: 'invalid email or password' });
      }
      setSessionCookie(res, user);
      res.json({ id: user.id, email: user.email });
    } catch (err) { next(err); }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ id: req.user.sub, email: req.user.email });
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
      res.json(users.map(u => ({ id: u.id, email: u.email, createdAt: u.createdAt })));
    } catch (err) { next(err); }
  });

  app.post('/api/admin/users', requireAuth, async (req, res, next) => {
    try {
      const email = (req.body && req.body.email || '').trim().toLowerCase();
      const password = (req.body && req.body.password) || '';
      const validationError = validateCredentials(email, password);
      if (validationError) return res.status(400).json({ error: validationError });
      const existing = await store.findUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'an account with this email already exists' });
      const passwordHash = await hashPassword(password);
      const user = await store.createUser(crypto.randomUUID(), email, passwordHash);
      res.status(201).json({ id: user.id, email: user.email, createdAt: user.createdAt });
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
