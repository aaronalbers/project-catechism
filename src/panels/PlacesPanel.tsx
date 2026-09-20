import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useStore } from '@/app/store';
import { loadPlaces, loadPlacesForBook } from '@/lib/data';
import type { Place } from '@/lib/types';

// Leaflet's default marker icons don't survive bundling; draw our own.
const icon = (active: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:${active ? 16 : 11}px;height:${active ? 16 : 11}px;border-radius:50%;background:${active ? '#b23a3a' : '#7c5a2e'};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

function confidenceLabel(p: Place) {
  const c = p.confidence;
  const total = c.yes + c.likely + c.possible;
  if (!total) return 'location per OpenBible.info';
  if (c.yes >= c.likely && c.yes >= c.possible) return `identification: confident (${c.yes}/${total} sources)`;
  if (c.likely >= c.possible) return `identification: likely (${c.likely}/${total} sources)`;
  return `identification: possible (${c.possible}/${total} sources)`;
}

export function PlacesPanel() {
  const loc = useStore((s) => s.loc);
  const [all, setAll] = useState<Place[]>([]);
  const [byVerse, setByVerse] = useState<Record<string, string[]>>({});
  const [active, setActive] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => { loadPlaces().then(setAll); }, []);
  useEffect(() => { loadPlacesForBook(loc.book).then(setByVerse); }, [loc.book]);

  const placesById = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const hereIds = byVerse[`${loc.chapter}.${loc.verse}`] ?? [];
  const chapterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [k, v] of Object.entries(byVerse)) if (k.startsWith(`${loc.chapter}.`)) v.forEach((id) => ids.add(id));
    return [...ids];
  }, [byVerse, loc.chapter]);
  const here = hereIds.map((id) => placesById.get(id)).filter((p): p is Place => !!p);
  const chapter = chapterIds.map((id) => placesById.get(id)).filter((p): p is Place => !!p && !hereIds.includes(p.id));

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    map.current = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView([31.8, 35.2], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · places: <a href="https://www.openbible.info/geo/">OpenBible.info</a> CC-BY',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    const shown = [...here, ...chapter];
    const bounds: L.LatLngExpression[] = [];
    for (const p of shown) {
      const isHere = hereIds.includes(p.id);
      const mk = L.marker([p.lat, p.lon], { icon: icon(isHere || p.id === active), title: p.name }).addTo(lg);
      mk.bindPopup(`<strong>${p.name}</strong><br>${p.description}<br><small>${confidenceLabel(p)}</small>`);
      mk.on('click', () => setActive(p.id));
      if (isHere) bounds.push([p.lat, p.lon]);
    }
    setTimeout(() => m.invalidateSize(), 50);
    if (active && placesById.get(active)) { const p = placesById.get(active)!; m.flyTo([p.lat, p.lon], Math.max(m.getZoom(), 9), { duration: 0.6 }); }
    else if (bounds.length === 1) m.flyTo(bounds[0], 9, { duration: 0.6 });
    else if (bounds.length > 1) m.flyToBounds(L.latLngBounds(bounds).pad(0.3), { duration: 0.6 });
    else if (shown.length) m.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lon] as L.LatLngExpression)).pad(0.3));
  }, [here, chapter, active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActive(null); }, [loc.book, loc.chapter, loc.verse]);

  const Row = ({ p, dim }: { p: Place; dim?: boolean }) => (
    <div className="place" onClick={() => setActive(p.id)} style={dim ? { opacity: 0.75 } : undefined}>
      {p.image ? <img src={p.image.url} alt={p.image.description} loading="lazy" title={`${p.image.credit} — ${p.image.license}`} /> : <div className="noimg" />}
      <div>
        <div className="name">{p.name} <span className="chip">{p.types.join(', ')}</span></div>
        <div className="desc">{p.description}</div>
        <div className="conf">{confidenceLabel(p)} · {p.verses} verse{p.verses === 1 ? '' : 's'}{p.wikidata && <> · <a href={`https://www.wikidata.org/wiki/${p.wikidata}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Wikidata</a></>}{p.image && <> · photo: <a href={p.image.creditUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{p.image.credit}</a> ({p.image.license})</>}</div>
      </div>
    </div>
  );

  return (
    <div className="panel-body flush">
      <div className="map" ref={mapEl} role="application" aria-label="Map of places in this passage" />
      <div className="place-list">
        {here.length > 0 && <><div className="panel-title">In this verse</div>{here.map((p) => <Row key={p.id} p={p} />)}</>}
        {chapter.length > 0 && <><div className="panel-title">Elsewhere in this chapter</div>{chapter.map((p) => <Row key={p.id} p={p} dim />)}</>}
        {here.length + chapter.length === 0 && <div className="empty"><p>No identifiable places in this chapter.</p></div>}
        <div className="sources"><ol><li><span className="skind">Dataset</span><a href="https://github.com/openbibleinfo/Bible-Geocoding-Data" target="_blank" rel="noreferrer">OpenBible.info Bible Geocoding Data</a> (CC-BY 4.0) — identifications weighed across 70+ atlases and commentaries; confidence shown per place.</li></ol></div>
      </div>
    </div>
  );
}
