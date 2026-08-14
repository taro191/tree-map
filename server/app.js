const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const {
  hashPassword, comparePassword, setSessionCookie, clearSessionCookie,
  requireAuth, requireAdmin, requireAdminOrEnterpriseAdmin
} = require('./auth');
const { plotsToCSV, treesToCSV, toGeoJSON } = require('./export');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0\d{9}$/;
const NATIONAL_ID_RE = /^\d{13}$/;
const VALID_ROLES = ['user', 'admin', 'enterprise_admin'];
const PLOT_STATUSES = ['data_entry', 'tree_survey', 'submitted', 'approved'];
const LOCKED_PLOT_STATUSES = ['submitted', 'approved'];
const PLOT_LOCKED_MESSAGE = 'แปลงนี้อยู่ระหว่างตรวจสอบหรือตรวจสอบผ่านแล้ว ไม่สามารถแก้ไขข้อมูลได้';

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
      // Self-registration from the field app (index.html) always gets the lowest-privilege
      // role, never admin — the client-supplied flag can only *downgrade* from the default.
      const isFieldRegistration = !!(req.body && req.body.fieldRegistration);
      const role = isFieldRegistration ? 'user' : 'admin';
      const result = await createAccount(email, phone, password, { name, nationalId, dob, role });
      if (result.error) return res.status(result.status).json({ error: result.error });
      setSessionCookie(res, result.user);
      res.status(201).json({
        id: result.user.id, email: result.user.email, phone: result.user.phone,
        name: result.user.name, role: result.user.role,
        managedCommunityEnterpriseId: result.user.managedCommunityEnterpriseId
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
      res.json({
        id: user.id, email: user.email, phone: user.phone, name: user.name,
        role: user.role, managedCommunityEnterpriseId: user.managedCommunityEnterpriseId
      });
    } catch (err) { next(err); }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({
      id: req.user.sub, email: req.user.email, phone: req.user.phone, name: req.user.name,
      role: req.user.role, managedCommunityEnterpriseId: req.user.managedCommunityEnterpriseId
    });
  });

  app.get('/api/plots', async (req, res, next) => {
    try {
      res.json(await store.listPlots());
    } catch (err) { next(err); }
  });

  app.get('/api/purposes', async (req, res, next) => {
    try {
      res.json(await store.listPurposes());
    } catch (err) { next(err); }
  });

  app.get('/api/community-enterprises', async (req, res, next) => {
    try {
      const entities = await store.listCommunityEnterprises();
      res.json(entities.map(e => ({ id: e.id, name: e.name, purposeId: e.purposeId, maxPlotAreaRai: e.maxPlotAreaRai })));
    } catch (err) { next(err); }
  });

  app.put('/api/plots/:id', async (req, res, next) => {
    try {
      const name = (req.body && req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      const existing = await store.findPlotById(req.params.id);
      if (existing && LOCKED_PLOT_STATUSES.includes(existing.status)) {
        return res.status(409).json({ error: PLOT_LOCKED_MESSAGE });
      }

      // A community-enterprise link is a join request, not an immediate membership: any
      // NEW assignment (as opposed to leaving one unchanged) always lands as 'pending'
      // here, ignoring whatever status the client sent -- the client can't self-approve
      // through this public route. Only the dedicated admin approve endpoint can flip it
      // to 'approved'. Unchanged assignments keep whatever status they already had.
      const requestedCeId = (req.body && req.body.communityEnterpriseId) || null;
      const existingCeId = existing ? existing.communityEnterpriseId : null;
      const requestedPurposeId = (req.body && req.body.purposeId) || (existing ? existing.purposeId : null) || null;
      let communityEnterpriseStatus = existing ? existing.communityEnterpriseStatus : null;

      if (requestedCeId !== existingCeId) {
        if (!requestedCeId) {
          communityEnterpriseStatus = null;
        } else {
          const targetCe = await store.findCommunityEnterpriseById(requestedCeId);
          if (!targetCe) return res.status(404).json({ error: 'community enterprise not found' });
          if (requestedPurposeId !== (targetCe.purposeId || null)) {
            return res.status(400).json({ error: 'วัตถุประสงค์ของแปลงต้องตรงกับวัตถุประสงค์ของวิสาหกิจชุมชนจึงจะขอเข้าร่วมกลุ่มได้' });
          }
          if (targetCe.maxPlotAreaRai != null) {
            const requestedAreaRai = Number((req.body && req.body.areaRai) != null ? req.body.areaRai : (existing ? existing.areaRai : 0)) || 0;
            if (requestedAreaRai > Number(targetCe.maxPlotAreaRai)) {
              return res.status(400).json({ error: `ขนาดแปลง (${requestedAreaRai} ไร่) เกินขนาดแปลงสูงสุดที่วิสาหกิจชุมชนนี้กำหนดไว้ (${targetCe.maxPlotAreaRai} ไร่)` });
            }
          }
          communityEnterpriseStatus = 'pending';
        }
      }

      const plot = { ...req.body, id: req.params.id, name, communityEnterpriseId: requestedCeId, communityEnterpriseStatus };
      res.json(await store.upsertPlot(plot));
    } catch (err) { next(err); }
  });

  app.post('/api/plots/:id/submit', async (req, res, next) => {
    try {
      const plot = await store.findPlotById(req.params.id);
      if (!plot) return res.status(404).json({ error: 'plot not found' });
      if (plot.status !== 'tree_survey') {
        return res.status(409).json({ error: 'ส่งแปลงตรวจสอบได้เฉพาะแปลงที่อยู่ในสถานะสำรวจต้นไม้เท่านั้น' });
      }
      const updated = await store.updatePlotStatus(req.params.id, 'submitted', plot.reviewNote, plot.reviewPhotos);
      res.json(updated);
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
      const plot = await store.findPlotById(plotId);
      if (!plot) return res.status(404).json({ error: 'plot not found' });
      if (LOCKED_PLOT_STATUSES.includes(plot.status)) {
        return res.status(409).json({ error: PLOT_LOCKED_MESSAGE });
      }
      const isNew = !(await store.findTreeById(req.params.id));
      const tree = { ...req.body, id: req.params.id };
      const saved = await store.upsertTree(tree);
      if (isNew && plot.status === 'data_entry') {
        await store.bumpPlotToTreeSurvey(plotId);
      }
      res.json(saved);
    } catch (err) { next(err); }
  });

  app.delete('/api/trees/:id', async (req, res, next) => {
    try {
      await store.deleteTree(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  app.get('/api/admin/users', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      const users = await store.listUsers();
      res.json(users.map(u => ({
        id: u.id, email: u.email, phone: u.phone, name: u.name,
        role: u.role, managedCommunityEnterpriseId: u.managedCommunityEnterpriseId,
        createdAt: u.createdAt
      })));
    } catch (err) { next(err); }
  });

  app.post('/api/admin/users', requireAdmin, async (req, res, next) => {
    try {
      const email = (req.body && req.body.email || '').trim().toLowerCase() || null;
      const phone = normalizePhone(req.body && req.body.phone) || null;
      const password = (req.body && req.body.password) || '';
      const role = VALID_ROLES.includes(req.body && req.body.role) ? req.body.role : 'admin';
      const managedCommunityEnterpriseId = role === 'enterprise_admin'
        ? ((req.body && req.body.managedCommunityEnterpriseId) || null) : null;
      if (role === 'enterprise_admin') {
        if (!managedCommunityEnterpriseId) return res.status(400).json({ error: 'managedCommunityEnterpriseId is required for enterprise_admin role' });
        const ce = await store.listCommunityEnterprises();
        if (!ce.some(e => e.id === managedCommunityEnterpriseId)) return res.status(404).json({ error: 'community enterprise not found' });
      }
      const result = await createAccount(email, phone, password, { role, managedCommunityEnterpriseId });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(201).json({
        id: result.user.id, email: result.user.email, phone: result.user.phone,
        role: result.user.role, managedCommunityEnterpriseId: result.user.managedCommunityEnterpriseId,
        createdAt: result.user.createdAt
      });
    } catch (err) { next(err); }
  });

  app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res, next) => {
    try {
      const role = req.body && req.body.role;
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' });
      const managedCommunityEnterpriseId = role === 'enterprise_admin'
        ? ((req.body && req.body.managedCommunityEnterpriseId) || null) : null;
      if (role === 'enterprise_admin') {
        if (!managedCommunityEnterpriseId) return res.status(400).json({ error: 'managedCommunityEnterpriseId is required for enterprise_admin role' });
        const ce = await store.listCommunityEnterprises();
        if (!ce.some(e => e.id === managedCommunityEnterpriseId)) return res.status(404).json({ error: 'community enterprise not found' });
      }
      const user = await store.updateUserRole(req.params.id, role, managedCommunityEnterpriseId);
      if (!user) return res.status(404).json({ error: 'user not found' });
      res.json({
        id: user.id, email: user.email, phone: user.phone,
        role: user.role, managedCommunityEnterpriseId: user.managedCommunityEnterpriseId
      });
    } catch (err) { next(err); }
  });

  app.patch('/api/admin/users/:id', requireAdmin, async (req, res, next) => {
    try {
      const target = await store.findUserById(req.params.id);
      if (!target) return res.status(404).json({ error: 'user not found' });
      const name = (req.body && req.body.name || '').trim() || null;
      const email = (req.body && req.body.email || '').trim().toLowerCase() || null;
      const phone = normalizePhone(req.body && req.body.phone) || null;
      if (!email && !phone) return res.status(400).json({ error: 'must provide an email or phone number' });
      if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });
      if (phone && !PHONE_RE.test(phone)) return res.status(400).json({ error: 'invalid phone number (must be 10 digits starting with 0)' });
      if (email) {
        const existing = await store.findUserByEmail(email);
        if (existing && existing.id !== target.id) return res.status(409).json({ error: 'an account with this email already exists' });
      }
      if (phone) {
        const existing = await store.findUserByPhone(phone);
        if (existing && existing.id !== target.id) return res.status(409).json({ error: 'an account with this phone number already exists' });
      }
      const user = await store.updateUserProfile(req.params.id, { name, email, phone });
      res.json({
        id: user.id, email: user.email, phone: user.phone, name: user.name,
        role: user.role, managedCommunityEnterpriseId: user.managedCommunityEnterpriseId
      });
    } catch (err) { next(err); }
  });

  app.patch('/api/admin/users/:id/password', requireAdmin, async (req, res, next) => {
    try {
      const password = (req.body && req.body.password) || '';
      if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
      const passwordHash = await hashPassword(password);
      const user = await store.updateUserPassword(req.params.id, passwordHash);
      if (!user) return res.status(404).json({ error: 'user not found' });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  function isOwnCommunityEnterprise(req, id) {
    return req.user.role === 'admin' || req.user.managedCommunityEnterpriseId === id;
  }

  app.get('/api/admin/community-enterprises', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      let entities = await store.listCommunityEnterprises();
      if (req.user.role === 'enterprise_admin') {
        entities = entities.filter(e => e.id === req.user.managedCommunityEnterpriseId);
      }
      const withMembers = await Promise.all(entities.map(async e => ({
        ...e,
        members: (await store.listCommunityEnterpriseMembers(e.id)).map(u => ({ id: u.id, email: u.email, phone: u.phone }))
      })));
      res.json(withMembers);
    } catch (err) { next(err); }
  });

  app.put('/api/admin/community-enterprises/:id', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      if (!isOwnCommunityEnterprise(req, req.params.id)) return res.status(403).json({ error: 'forbidden' });
      const name = (req.body && req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      const entity = { ...req.body, id: req.params.id, name };
      res.json(await store.upsertCommunityEnterprise(entity));
    } catch (err) { next(err); }
  });

  app.delete('/api/admin/community-enterprises/:id', requireAdmin, async (req, res, next) => {
    try {
      const memberCount = await store.countCommunityEnterpriseMembers(req.params.id);
      if (memberCount > 0) {
        return res.status(409).json({ error: 'ยังมีสมาชิกอยู่ในกลุ่ม ต้องนำสมาชิกออกให้หมดก่อนจึงจะลบได้' });
      }
      await store.deleteCommunityEnterprise(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  app.post('/api/admin/community-enterprises/:id/members', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      if (!isOwnCommunityEnterprise(req, req.params.id)) return res.status(403).json({ error: 'forbidden' });
      const userId = req.body && req.body.userId;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const user = await store.findUserById(userId);
      if (!user) return res.status(404).json({ error: 'user not found' });
      await store.addCommunityEnterpriseMember(req.params.id, userId);
      const members = await store.listCommunityEnterpriseMembers(req.params.id);
      res.status(201).json(members.map(u => ({ id: u.id, email: u.email, phone: u.phone })));
    } catch (err) { next(err); }
  });

  app.delete('/api/admin/community-enterprises/:id/members/:userId', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      if (!isOwnCommunityEnterprise(req, req.params.id)) return res.status(403).json({ error: 'forbidden' });
      await store.removeCommunityEnterpriseMember(req.params.id, req.params.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // Approving a plot's join request finalizes the plots.community_enterprise_status
  // ('pending' -> 'approved') and, since a field worker only ever earns membership
  // by having a matching-purpose plot approved, grants the plot's owner CE membership
  // in the same step. The admin's own "link an existing plot directly" action reuses
  // this endpoint too (called right after the plain PUT that lands it as pending) so
  // both paths funnel through one place that grants membership.
  app.patch('/api/admin/community-enterprises/:id/plots/:plotId/approve', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      if (!isOwnCommunityEnterprise(req, req.params.id)) return res.status(403).json({ error: 'forbidden' });
      const plot = await store.findPlotById(req.params.plotId);
      if (!plot) return res.status(404).json({ error: 'plot not found' });
      if (plot.communityEnterpriseId !== req.params.id) {
        return res.status(409).json({ error: 'แปลงนี้ไม่ได้ขอเข้าร่วมกลุ่มนี้' });
      }
      await store.upsertPlot({ ...plot, communityEnterpriseStatus: 'approved' });
      if (plot.createdBy) {
        await store.addCommunityEnterpriseMember(req.params.id, plot.createdBy);
      }
      const members = await store.listCommunityEnterpriseMembers(req.params.id);
      res.json({
        plot: await store.findPlotById(req.params.plotId),
        members: members.map(u => ({ id: u.id, email: u.email, phone: u.phone }))
      });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/purposes', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      res.json(await store.listPurposes());
    } catch (err) { next(err); }
  });

  app.post('/api/admin/purposes', requireAdmin, async (req, res, next) => {
    try {
      const name = (req.body && req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      const purpose = await store.upsertPurpose({ id: crypto.randomUUID(), name });
      res.status(201).json(purpose);
    } catch (err) { next(err); }
  });

  app.put('/api/admin/purposes/:id', requireAdmin, async (req, res, next) => {
    try {
      const name = (req.body && req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      const purpose = await store.upsertPurpose({ id: req.params.id, name });
      res.json(purpose);
    } catch (err) { next(err); }
  });

  app.delete('/api/admin/purposes/:id', requireAdmin, async (req, res, next) => {
    try {
      await store.deletePurpose(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  function scopePlotsForUser(req, plots) {
    if (req.user.role !== 'enterprise_admin') return plots;
    return plots.filter(p => p.communityEnterpriseId === req.user.managedCommunityEnterpriseId);
  }

  function canManagePlot(req, plot) {
    return req.user.role === 'admin' || plot.communityEnterpriseId === req.user.managedCommunityEnterpriseId;
  }

  app.patch('/api/admin/plots/:id/status', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      const plot = await store.findPlotById(req.params.id);
      if (!plot) return res.status(404).json({ error: 'plot not found' });
      if (!canManagePlot(req, plot)) return res.status(403).json({ error: 'forbidden' });
      const status = req.body && req.body.status;
      if (!PLOT_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
      const note = (req.body && req.body.note || '').trim();
      if (!note) return res.status(400).json({ error: 'note is required' });
      const photos = Array.isArray(req.body && req.body.photos) ? req.body.photos : [];
      const updated = await store.updatePlotStatus(req.params.id, status, note, photos);
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/export/plots.csv', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      const plots = scopePlotsForUser(req, await store.listPlots());
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="plots.csv"');
      res.send('﻿' + plotsToCSV(plots));
    } catch (err) { next(err); }
  });

  app.get('/api/admin/export/trees.csv', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      const [allPlots, allTrees] = await Promise.all([store.listPlots(), store.listTrees()]);
      const plots = scopePlotsForUser(req, allPlots);
      const plotIds = new Set(plots.map(p => p.id));
      const trees = req.user.role === 'enterprise_admin' ? allTrees.filter(t => plotIds.has(t.plotId)) : allTrees;
      const plotsById = new Map(plots.map(p => [p.id, p]));
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="trees.csv"');
      res.send('﻿' + treesToCSV(trees, plotsById));
    } catch (err) { next(err); }
  });

  app.get('/api/admin/export/geojson', requireAdminOrEnterpriseAdmin, async (req, res, next) => {
    try {
      const [allPlots, allTrees] = await Promise.all([store.listPlots(), store.listTrees()]);
      const plots = scopePlotsForUser(req, allPlots);
      const plotIds = new Set(plots.map(p => p.id));
      const trees = req.user.role === 'enterprise_admin' ? allTrees.filter(t => plotIds.has(t.plotId)) : allTrees;
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
