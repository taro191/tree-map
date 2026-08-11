const express = require('express');
const path = require('path');

function createApp(store) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const rootDir = path.join(__dirname, '..');
  app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));

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

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp };
