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
      subdistrict: row.subdistrict,
      district: row.district,
      province: row.province,
      postcode: row.postcode,
      color: row.color,
      boundary: row.boundary || [],
      photo: row.photo,
      docPhoto: row.doc_photo,
      communityEnterpriseId: row.community_enterprise_id,
      purposeId: row.purpose_id,
      createdBy: row.created_by,
      status: row.status,
      reviewNote: row.review_note,
      reviewPhotos: row.review_photos || [],
      refPoint: (row.ref_lat != null && row.ref_lng != null) ? {
        lat: Number(row.ref_lat), lng: Number(row.ref_lng),
        description: row.ref_description || '',
        photos: row.ref_photos || []
      } : null
    };
  }

  function treeRowToObj(row) {
    return {
      id: row.id,
      plotId: row.plot_id,
      seq: row.seq,
      name: row.name,
      photoUrl: row.photo_url,
      code: row.code,
      codePhoto: row.code_photo,
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
      `INSERT INTO plots (id, name, owner_name, owner_contact, doc_title, area_rai, area_ngan, area_wa, subdistrict, district, province, postcode, color, boundary, photo, doc_photo, community_enterprise_id, purpose_id, ref_lat, ref_lng, ref_description, ref_photos, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, owner_name=EXCLUDED.owner_name, owner_contact=EXCLUDED.owner_contact,
         doc_title=EXCLUDED.doc_title, area_rai=EXCLUDED.area_rai, area_ngan=EXCLUDED.area_ngan,
         area_wa=EXCLUDED.area_wa, subdistrict=EXCLUDED.subdistrict, district=EXCLUDED.district, province=EXCLUDED.province,
         postcode=EXCLUDED.postcode, color=EXCLUDED.color, boundary=EXCLUDED.boundary,
         photo=EXCLUDED.photo, doc_photo=EXCLUDED.doc_photo, community_enterprise_id=EXCLUDED.community_enterprise_id,
         purpose_id=EXCLUDED.purpose_id,
         ref_lat=EXCLUDED.ref_lat, ref_lng=EXCLUDED.ref_lng,
         ref_description=EXCLUDED.ref_description, ref_photos=EXCLUDED.ref_photos
       RETURNING *`,
      [plot.id, plot.name, plot.ownerName || null, plot.ownerContact || null, plot.docTitle || null,
       plot.areaRai || null, plot.areaNgan || null, plot.areaWa || null, plot.subdistrict || null,
       plot.district || null, plot.province || null, plot.postcode || null, plot.color || null,
       JSON.stringify(plot.boundary || []), plot.photo || null, plot.docPhoto || null,
       plot.communityEnterpriseId || null, plot.purposeId || null,
       plot.refPoint ? plot.refPoint.lat : null, plot.refPoint ? plot.refPoint.lng : null,
       plot.refPoint ? (plot.refPoint.description || null) : null,
       JSON.stringify(plot.refPoint ? (plot.refPoint.photos || []) : []),
       plot.createdBy || null, plot.status || 'data_entry']
    );
    return plotRowToObj(rows[0]);
  }

  async function findPlotById(id) {
    const { rows } = await pool.query('SELECT * FROM plots WHERE id = $1', [id]);
    return rows[0] ? plotRowToObj(rows[0]) : null;
  }

  async function updatePlotStatus(id, status, note, photos) {
    const { rows } = await pool.query(
      'UPDATE plots SET status = $2, review_note = $3, review_photos = $4 WHERE id = $1 RETURNING *',
      [id, status, note || null, JSON.stringify(photos || [])]
    );
    return rows[0] ? plotRowToObj(rows[0]) : null;
  }

  async function bumpPlotToTreeSurvey(id) {
    await pool.query(`UPDATE plots SET status = 'tree_survey' WHERE id = $1 AND status = 'data_entry'`, [id]);
  }

  async function findTreeById(id) {
    const { rows } = await pool.query('SELECT * FROM trees WHERE id = $1', [id]);
    return rows[0] ? treeRowToObj(rows[0]) : null;
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
      `INSERT INTO trees (id, plot_id, seq, name, photo_url, code, code_photo, note, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         plot_id=EXCLUDED.plot_id, seq=EXCLUDED.seq, name=EXCLUDED.name,
         photo_url=EXCLUDED.photo_url, code=EXCLUDED.code, code_photo=EXCLUDED.code_photo,
         note=EXCLUDED.note, lat=EXCLUDED.lat, lng=EXCLUDED.lng
       RETURNING *`,
      [tree.id, tree.plotId, tree.seq, tree.name || null, tree.photoUrl || null,
       tree.code || null, tree.codePhoto || null, tree.note || null, tree.lat, tree.lng]
    );
    return treeRowToObj(rows[0]);
  }

  async function deleteTree(id) {
    await pool.query('DELETE FROM trees WHERE id = $1', [id]);
  }

  function userRowToObj(row) {
    return {
      id: row.id, email: row.email, phone: row.phone, passwordHash: row.password_hash,
      name: row.name, nationalId: row.national_id, dob: row.dob,
      role: row.role, managedCommunityEnterpriseId: row.managed_community_enterprise_id,
      createdAt: row.created_at
    };
  }

  async function createUser(id, email, phone, passwordHash, extra) {
    extra = extra || {};
    const { rows } = await pool.query(
      `INSERT INTO users (id, email, phone, password_hash, name, national_id, dob, role, managed_community_enterprise_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, email || null, phone || null, passwordHash, extra.name || null, extra.nationalId || null,
       extra.dob || null, extra.role || 'admin', extra.managedCommunityEnterpriseId || null]
    );
    return userRowToObj(rows[0]);
  }

  async function updateUserRole(id, role, managedCommunityEnterpriseId) {
    const { rows } = await pool.query(
      'UPDATE users SET role = $2, managed_community_enterprise_id = $3 WHERE id = $1 RETURNING *',
      [id, role, managedCommunityEnterpriseId || null]
    );
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function updateUserProfile(id, { name, email, phone }) {
    const { rows } = await pool.query(
      'UPDATE users SET name = $2, email = $3, phone = $4 WHERE id = $1 RETURNING *',
      [id, name || null, email || null, phone || null]
    );
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function updateUserPassword(id, passwordHash) {
    const { rows } = await pool.query(
      'UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING *',
      [id, passwordHash]
    );
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function findUserByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function findUserByPhone(phone) {
    const { rows } = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    return rows[0] ? userRowToObj(rows[0]) : null;
  }

  async function findUserByNationalId(nationalId) {
    const { rows } = await pool.query('SELECT * FROM users WHERE national_id = $1', [nationalId]);
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
      purposeId: row.purpose_id,
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
      `INSERT INTO community_enterprises (id, name, registration_no, district, province, postcode, registered_date, chairperson, contact_phone, purpose, purpose_id, document_photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, registration_no=EXCLUDED.registration_no, district=EXCLUDED.district,
         province=EXCLUDED.province, postcode=EXCLUDED.postcode, registered_date=EXCLUDED.registered_date,
         chairperson=EXCLUDED.chairperson, contact_phone=EXCLUDED.contact_phone, purpose=EXCLUDED.purpose,
         purpose_id=EXCLUDED.purpose_id, document_photo=EXCLUDED.document_photo
       RETURNING *`,
      [entity.id, entity.name, entity.registrationNo || null, entity.district || null, entity.province || null,
       entity.postcode || null, entity.registeredDate || null, entity.chairperson || null,
       entity.contactPhone || null, entity.purpose || null, entity.purposeId || null, entity.documentPhoto || null]
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

  function purposeRowToObj(row) {
    return { id: row.id, name: row.name, createdAt: row.created_at };
  }

  async function listPurposes() {
    const { rows } = await pool.query('SELECT * FROM purposes ORDER BY name ASC');
    return rows.map(purposeRowToObj);
  }

  async function upsertPurpose(purpose) {
    const { rows } = await pool.query(
      `INSERT INTO purposes (id, name) VALUES ($1,$2)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name
       RETURNING *`,
      [purpose.id, purpose.name]
    );
    return purposeRowToObj(rows[0]);
  }

  async function deletePurpose(id) {
    await pool.query('DELETE FROM purposes WHERE id = $1', [id]);
  }

  return {
    pool, initSchema, listPlots, upsertPlot, deletePlot, findPlotById, updatePlotStatus, bumpPlotToTreeSurvey,
    listTrees, upsertTree, deleteTree, findTreeById,
    createUser, updateUserRole, updateUserProfile, updateUserPassword,
    findUserByEmail, findUserByPhone, findUserByNationalId, findUserById, listUsers,
    listCommunityEnterprises, upsertCommunityEnterprise, deleteCommunityEnterprise,
    countCommunityEnterpriseMembers, listCommunityEnterpriseMembers,
    addCommunityEnterpriseMember, removeCommunityEnterpriseMember,
    listPurposes, upsertPurpose, deletePurpose
  };
}

module.exports = { createPgStore };
