function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCSV(rows, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(',');
  const lines = rows.map(row => columns.map(c => csvEscape(c.get(row))).join(','));
  return [header, ...lines].join('\r\n');
}

function plotsToCSV(plots) {
  return toCSV(plots, [
    { label: 'id', get: p => p.id },
    { label: 'name', get: p => p.name },
    { label: 'status', get: p => p.status },
    { label: 'ownerName', get: p => p.ownerName },
    { label: 'ownerContact', get: p => p.ownerContact },
    { label: 'docTitle', get: p => p.docTitle },
    { label: 'areaRai', get: p => p.areaRai },
    { label: 'areaNgan', get: p => p.areaNgan },
    { label: 'areaWa', get: p => p.areaWa },
    { label: 'district', get: p => p.district },
    { label: 'province', get: p => p.province },
    { label: 'postcode', get: p => p.postcode },
    { label: 'boundaryPointCount', get: p => (p.boundary || []).length },
    { label: 'refLat', get: p => p.refPoint ? p.refPoint.lat : '' },
    { label: 'refLng', get: p => p.refPoint ? p.refPoint.lng : '' },
    { label: 'refDescription', get: p => p.refPoint ? p.refPoint.description : '' }
  ]);
}

function treesToCSV(trees, plotsById) {
  return toCSV(trees, [
    { label: 'id', get: t => t.id },
    { label: 'plotId', get: t => t.plotId },
    { label: 'plotName', get: t => (plotsById.get(t.plotId) || {}).name },
    { label: 'seq', get: t => t.seq },
    { label: 'name', get: t => t.name },
    { label: 'code', get: t => t.code },
    { label: 'note', get: t => t.note },
    { label: 'lat', get: t => t.lat },
    { label: 'lng', get: t => t.lng }
  ]);
}

function closedRing(boundary) {
  const coords = boundary.map(pt => [pt.lng, pt.lat]);
  if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  return coords;
}

function toGeoJSON(plots, trees) {
  const features = [];
  plots.forEach(p => {
    if (p.boundary && p.boundary.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [closedRing(p.boundary)] },
        properties: {
          id: p.id, name: p.name, ownerName: p.ownerName, ownerContact: p.ownerContact,
          docTitle: p.docTitle, areaRai: p.areaRai, areaNgan: p.areaNgan, areaWa: p.areaWa,
          district: p.district, province: p.province, postcode: p.postcode
        }
      });
    }
    if (p.refPoint) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.refPoint.lng, p.refPoint.lat] },
        properties: { id: p.id + '-ref', plotId: p.id, type: 'referencePoint', description: p.refPoint.description }
      });
    }
  });
  trees.forEach(t => {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: { id: t.id, plotId: t.plotId, seq: t.seq, name: t.name, code: t.code, note: t.note }
    });
  });
  return { type: 'FeatureCollection', features };
}

module.exports = { plotsToCSV, treesToCSV, toGeoJSON };
