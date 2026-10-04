// The night sky for the Sky tab: the Yale Bright Star Catalogue's stars, and d3-celestial's constellation lines
// snapped onto them, so a line moves with its stars when proper motion carries them back two thousand years.

/** Stars fainter than this are left out: about the faintest an eye sees under a dark sky. */
export const FAINTEST = 6.5;

/** Proper names for the stars the sky labels, by Bayer designation (the IAU's names). */
export const STAR_NAMES = {
  'Alp Leo': 'Regulus', 'Bet Leo': 'Denebola', 'Alp Vir': 'Spica', 'Alp Boo': 'Arcturus', 'Alp Sco': 'Antares',
  'Alp Tau': 'Aldebaran', 'Alp CMa': 'Sirius', 'Alp CMi': 'Procyon', 'Bet Gem': 'Pollux', 'Alp Gem': 'Castor',
  'Alp Ori': 'Betelgeuse', 'Bet Ori': 'Rigel', 'Alp Lyr': 'Vega', 'Alp Aql': 'Altair', 'Alp Cyg': 'Deneb',
  'Alp Aur': 'Capella', 'Alp PsA': 'Fomalhaut', 'Alp Car': 'Canopus', 'Alp Ari': 'Hamal', 'Alp UMi': 'Polaris',
};

/**
 * Star clusters the Sky tab can ring, by their brighter members' designations: the Pleiades (Electra, Taygeta, Maia,
 * Merope, Alcyone, Atlas, Pleione) and the Hyades (the V of Taurus without Aldebaran, which is not a member).
 */
export const CLUSTERS = {
  Pleiades: ['17 Tau', '19 Tau', '20 Tau', '23 Tau', '25 Tau', '27 Tau', '28 Tau'],
  Hyades: ['Gam Tau', 'Del Tau', 'Eps Tau', 'The Tau'],
};

/**
 * One star per row of the catalogue (CDS V/50, fixed-width; its ReadMe gives the bytes): J2000 position in degrees,
 * V magnitude, B−V colour, proper motion in milliarcseconds a year (RA's already projected, cos δ · dα/dt), and the
 * Bayer and Flamsteed designations where it has them. Rows the catalogue removed have no position and are skipped.
 */
export function parseBsc(text) {
  const num = (line, a, b) => { const s = line.slice(a - 1, b).trim(); return s === '' ? null : Number(s); };
  const stars = [];
  for (const line of text.split('\n')) {
    const rah = num(line, 76, 77), vmag = num(line, 103, 107);
    if (rah === null || vmag === null || vmag > FAINTEST) continue;
    const ra = (rah + num(line, 78, 79) / 60 + num(line, 80, 83) / 3600) * 15;
    const dec = (line[83] === '-' ? -1 : 1) * (num(line, 85, 86) + num(line, 87, 88) / 60 + num(line, 89, 90) / 3600);
    const name = line.slice(4, 14);
    const bayer = /([A-Z][a-z]{2})\s*\d?\s*([A-Z][A-Za-z]{2})\s*$/.exec(name)?.slice(1).join(' ');
    const flamsteed = /^\s*(\d+)\D.*?([A-Z][A-Za-z]{2})\s*$/.exec(name)?.slice(1).join(' ');
    stars.push({ ra, dec, vmag, bv: num(line, 110, 114) ?? 0.6, pmRa: (num(line, 149, 154) ?? 0) * 1000, pmDec: (num(line, 155, 160) ?? 0) * 1000, bayer, flamsteed });
  }
  return stars;
}

const RAD = Math.PI / 180;
const unit = (ra, dec) => [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];

/** The star nearest a point, if one lies within `within` degrees. */
function nearest(stars, ra, dec, within = 0.3) {
  const p = unit(ra, dec), limit = Math.cos(within * RAD);
  let best = -1, bestDot = limit;
  stars.forEach((s, i) => { const q = unit(s.ra, s.dec), d = p[0] * q[0] + p[1] * q[1] + p[2] * q[2]; if (d > bestDot) { bestDot = d; best = i; } });
  return best;
}

/**
 * The sky file: `stars` as flat rows [ra, dec, vmag, b−v, pmRa, pmDec], `names` (star index → proper name),
 * `clusters` (name → its members' indices), `lines` (constellation → runs of star indices) and `labels` ([name, ra, dec], where d3-celestial puts each name).
 * d3-celestial gives RA as a longitude from −180° to 180°.
 */
export function buildSkyData(bscText, linesGeo, constellationsGeo) {
  const stars = parseBsc(bscText);
  const names = {};
  // A double star has a row per component under one designation; the name goes to the brighter.
  const named = new Map();
  stars.forEach((s, i) => { const n = s.bayer && STAR_NAMES[s.bayer]; if (n && (!named.has(n) || s.vmag < stars[named.get(n)].vmag)) named.set(n, i); });
  for (const [n, i] of named) names[i] = n;
  const missing = Object.values(STAR_NAMES).filter((n) => !Object.values(names).includes(n));
  if (missing.length) throw new Error(`sky: no catalogue star for ${missing.join(', ')}`);
  const clusters = Object.fromEntries(Object.entries(CLUSTERS).map(([name, ids]) => {
    const members = stars.flatMap((s, i) => (ids.includes(s.bayer) || ids.includes(s.flamsteed) ? [i] : []));
    if (members.length < ids.length) throw new Error(`sky: ${name} has ${members.length} of ${ids.length} members`);
    return [name, members];
  }));
  const lines = {};
  let unmatched = 0;
  for (const f of linesGeo.features) {
    const runs = [];
    for (const run of f.geometry.coordinates) {
      let cur = [];
      for (const [lon, dec] of run) {
        const i = nearest(stars, lon < 0 ? lon + 360 : lon, dec);
        if (i < 0) { unmatched++; if (cur.length > 1) runs.push(cur); cur = []; continue; }
        cur.push(i);
      }
      if (cur.length > 1) runs.push(cur);
    }
    lines[f.id] = runs;
  }
  const labels = constellationsGeo.features.map((f) => [f.properties.name, ...f.geometry.coordinates.map((c, k) => (k === 0 && c < 0 ? c + 360 : c))]);
  const round = (x, n) => Math.round(x * 10 ** n) / 10 ** n;
  return {
    stats: { stars: stars.length, unmatched },
    data: { stars: stars.map((s) => [round(s.ra, 4), round(s.dec, 4), s.vmag, s.bv, round(s.pmRa, 1), round(s.pmDec, 1)]), names, clusters, lines, labels },
  };
}
