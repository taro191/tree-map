import { useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';

const PATH_LINE_COLOR = '#2563EB';

const refFlagIcon = L.divIcon({
  className: '',
  html: `<div class="ref-flag-pin"><div class="pole"></div><div class="flag-tri"></div></div>`,
  iconSize: [16, 20], iconAnchor: [2.5, 17]
});

function plotPathLatLngs(plot, plotTrees) {
  const points = [];
  if (plot.refPoint) points.push([plot.refPoint.lat, plot.refPoint.lng]);
  plotTrees.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0)).forEach(t => points.push([t.lat, t.lng]));
  return points;
}

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
    plots.forEach(p => {
      (p.boundary || []).forEach(pt => pts.push([pt.lat, pt.lng]));
      if (p.refPoint) pts.push([p.refPoint.lat, p.refPoint.lng]);
    });
    trees.forEach(t => pts.push([t.lat, t.lng]));
    return pts.length ? pts : null;
  }, [plots, trees]);

  return (
    <MapContainer center={[13.7563, 100.5018]} zoom={6} className="h-full w-full">
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
      {plots.map(p => {
        const path = plotPathLatLngs(p, trees.filter(t => t.plotId === p.id));
        return path.length >= 2 ? (
          <Polyline
            key={`path-${p.id}`}
            positions={path}
            pathOptions={{ color: PATH_LINE_COLOR, weight: 3, opacity: 0.9, dashArray: '6,6' }}
          />
        ) : null;
      })}
      {plots.filter(p => p.refPoint).map(p => (
        <Marker key={`ref-${p.id}`} position={[p.refPoint.lat, p.refPoint.lng]} icon={refFlagIcon}>
          <Tooltip>{`🚩 จุดอ้างอิง: ${p.name}`}</Tooltip>
        </Marker>
      ))}
      {trees.map(t => (
        <CircleMarker
          key={t.id}
          center={[t.lat, t.lng]}
          radius={1.25}
          pathOptions={{ color: '#A6612E', fillColor: '#A6612E', fillOpacity: 0.9 }}
        >
          <Tooltip>{`ต้นที่ ${t.seq}${t.name ? ' · ' + t.name : ''}`}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
