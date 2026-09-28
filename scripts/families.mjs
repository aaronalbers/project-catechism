// The family tree the People tab draws: the curated genealogies (content/people.json) and TIPNR's people merged
// into families, each laid out once here with dagre, so the app only draws what is already placed and glides to
// the people of the verse. Used by build-data.mjs.
import dagre from '@dagrejs/dagre';

/**
 * Merges the curated tree and TIPNR's people into one graph. A curated entry is drawn as the TIPNR person it is
 * (its `tipnr`), keeping the curated name; the few the text leaves unnamed keep their curated id. The curated
 * tree's parents come first. TIPNR's parent is added where the curated tree has none in that place, drawn as
 * `differs` where the curated tree names someone else (Pedaiah for Zerubbabel), and left out where it agrees.
 * Edges are [from, to, kind, note?]: `parent`, `alt` (the curated tree's other parentage, Matthew 1 against
 * Luke 3), `uncertain` (TIPNR's "(?)"), `differs`, `spouse`.
 */
export function familyGraph(curated, people) {
  const byTipnr = new Map(curated.filter((c) => c.tipnr).map((c) => [c.tipnr, c]));
  const curatedById = new Map(curated.map((c) => [c.id, c]));
  const nodeOf = (c) => c.tipnr ?? c.id;
  const nodes = new Map();
  const edges = [];
  const seen = new Set();
  const link = (from, to, kind, note) => {
    const k = kind === 'spouse' ? [from, to].sort().join('~') : `${from}>${to}`;
    if (from === to || seen.has(k)) return;
    seen.add(k);
    edges.push(note ? [from, to, kind, note] : [from, to, kind]);
  };
  for (const c of curated) nodes.set(nodeOf(c), { id: nodeOf(c), name: c.name, sex: c.sex ?? 'male', curated: c.id });
  for (const p of people) if (!nodes.has(p.id)) nodes.set(p.id, { id: p.id, name: p.name, sex: p.sex });
  const curatedNode = (id) => curatedById.has(id) ? nodeOf(curatedById.get(id)) : undefined;
  for (const c of curated) {
    for (const par of [c.father, c.mother]) if (curatedNode(par)) link(curatedNode(par), nodeOf(c), 'parent');
    for (const a of c.altParents ?? []) if (curatedNode(a.id)) link(curatedNode(a.id), nodeOf(c), 'alt', `Alternate: ${a.note}`);
    for (const s of c.spouses ?? []) if (curatedNode(s)) link(nodeOf(c), curatedNode(s), 'spouse');
  }
  const unsure = (a, b) => `TIPNR marks ${a} and ${b} as its reading of a passage that could be read another way`;
  for (const p of people) {
    const cur = byTipnr.get(p.id);
    for (const role of ['father', 'mother']) for (const k of p[role] ?? []) {
      if (!k.id || !nodes.has(k.id)) continue;
      if (!cur) { link(k.id, p.id, k.uncertain ? 'uncertain' : 'parent', k.uncertain ? unsure(k.name, p.name) : undefined); continue; }
      const par = byTipnr.get(k.id), own = cur[role];
      if (par && (par.id === own || cur.altParents?.some((a) => a.id === par.id))) continue;
      const theirs = own && curatedById.get(own)?.name;
      link(k.id, p.id, theirs ? 'differs' : k.uncertain ? 'uncertain' : 'parent',
        theirs ? `The curated tree follows ${theirs}; TIPNR reads ${k.name} as ${cur.name}'s ${role}` : k.uncertain ? unsure(k.name, p.name) : undefined);
    }
    for (const k of p.spouses ?? []) if (k.id && nodes.has(k.id)) link(p.id, k.id, 'spouse', k.uncertain ? unsure(p.name, k.name) : undefined);
  }
  return { nodes, edges };
}

/** Splits the graph into families (people joined by any link), largest first; someone with no kin is in none. */
export function families({ nodes, edges }) {
  const adj = new Map();
  for (const [a, b] of edges) {
    (adj.get(a) ?? adj.set(a, new Set()).get(a)).add(b);
    (adj.get(b) ?? adj.set(b, new Set()).get(b)).add(a);
  }
  const seen = new Set(), out = [];
  for (const id of adj.keys()) {
    if (seen.has(id)) continue;
    const members = [], stack = [id];
    seen.add(id);
    while (stack.length) {
      const x = stack.pop();
      members.push(x);
      for (const y of adj.get(x)) if (!seen.has(y)) { seen.add(y); stack.push(y); }
    }
    const set = new Set(members);
    out.push({ nodes: members.map((m) => nodes.get(m)), edges: edges.filter(([a]) => set.has(a)) });
  }
  return out.sort((a, b) => b.nodes.length - a.nodes.length);
}

/**
 * Places a family top to bottom, a generation to a row, parents a row above their children. dagre cannot hold
 * an edge within a row, so a couple is joined through an unseen anchor a row above them both, which draws them
 * onto one row. Returns each node with integer x, y at its centre.
 */
export function layout(family) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  // Of dagre's four alignments, DR keeps kin closest along a row: parent to child ≈ 475 units on average against
  // ≈ 695 with its default, spouses ≈ 948 against ≈ 1,332, in the family of a thousand (edge weights move no one
  // along a row; they only choose rows).
  g.setGraph({ rankdir: 'TB', nodesep: 16, ranksep: 56, ranker: 'network-simplex', align: 'DR' });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of family.nodes) g.setNode(n.id, { width: Math.round(n.name.length * 7.5 + 20), height: 30 });
  family.edges.forEach(([a, b, kind], i) => {
    if (kind !== 'spouse') { g.setEdge(a, b, { minlen: 1, weight: kind === 'parent' ? 2 : 1 }, `e${i}`); return; }
    const anchor = `~couple${i}`;
    g.setNode(anchor, { width: 1, height: 1 });
    g.setEdge(anchor, a, { minlen: 1, weight: 3 }, `a${i}`);
    g.setEdge(anchor, b, { minlen: 1, weight: 3 }, `b${i}`);
  });
  dagre.layout(g);
  return family.nodes.map((n) => { const { x, y } = g.node(n.id); return { ...n, x: Math.round(x), y: Math.round(y) }; });
}
