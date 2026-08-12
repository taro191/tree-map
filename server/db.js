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
      docPhoto: row.doc_photo,
      communityEnterpriseId: row.community_enterprise_id
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
      `INSERT INTO plots (id, name, owner_name, owner_contact, doc_title, area_rai, area_ngan, area_wa, district, province, postcode, color, boundary, photo, doc_photo, community_enterprise_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, owner_name=EXCLUDED.owner_name, owner_contact=EXCLUDED.owner_contact,
         doc_title=EXCLUDED.doc_title, area_rai=EXCLUDED.area_rai, area_ngan=EXCLUDED.area_ngan,
         area_wa=EXCLUDED.area_wa, district=EXCLUDED.district, province=EXCLUDED.province,
         postcode=EXCLUDED.postcode, color=EXCLUDED.color, boundary=EXCLUDED.boundary,
         photo=EXCLUDED.photo, doc_photo=EXCLUDED.doc_photo, community_enterprise_id=EXCLUDED.community_enterprise_id
       RETURNING *`,
      [plot.id, plot.name, plot.ownerName || null, plot.ownerContact || null, plot.docTitle || null,
       plot.areaRai || null, plot.areaNgan || null, plot.areaWa || null, plot.district || null,
       plot.province || null, plot.postcode || null, plot.color || null,
       JSON.stringify(plot.boundary || []), plot.photo || null, plot.docPhoto || null,
       plot.communityEnterpriseId || null]
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
    return { id: row.id, email: row.email, phone: row.phone, passwordHash: row.password_hash, createdAt: row.created_at };
  }

  async function createUser(id, email, phone, passwordHash) {
    const { rows } = await pool.query(
      'INSERT INTO users (id, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, email || null, phone || null, passwordHash]
    );
    return userRowToObj(rows[0]);
  }

  async function findUserByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function findUserByPhone(phone) {
    const { rows } = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
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

  function communityEnterpriseRowToObj(row) {
    return {
      id: row.id,
      name: row.name,
      registrationNo: row.registration_no,
      district: row.district,
      province: row.province,
      postcode: row.postcode,
      registeredDate: row.registered_date,
      chairperson: row.chairperson,
      contactPhone: row.contact_phone,
      purpose: row.purpose,
      documentPhoto: row.document_photo,
      createdAt: row.created_at
    };
  }

  async function listCommunityEnterprises() {
    const { rows } = await pool.query('SELECT * FROM community_enterprises ORDER BY created_at ASC');
    return rows.map(communityEnterpriseRowToObj);
  }

  async function upsertCommunityEnterprise(entity) {
    const { rows } = await pool.query(
      `INSERT INTO community_enterprises (id, name, registration_no, district, province, postcode, registered_date, chairperson, contact_phone, purpose, document_photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, registration_no=EXCLUDED.registration_no, district=EXCLUDED.district,
         province=EXCLUDED.province, postcode=EXCLUDED.postcode, registered_date=EXCLUDED.registered_date,
         chairperson=EXCLUDED.chairperson, contact_phone=EXCLUDED.contact_phone, purpose=EXCLUDED.purpose,
         document_photo=EXCLUDED.document_photo
       RETURNING *`,
      [entity.id, entity.name, entity.registrationNo || null, entity.district || null, entity.province || null,
       entity.postcode || null, entity.registeredDate || null, entity.chairperson || null,
       entity.contactPhone || null, entity.purpose || null, entity.documentPhoto || null]
    );
    return communityEnterpriseRowToObj(rows[0]);
  }

  async function deleteCommunityEnterprise(id) {
    await pool.query('DELETE FROM community_enterprises WHERE id = $1', [id]);
  }

  async function countCommunityEnterpriseMembers(id) {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM community_enterprise_members WHERE community_enterprise_id = $1', [id]
    );
    return rows[0].count;
  }

  async function listCommunityEnterpriseMembers(id) {
    const { rows } = await pool.query(
      `SELECT u.* FROM community_enterprise_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.community_enterprise_id = $1
       ORDER BY m.joined_at ASC`,
      [id]
    );
    return rows.map(userRowToObj);
  }

  async function addCommunityEnterpriseMember(entityId, userId) {
    await pool.query(
      `INSERT INTO community_enterprise_members (community_enterprise_id, user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [entityId, userId]
    );
  }

  async function removeCommunityEnterpriseMember(entityId, userId) {
    await pool.query(
      'DELETE FROM community_enterprise_members WHERE community_enterprise_id = $1 AND user_id = $2',
      [entityId, userId]
    );
  }

  return {
    pool, initSchema, listPlots, upsertPlot, deletePlot, listTrees, upsertTree, deleteTree,
    createUser, findUserByEmail, findUserByPhone, findUserById, listUsers,
    listCommunityEnterprises, upsertCommunityEnterprise, deleteCommunityEnterprise,
    countCommunityEnterpriseMembers, listCommunityEnterpriseMembers,
    addCommunityEnterpriseMember, removeCommunityEnterpriseMember
  };
}

module.exports = { createPgStore };
