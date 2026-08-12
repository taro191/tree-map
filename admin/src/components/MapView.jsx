import { useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip, useMap } from 'react-leaflet';

function FitBounds({ bounds }) {
  const map = useMap();
  const fitted = useRef(false);
  if (bounds && !fitted.current) {
    fitted.current = true;
    map.fitBounds(bounds, { padding: [30, 30] });
  }
  return null;
}

export default function MapView({ plots, trees, selectedPlotId, onSelectPlot }) {
  const bounds = useMemo(() => {
    const pts = [];
    plots.forEach(p => (p.boundary || []).forEach(pt => pts.push([pt.lat, pt.lng])));
    trees.forEach(t => pts.push([t.lat, t.lng]));
    return pts.length ? pts : null;
  }, [plots, trees]);

  return (
    <MapContainer center={[13.7563, 100.5018]} zoom={6} className="h-full w-full rounded-xl">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {bounds && <FitBounds bounds={bounds} />}
      {plots.filter(p => p.boundary && p.boundary.length >= 3).map(p => (
        <Polygon
          key={p.id}
          positions={p.boundary.map(pt => [pt.lat, pt.lng])}
          pathOptions={{
            color: p.color || '#3D6B4A',
            weight: p.id === selectedPlotId ? 3 : 2,
            fillOpacity: p.id === selectedPlotId ? 0.25 : 0.1
          }}
          eventHandlers={{ click: () => onSelectPlot(p.id) }}
        >
          <Tooltip sticky>{p.name}</Tooltip>
        </Polygon>
      ))}
      {trees.map(t => (
        <CircleMarker
          key={t.id}
          center={[t.lat, t.lng]}
          radius={5}
          pathOptions={{ color: '#A6612E', fillColor: '#A6612E', fillOpacity: 0.9 }}
        >
          <Tooltip>{`ต้นที่ ${t.seq}${t.name ? ' · ' + t.name : ''}`}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
