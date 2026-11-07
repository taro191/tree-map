// MariaDB / MySQL implementation of the store interface (same functions as server/db.js).
// Selected by server.js when DATABASE_URL starts with mysql:// (Plesk/hostatom has no Postgres).
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { plotRowToObj, treeRowToObj, userRowToObj, communityEnterpriseRowToObj, purposeRowToObj } = require('./rows');

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function createMysqlStore(connectionString) {
  const pool = mysql.createPool({
    uri: connectionString,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: ['DATE'],
    connectionLimit: 5,
    waitForConnections: true
  });
  // Store and read DATETIME values as UTC so ordering/serialization match the Postgres store.
  pool.pool.on('connection', conn => { conn.query("SET time_zone = '+00:00'"); });

  async function q(sql, params) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async function initSchema() {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.mysql.sql'), 'utf8');
    const statements = sql
      .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
      .split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) await q(stmt);
  }

  const plotFromRow = row => plotRowToObj({
    ...row,
    boundary: parseJson(row.boundary, []),
    ref_photos: parseJson(row.ref_photos, []),
    review_photos: parseJson(row.review_photos, [])
  });

  async function selectOne(table, id, mapper) {
    const rows = await q(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return rows[0] ? mapper(rows[0]) : null;
  }

  async function listPlots() {
    return (await q('SELECT * FROM plots ORDER BY created_at ASC')).map(plotFromRow);
  }

  async function upsertPlot(plot) {
    // created_by / status / review_* are deliberately NOT in the UPDATE list (immutable via this path).
    await q(
      `INSERT INTO plots (id, name, owner_name, owner_contact, doc_title, area_rai, area_ngan, area_wa, subdistrict, district, province, postcode, color, boundary, photo, doc_photo, community_enterprise_id, community_enterprise_status, purpose_id, ref_lat, ref_lng, ref_description, ref_photos, created_by, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), owner_name=VALUES(owner_name), owner_contact=VALUES(owner_contact),
         doc_title=VALUES(doc_title), area_rai=VALUES(area_rai), area_ngan=VALUES(area_ngan),
         area_wa=VALUES(area_wa), subdistrict=VALUES(subdistrict), district=VALUES(district), province=VALUES(province),
         postcode=VALUES(postcode), color=VALUES(color), boundary=VALUES(boundary),
         photo=VALUES(photo), doc_photo=VALUES(doc_photo), community_enterprise_id=VALUES(community_enterprise_id),
         community_enterprise_status=VALUES(community_enterprise_status),
         purpose_id=VALUES(purpose_id),
         ref_lat=VALUES(ref_lat), ref_lng=VALUES(ref_lng),
         ref_description=VALUES(ref_description), ref_photos=VALUES(ref_photos)`,
      [plot.id, plot.name, plot.ownerName || null, plot.ownerContact || null, plot.docTitle || null,
       plot.areaRai || null, plot.areaNgan || null, plot.areaWa || null, plot.subdistrict || null,
       plot.district || null, plot.province || null, plot.postcode || null, plot.color || null,
       JSON.stringify(plot.boundary || []), plot.photo || null, plot.docPhoto || null,
       plot.communityEnterpriseId || null, plot.communityEnterpriseStatus || null, plot.purposeId || null,
       plot.refPoint ? plot.refPoint.lat : null, plot.refPoint ? plot.refPoint.lng : null,
       plot.refPoint ? (plot.refPoint.description || null) : null,
       JSON.stringify(plot.refPoint ? (plot.refPoint.photos || []) : []),
       plot.createdBy || null, plot.status || 'data_entry']
    );
    return selectOne('plots', plot.id, plotFromRow);
  }

  const findPlotById = id => selectOne('plots', id, plotFromRow);

  async function updatePlotStatus(id, status, note, photos) {
    await q('UPDATE plots SET status = ?, review_note = ?, review_photos = ? WHERE id = ?',
      [status, note || null, JSON.stringify(photos || []), id]);
    return findPlotById(id);
  }

  async function bumpPlotToTreeSurvey(id) {
    await q(`UPDATE plots SET status = 'tree_survey' WHERE id = ? AND status = 'data_entry'`, [id]);
  }

  async function deletePlot(id) { await q('DELETE FROM plots WHERE id = ?', [id]); }

  async function listTrees() {
    return (await q('SELECT * FROM trees ORDER BY created_at ASC')).map(treeRowToObj);
  }

  const findTreeById = id => selectOne('trees', id, treeRowToObj);

  async function upsertTree(tree) {
    await q(
      `INSERT INTO trees (id, plot_id, seq, name, photo_url, code, code_photo, note, lat, lng)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         plot_id=VALUES(plot_id), seq=VALUES(seq), name=VALUES(name),
         photo_url=VALUES(photo_url), code=VALUES(code), code_photo=VALUES(code_photo),
         note=VALUES(note), lat=VALUES(lat), lng=VALUES(lng)`,
      [tree.id, tree.plotId, tree.seq, tree.name || null, tree.photoUrl || null,
       tree.code || null, tree.codePhoto || null, tree.note || null, tree.lat, tree.lng]
    );
    return findTreeById(tree.id);
  }

  async function deleteTree(id) { await q('DELETE FROM trees WHERE id = ?', [id]); }

  const findUserById = id => selectOne('users', id, userRowToObj);

  async function createUser(id, email, phone, passwordHash, extra) {
    extra = extra || {};
    await q(
      `INSERT INTO users (id, email, phone, password_hash, name, national_id, dob, role, managed_community_enterprise_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, email || null, phone || null, passwordHash, extra.name || null, extra.nationalId || null,
       extra.dob || null, extra.role || 'admin', extra.managedCommunityEnterpriseId || null]
    );
    return findUserById(id);
  }

  async function updateUserRole(id, role, managedCommunityEnterpriseId) {
    await q('UPDATE users SET role = ?, managed_community_enterprise_id = ? WHERE id = ?',
      [role, managedCommunityEnterpriseId || null, id]);
    return findUserById(id);
  }

  async function updateUserProfile(id, { name, email, phone }) {
    await q('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name || null, email || null, phone || null, id]);
    return findUserById(id);
  }

  async function updateUserPassword(id, passwordHash) {
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    return findUserById(id);
  }

  async function findUserBy(column, value) {
    const rows = await q(`SELECT * FROM users WHERE ${column} = ?`, [value]);
    return rows[0] ? userRowToObj(rows[0]) : null;
  }
  const findUserByEmail = email => findUserBy('email', email);
  const findUserByPhone = phone => findUserBy('phone', phone);
  const findUserByNationalId = nationalId => findUserBy('national_id', nationalId);

  async function listUsers() {
    return (await q('SELECT * FROM users ORDER BY created_at ASC')).map(userRowToObj);
  }

  async function listCommunityEnterprises() {
    return (await q('SELECT * FROM community_enterprises ORDER BY created_at ASC')).map(communityEnterpriseRowToObj);
  }

  const findCommunityEnterpriseById = id => selectOne('community_enterprises', id, communityEnterpriseRowToObj);

  async function upsertCommunityEnterprise(entity) {
    await q(
      `INSERT INTO community_enterprises (id, name, registration_no, district, province, postcode, registered_date, chairperson, contact_phone, purpose, purpose_id, max_plot_area_rai, document_photo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), registration_no=VALUES(registration_no), district=VALUES(district),
         province=VALUES(province), postcode=VALUES(postcode), registered_date=VALUES(registered_date),
         chairperson=VALUES(chairperson), contact_phone=VALUES(contact_phone), purpose=VALUES(purpose),
         purpose_id=VALUES(purpose_id), max_plot_area_rai=VALUES(max_plot_area_rai), document_photo=VALUES(document_photo)`,
      [entity.id, entity.name, entity.registrationNo || null, entity.district || null, entity.province || null,
       entity.postcode || null, entity.registeredDate ? String(entity.registeredDate).slice(0, 10) : null,
       entity.chairperson || null, entity.contactPhone || null, entity.purpose || null, entity.purposeId || null,
       entity.maxPlotAreaRai != null && entity.maxPlotAreaRai !== '' ? Number(entity.maxPlotAreaRai) : null,
       entity.documentPhoto || null]
    );
    return findCommunityEnterpriseById(entity.id);
  }

  async function deleteCommunityEnterprise(id) { await q('DELETE FROM community_enterprises WHERE id = ?', [id]); }

  async function countCommunityEnterpriseMembers(id) {
    const rows = await q('SELECT COUNT(*) AS count FROM community_enterprise_members WHERE community_enterprise_id = ?', [id]);
    return Number(rows[0].count);
  }

  async function listCommunityEnterpriseMembers(id) {
    const rows = await q(
      `SELECT u.* FROM community_enterprise_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.community_enterprise_id = ?
       ORDER BY m.joined_at ASC`, [id]);
    return rows.map(userRowToObj);
  }

  async function addCommunityEnterpriseMember(entityId, userId) {
    await q('INSERT IGNORE INTO community_enterprise_members (community_enterprise_id, user_id) VALUES (?,?)', [entityId, userId]);
  }

  async function removeCommunityEnterpriseMember(entityId, userId) {
    await q('DELETE FROM community_enterprise_members WHERE community_enterprise_id = ? AND user_id = ?', [entityId, userId]);
  }

  async function listPurposes() {
    return (await q('SELECT * FROM purposes ORDER BY name ASC')).map(purposeRowToObj);
  }

  async function upsertPurpose(purpose) {
    await q('INSERT INTO purposes (id, name) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [purpose.id, purpose.name]);
    return selectOne('purposes', purpose.id, purposeRowToObj);
  }

  async function deletePurpose(id) { await q('DELETE FROM purposes WHERE id = ?', [id]); }

  return {
    pool, initSchema, listPlots, upsertPlot, deletePlot, findPlotById, updatePlotStatus, bumpPlotToTreeSurvey,
    listTrees, upsertTree, deleteTree, findTreeById,
    createUser, updateUserRole, updateUserProfile, updateUserPassword,
    findUserByEmail, findUserByPhone, findUserByNationalId, findUserById, listUsers,
    listCommunityEnterprises, upsertCommunityEnterprise, deleteCommunityEnterprise, findCommunityEnterpriseById,
    countCommunityEnterpriseMembers, listCommunityEnterpriseMembers,
    addCommunityEnterpriseMember, removeCommunityEnterpriseMember,
    listPurposes, upsertPurpose, deletePurpose
  };
}

module.exports = { createMysqlStore };
