const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function createPgStore(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: connectionString && connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  async function initSchema() {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await pool.query(sql);
  }

  function plotRowToObj(row) {
    return {
      id: row.id,
      name: row.name,
      ownerName: row.owner_name,
      ownerContact: row.owner_contact,
      docTitle: row.doc_title,
      areaRai: row.area_rai,
      areaNgan: row.area_ngan,
      areaWa: row.area_wa,
      district: row.district,
      province: row.province,
      postcode: row.postcode,
      color: row.color,
      boundary: row.boundary || [],
      photo: row.photo,
      docPhoto: row.doc_photo
    };
  }

  function treeRowToObj(row) {
    return {
      id: row.id,
      plotId: row.plot_id,
      seq: row.seq,
      name: row.name,
      photoUrl: row.photo_url,
      note: row.note,
      lat: Number(row.lat),
      lng: Number(row.lng)
    };
  }

  async function listPlots() {
    const { rows } = await pool.query('SELECT * FROM plots ORDER BY created_at ASC');
    return rows.map(plotRowToObj);
  }

  async function upsertPlot(plot) {
    const { rows } = await pool.query(
      `INSERT INTO plots (id, name, owner_name, owner_contact, doc_title, area_rai, area_ngan, area_wa, district, province, postcode, color, boundary, photo, doc_photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, owner_name=EXCLUDED.owner_name, owner_contact=EXCLUDED.owner_contact,
         doc_title=EXCLUDED.doc_title, area_rai=EXCLUDED.area_rai, area_ngan=EXCLUDED.area_ngan,
         area_wa=EXCLUDED.area_wa, district=EXCLUDED.district, province=EXCLUDED.province,
         postcode=EXCLUDED.postcode, color=EXCLUDED.color, boundary=EXCLUDED.boundary,
         photo=EXCLUDED.photo, doc_photo=EXCLUDED.doc_photo
       RETURNING *`,
      [plot.id, plot.name, plot.ownerName || null, plot.ownerContact || null, plot.docTitle || null,
       plot.areaRai || null, plot.areaNgan || null, plot.areaWa || null, plot.district || null,
       plot.province || null, plot.postcode || null, plot.color || null,
       JSON.stringify(plot.boundary || []), plot.photo || null, plot.docPhoto || null]
    );
    return plotRowToObj(rows[0]);
  }

  async function deletePlot(id) {
    await pool.query('DELETE FROM plots WHERE id = $1', [id]);
  }

  async function listTrees() {
    const { rows } = await pool.query('SELECT * FROM trees ORDER BY created_at ASC');
    return rows.map(treeRowToObj);
  }

  async function upsertTree(tree) {
    const { rows } = await pool.query(
      `INSERT INTO trees (id, plot_id, seq, name, photo_url, note, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         plot_id=EXCLUDED.plot_id, seq=EXCLUDED.seq, name=EXCLUDED.name,
         photo_url=EXCLUDED.photo_url, note=EXCLUDED.note, lat=EXCLUDED.lat, lng=EXCLUDED.lng
       RETURNING *`,
      [tree.id, tree.plotId, tree.seq, tree.name || null, tree.photoUrl || null, tree.note || null, tree.lat, tree.lng]
    );
    return treeRowToObj(rows[0]);
  }

  async function deleteTree(id) {
    await pool.query('DELETE FROM trees WHERE id = $1', [id]);
  }

  function userRowToObj(row) {
    return { id: row.id, email: row.email, passwordHash: row.password_hash, createdAt: row.created_at };
  }

  async function createUser(id, email, passwordHash) {
    const { rows } = await pool.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1,$2,$3) RETURNING *',
      [id, email, passwordHash]
    );
    return userRowToObj(rows[0]);
  }

  async function findUserByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function findUserById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function listUsers() {
    const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(userRowToObj);
  }

  return {
    pool, initSchema, listPlots, upsertPlot, deletePlot, listTrees, upsertTree, deleteTree,
    createUser, findUserByEmail, findUserById, listUsers
  };
}

module.exports = { createPgStore };
