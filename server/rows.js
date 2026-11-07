// Row (snake_case) -> API object (camelCase) mappers shared by the Postgres and MySQL stores.

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
    communityEnterpriseStatus: row.community_enterprise_status,
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

function userRowToObj(row) {
  return {
    id: row.id, email: row.email, phone: row.phone, passwordHash: row.password_hash,
    name: row.name, nationalId: row.national_id, dob: row.dob,
    role: row.role, managedCommunityEnterpriseId: row.managed_community_enterprise_id,
    createdAt: row.created_at
  };
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
    maxPlotAreaRai: row.max_plot_area_rai != null ? Number(row.max_plot_area_rai) : null,
    documentPhoto: row.document_photo,
    createdAt: row.created_at
  };
}

function purposeRowToObj(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

module.exports = { plotRowToObj, treeRowToObj, userRowToObj, communityEnterpriseRowToObj, purposeRowToObj };
