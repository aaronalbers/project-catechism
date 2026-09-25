import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { goTo, useStore } from '@/app/store';
import { SourceList } from '@/components/SourceList';
import { journeysInChapter } from '@/lib/content';
import { loadPlaces, loadPlacesForBook } from '@/lib/data';
import { partialPath, resolveRoute, stopAt, type LatLon, type RouteStop } from '@/lib/journey';
import type { Place } from '@/lib/types';

// Leaflet's default marker icons don't survive bundling; draw our own.
const icon = (active: boolean, approx = false) => L.divIcon({
  className: '',
  html: `<div style="width:${active ? 16 : 11}px;height:${active ? 16 : 11}px;border-radius:50%;background:${active ? '#b23a3a' : '#7c5a2e'};border:2px ${approx ? 'dashed' : 'solid'} #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

const LEG_MS = 900;
/**
 * Keeps fitted points clear of the zoom control (top left) and the stage card (top right): beside
 * the card when the map is wide enough, below it when it isn't.
 */
function fitOptions(map: HTMLElement | null, card: HTMLElement | null): L.FitBoundsOptions {
  const w = map?.clientWidth ?? 0, c = card?.getBoundingClientRect();
  if (!c) return { maxZoom: 8, padding: [30, 30] };
  return w - c.width > 360
    ? { maxZoom: 8, paddingTopLeft: [50, 16], paddingBottomRight: [c.width + 24, 16] }
    : { maxZoom: 8, paddingTopLeft: [50, c.height + 16], paddingBottomRight: [16, 16] };
}

function confidenceLabel(p: Place) {
  if (p.approx) return `≈ position only: ${p.approx}`;
  const c = p.confidence;
  const total = c.yes + c.likely + c.possible;
  if (!total) return 'location per OpenBible.info';
  if (c.yes >= c.likely && c.yes >= c.possible) return `identification: confident (${c.yes}/${total} sources)`;
  if (c.likely >= c.possible) return `identification: likely (${c.likely}/${total} sources)`;
  return `identification: possible (${c.possible}/${total} sources)`;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const stopName = (s: RouteStop) => (s.estimate ? '≈ ' : '') + s.station.name;

function PlaceRow({ p, dim, onPick }: { p: Place; dim?: boolean; onPick: (id: string) => void }) {
  return (
    <div className="place" onClick={() => onPick(p.id)} style={dim ? { opacity: 0.75 } : undefined}>
      {p.image ? <img src={p.image.url} alt={p.image.description} loading="lazy" title={`${p.image.credit} — ${p.image.license}`} /> : <div className="noimg" />}
      <div>
        <div className="name">{p.name} <span className="chip">{p.types.join(', ')}</span></div>
        <div className="desc">{p.description}</div>
        <div className="conf">{confidenceLabel(p)} · {p.verses} verse{p.verses === 1 ? '' : 's'}{p.wikidata && <> · <a href={`https://www.wikidata.org/wiki/${p.wikidata}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Wikidata</a></>}{p.image && <> · photo: <a href={p.image.creditUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{p.image.credit}</a> ({p.image.license})</>}</div>
      </div>
    </div>
  );
}

export function PlacesPanel() {
  const loc = useStore((s) => s.loc);
  const [all, setAll] = useState<Place[]>([]);
  const [byVerse, setByVerse] = useState<Record<string, string[]>>({});
  const [active, setActive] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const stageList = useRef<HTMLOListElement>(null);
  const shownStop = useRef<{ journey: string; index: number } | null>(null);
  /** The last view we chose, re-applied if the map resizes before the user takes over. */
  const wanted = useRef<L.LatLngBounds | null>(null);
  const stageCard = useRef<HTMLDivElement>(null);

  useEffect(() => { loadPlaces().then(setAll, () => { /* no place data: the map stays empty */ }); }, []);
  useEffect(() => {
    let live = true;
    setByVerse({});
    loadPlacesForBook(loc.book).then((b) => live && setByVerse(b));
    return () => { live = false; };
  }, [loc.book]);

  const placesById = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);

  // An itinerary in this chapter replaces the per-verse markers with a route drawn as it is read.
  const journey = useMemo(() => journeysInChapter(loc.book, loc.chapter)[0], [loc.book, loc.chapter]);
  const stops = useMemo(() => (journey && placesById.size ? resolveRoute(journey, placesById) : []), [journey, placesById]);
  const cur = stops.length ? stopAt(stops, loc.verse) : -1;
  const stationIds = useMemo(() => new Set(stops.flatMap((s) => (s.station.place ? [s.station.place] : []))), [stops]);

  const hereIds = byVerse[`${loc.chapter}.${loc.verse}`] ?? [];
  const chapterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [k, v] of Object.entries(byVerse)) if (k.startsWith(`${loc.chapter}.`)) v.forEach((id) => ids.add(id));
    return [...ids];
  }, [byVerse, loc.chapter]);
  const here = hereIds.map((id) => placesById.get(id)).filter((p): p is Place => !!p && !stationIds.has(p.id));
  const chapter = chapterIds.map((id) => placesById.get(id)).filter((p): p is Place => !!p && !hereIds.includes(p.id) && !stationIds.has(p.id));

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    map.current = L.map(mapEl.current, { zoomControl: true, attributionControl: true, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([31.8, 35.2], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · places: <a href="https://www.openbible.info/geo/">OpenBible.info</a> CC-BY',
    }).addTo(map.current);
    routeLayer.current = L.layerGroup().addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    // The panel often settles its height after the first fit; keep our view until the user moves the map.
    const el = mapEl.current, m = map.current;
    const release = () => { wanted.current = null; };
    el.addEventListener('pointerdown', release);
    el.addEventListener('wheel', release, { passive: true });
    const ro = new ResizeObserver(() => { m.invalidateSize(); if (wanted.current) m.fitBounds(wanted.current, { ...fitOptions(el, stageCard.current), animate: false }); });
    ro.observe(el);
    return () => { ro.disconnect(); el.removeEventListener('pointerdown', release); el.removeEventListener('wheel', release); map.current?.remove(); map.current = null; };
  }, []);

  // Place markers. Names of the places in this verse stay on the map, not just in a popup.
  useEffect(() => {
    const m = map.current, lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    const shown = journey ? here : [...here, ...chapter];
    const bounds: L.LatLngExpression[] = [];
    for (const p of shown) {
      const isHere = hereIds.includes(p.id);
      const mk = L.marker([p.lat, p.lon], { icon: icon(isHere || p.id === active, !!p.approx), title: p.name }).addTo(lg);
      mk.bindPopup(`<strong>${escape(p.name)}</strong><br>${escape(p.description)}<br><small>${escape(confidenceLabel(p))}</small>`);
      if (isHere) mk.bindTooltip((p.approx ? '≈ ' : '') + escape(p.name), { permanent: true, direction: 'right', offset: [8, 0], className: 'map-label' });
      mk.on('click', () => setActive(p.id));
      if (isHere) bounds.push([p.lat, p.lon]);
    }
    setTimeout(() => m.invalidateSize(), 50);
    if (active && placesById.get(active)) { const p = placesById.get(active)!; m.flyTo([p.lat, p.lon], Math.max(m.getZoom(), 9), { duration: 0.6 }); }
    else if (journey) return; // the route effect owns the view
    else if (bounds.length === 1) m.flyTo(bounds[0], 9, { duration: 0.6 });
    else if (bounds.length > 1) m.flyToBounds(L.latLngBounds(bounds).pad(0.3), { duration: 0.6 });
    else if (shown.length) m.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lon] as L.LatLngExpression)).pad(0.3));
  }, [here, chapter, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // The route: faint ahead, solid behind. When reading moves forward, the legs added by the new
  // verse grow in turn (a verse can name several points), with a marker travelling along them.
  useEffect(() => {
    const m = map.current, lg = routeLayer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    if (!journey || !stops.length) { shownStop.current = null; return; }
    const prev = shownStop.current?.journey === journey.id ? shownStop.current.index : null;
    shownStop.current = { journey: journey.id, index: cur };
    // A route is shown whole and panned to follow; a boundary is read a stretch at a time, so the
    // map zooms to the stretch this verse describes and pulls back to the whole once it closes.
    const whole = L.latLngBounds(stops.flatMap((s) => s.leg)).pad(0.08);
    const border = journey.kind === 'border';
    const first = cur < 0 ? 0 : stops.findIndex((s) => s.verse === stops[cur].verse);
    const complete = cur === stops.length - 1 && !!journey.closed;
    const view = border && cur >= 0 && !complete ? L.latLngBounds(stops.slice(first, cur + 1).flatMap((s) => s.leg)).pad(0.1) : prev === null || border ? whole : null;
    const fit = fitOptions(mapEl.current, stageCard.current);
    if (view) { wanted.current = view; if (prev === null) m.fitBounds(view, fit); else m.flyToBounds(view, { ...fit, duration: 0.7 }); }

    const animFrom = prev !== null && prev >= 0 && prev < cur && cur - prev <= 8 ? prev : cur;
    const legStyle = (s: RouteStop, done: boolean): L.PolylineOptions => ({
      className: done ? 'route-leg' : 'route-ahead', weight: done ? 3.5 : 2, interactive: false,
      dashArray: s.legEstimated ? (done ? '6 6' : '2 6') : done ? undefined : '4 6',
    });
    stops.forEach((s, i) => { if (i > 0) L.polyline(s.leg, legStyle(s, i <= animFrom)).addTo(lg); });
    const fill = () => {
      if (journey.closed && cur === stops.length - 1) L.polygon(stops.flatMap((s) => s.leg), { className: 'route-fill', stroke: false, interactive: false }).addTo(lg).bringToBack();
    };
    stops.forEach((s, i) => {
      const c = L.circleMarker(s.at, {
        radius: i === cur ? 7 : 4, weight: 2, fillOpacity: 1,
        className: `route-stop${i <= cur ? ' done' : ''}${i === cur ? ' current' : ''}${s.estimate ? ' approx' : ''}`,
        dashArray: s.estimate ? '2 2' : undefined,
      }).addTo(lg);
      // Everything named in this verse keeps its label, and so does the point it set out from.
      // Labels alternate sides, counting back from the current point, so close neighbours don't collide.
      const named = i >= first && i <= cur, from = i === first - 1, left = (named || from) && (cur - i) % 2 === 1;
      c.bindTooltip(escape(stopName(s)), named || from
        ? { permanent: true, direction: left ? 'left' : 'right', offset: [left ? -8 : 8, 0], className: i === cur ? 'map-label' : 'map-label muted' }
        : { direction: 'right', offset: [6, 0], className: 'map-label muted' });
      c.on('click', () => goTo({ book: loc.book, chapter: loc.chapter, verse: s.verse }));
    });

    if (cur < 0) return;
    const target = stops[cur].at;
    if (!border && prev !== null && !m.getBounds().pad(-0.2).contains(target)) m.panTo(target, { animate: true, duration: 0.6 });
    if (animFrom === cur) { fill(); return; }

    const legs = stops.slice(animFrom + 1, cur + 1);
    const lines = legs.map((s) => L.polyline([s.leg[0]], legStyle(s, true)).addTo(lg));
    const lengths = legs.map((s) => s.leg.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s.leg[i][0], p[1] - s.leg[i][1]), 0));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    const walker = L.circleMarker(legs[0].leg[0], { radius: 5, weight: 2, fillOpacity: 1, className: 'route-walker', interactive: false }).addTo(lg);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = Math.min(LEG_MS * legs.length, 3200);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / duration);
      let d = (1 - (1 - t) ** 3) * total;
      let tip: LatLon = legs[0].leg[0];
      legs.forEach((s, i) => {
        const part: LatLon[] = partialPath(s.leg, lengths[i] ? Math.max(0, Math.min(1, d / lengths[i])) : 1);
        lines[i].setLatLngs(part);
        if (d > 0) tip = part[part.length - 1];
        d -= lengths[i];
      });
      walker.setLatLng(tip);
      if (t < 1) raf = requestAnimationFrame(step); else { lg.removeLayer(walker); fill(); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [journey, stops, cur]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the current stage in view inside its own scroll box, without scrolling the panel.
  useEffect(() => {
    const box = stageList.current, row = box?.querySelector<HTMLElement>('[aria-current="step"]');
    if (box && row) box.scrollTo({ top: row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2, behavior: 'smooth' });
  }, [cur, stops]);

  useEffect(() => { setActive(null); }, [loc.book, loc.chapter, loc.verse]);

  const current = cur >= 0 ? stops[cur] : undefined;
  const border = journey?.kind === 'border';
  const first = current ? stops.findIndex((s) => s.verse === current.verse) : -1;
  const passed = current ? stops.slice(first, cur).map((s) => s.station.name) : [];
  return (
    <div className="panel-body flush">
      <div className="map-wrap" data-kind={journey?.kind ?? 'route'}>
        <div className="map" ref={mapEl} role="application" aria-label="Map of places in this passage" />
        {journey && stops.length > 0 && (
          <div className="map-stage" aria-live="polite" ref={stageCard}>
            {current ? <>
              <small>{border ? current.segment : cur === 0 ? 'Setting out' : `Camp ${cur} of ${stops.length - 1}`}</small>
              <strong>{stopName(current)}</strong>
              {first > 0 && <small className="from">from {stops[first - 1].station.name}{passed.length > 0 && <> via {passed.join(', ')}</>}</small>}
              {current.estimate && <small className="est">estimated position</small>}
            </> : <><small>{journey.title}</small><strong>{border ? `${stops.length} points` : `${stops.length - 1} camps`}</strong></>}
          </div>
        )}
      </div>
      <div className="place-list">
        {journey && stops.length > 0 && <>
          <div className="panel-title">{journey.title}</div>
          <ol className="stages" ref={stageList}>
            {stops.map((s, i) => [
              s.segment && s.segment !== stops[i - 1]?.segment && <li key={`seg${i}`} className="stage-segment">{s.segment}</li>,
              <li key={i} aria-current={i === cur ? 'step' : undefined} className={i < cur ? 'done' : undefined}>
                <button onClick={() => goTo({ book: loc.book, chapter: loc.chapter, verse: s.verse })}>
                  <span className="n">{border ? i + 1 : i === 0 ? '·' : i}</span>
                  <span className="nm">{s.station.name}{s.estimate && <span className="approx" title={s.estimate}> ≈</span>}</span>
                  <span className="v">{loc.chapter}:{s.verse}</span>
                </button>
                {i === cur && (s.estimate || s.station.via || s.place) && (
                  <div className="stage-note">
                    {s.estimate && <p><strong>≈ Estimated position.</strong> {s.estimate}</p>}
                    {s.station.via && <p><strong>≈ Path of this leg.</strong> {s.station.via.basis}</p>}
                    {s.place && !s.station.estimate && <p>{s.place.description} · {confidenceLabel(s.place)}</p>}
                    {s.place && <p><a href={`https://www.openbible.info/geo/ancient/${s.place.slug}`} target="_blank" rel="noreferrer">OpenBible.info: {s.place.name}</a></p>}
                  </div>
                )}
              </li>,
            ])}
          </ol>
          <p className="stage-summary"><span className="badge estimate">estimate</span> {journey.summary}</p>
          <SourceList sources={journey.sources} />
        </>}
        {here.length > 0 && <><div className="panel-title">In this verse</div>{here.map((p) => <PlaceRow key={p.id} p={p} onPick={setActive} />)}</>}
        {chapter.length > 0 && <><div className="panel-title">Elsewhere in this chapter</div>{chapter.map((p) => <PlaceRow key={p.id} p={p} dim onPick={setActive} />)}</>}
        {here.length + chapter.length === 0 && !journey && <div className="empty"><p>No identifiable places in this chapter.</p></div>}
        <div className="sources"><ol><li><span className="skind">Dataset</span><a href="https://github.com/openbibleinfo/Bible-Geocoding-Data" target="_blank" rel="noreferrer">OpenBible.info Bible Geocoding Data</a> (CC-BY 4.0) — identifications weighed across 70+ atlases and commentaries; confidence shown per place.</li></ol></div>
      </div>
    </div>
  );
}
