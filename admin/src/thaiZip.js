let thaiZipIndex = null;
let thaiZipLoading = null;

// Same index shape/source as index.html's loadThaiZipIndex(), minus the subdistrict level --
// community enterprises only track district/province, not subdistrict.
export function loadThaiZipIndex() {
  if (thaiZipIndex) return Promise.resolve(thaiZipIndex);
  if (thaiZipLoading) return thaiZipLoading;
  const base = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/';
  thaiZipLoading = Promise.all([
    fetch(base + 'sub_district.json').then(r => r.json()),
    fetch(base + 'district.json').then(r => r.json()),
    fetch(base + 'province.json').then(r => r.json())
  ]).then(([subs, districts, provinces]) => {
    const provinceById = new Map(provinces.map(p => [p.id, p.name_th]));
    const districtById = new Map(districts.map(d => [d.id, { name: d.name_th, provinceId: d.province_id }]));
    const idx = new Map();
    subs.forEach(s => {
      const d = districtById.get(s.district_id);
      if (!d) return;
      const province = provinceById.get(d.provinceId) || '';
      const isBangkokStyle = d.name.startsWith('เขต');
      const districtBare = d.name.replace(/^เขต/, '').replace(/^อำเภอ/, '');
      const districtDisplay = isBangkokStyle ? d.name : 'อำเภอ' + d.name;
      const zip = String(s.zip_code);
      if (!idx.has(zip)) idx.set(zip, []);
      const arr = idx.get(zip);
      if (!arr.some(x => x.districtBare === districtBare && x.province === province)) {
        arr.push({ districtBare, districtDisplay, province });
      }
    });
    thaiZipIndex = idx;
    return idx;
  }).catch(err => {
    thaiZipLoading = null;
    throw err;
  });
  return thaiZipLoading;
}
