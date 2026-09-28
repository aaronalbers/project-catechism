// The family tree the People tab draws for a chapter: the curated genealogies (content/people.json), and around
// them everyone the chapter names that they leave out, with the parents and spouses TIPNR gives them.
import type { PeopleInBook, Person } from './types';
import { PEOPLE_BY_ID } from './content';

export interface TreeNode {
  id: string; name: string; sex: 'male' | 'female'; level: number;
  /** The curated entry, when the node is one; otherwise a person from the generated data, opened by id. */
  person?: Person;
}
/**
 * `parent` is a link the text makes (curated, or TIPNR's tied to a verse); `alt` is the curated tree's other
 * parentage (Matthew 1 against Luke 3); `reading` is TIPNR's link no nearby verse makes; `differs` is TIPNR
 * reading a curated person's parent otherwise than the curated tree does. `note` says so on hover.
 */
export interface TreeEdge { from: string; to: string; kind: 'parent' | 'alt' | 'reading' | 'differs' | 'spouse'; note?: string }

/** The curated entry for a TIPNR id. */
const CURATED_BY_TIPNR = new Map([...PEOPLE_BY_ID.values()].filter((p) => p.tipnr).map((p) => [p.tipnr!, p]));
export const curatedFor = (tipnr: string) => CURATED_BY_TIPNR.get(tipnr)?.id;

/**
 * The curated people in view (their own neighbourhood), and around them the people the chapter names that the
 * curated tree leaves out, each with their parents and spouses; for a curated person, a parent TIPNR reads
 * otherwise is drawn too. Levels are the curated generations where there are any, carried along the links.
 */
export function familyTree(curated: Person[], data: PeopleInBook | undefined, chapter: number): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const nodes = new Map<string, TreeNode>();
  const edges: TreeEdge[] = [];
  const add = (p: Person) => { if (!nodes.has(p.id)) nodes.set(p.id, { id: p.id, name: p.name, sex: p.sex ?? 'male', level: p.generation, person: p }); return p.id; };
  for (const p of curated) add(p);
  for (const p of curated) {
    for (const par of [p.father, p.mother]) if (par && nodes.has(par)) edges.push({ from: par, to: p.id, kind: 'parent' });
    for (const a of p.altParents ?? []) if (nodes.has(a.id)) edges.push({ from: a.id, to: p.id, kind: 'alt', note: `Alternate: ${a.note}` });
    for (const s of p.spouses ?? []) if (nodes.has(s) && s > p.id) edges.push({ from: p.id, to: s, kind: 'spouse' });
  }
  if (!data) return { nodes: [...nodes.values()], edges };

  const level = new Map<string, number>([...nodes.values()].map((n) => [n.id, n.level]));
  // A generated person is drawn as their curated entry when there is one.
  const node = (id: string, name: string): string => {
    const cur = CURATED_BY_TIPNR.get(id);
    if (cur) return add(cur);
    if (!nodes.has(id)) nodes.set(id, { id, name, sex: data.people[id]?.[2] === 'f' ? 'female' : 'male', level: NaN });
    return id;
  };
  const seen = new Set(edges.map((e) => `${e.from}>${e.to}`));
  const link = (e: TreeEdge) => { const k = `${e.from}>${e.to}`; if (!seen.has(k) && e.from !== e.to) { seen.add(k); edges.push(e); } };
  const reading = (name: string) => `TIPNR links ${name} here, but no verse near names both with a word of kinship: its reading, not the text's`;
  const inChapter = new Set(Object.entries(data.verses).filter(([k]) => +k.split('.')[0] === chapter).flatMap(([, ids]) => ids));
  for (const id of inChapter) {
    const [name, , , parents = [], spouses = []] = data.people[id] ?? [id, '', 'm'];
    const cur = CURATED_BY_TIPNR.get(id);
    const self = node(id, name);
    for (const [pid, pname, tied] of parents) {
      const par = CURATED_BY_TIPNR.get(pid);
      if (cur) {
        // A curated person's parents come from the curated tree; TIPNR is drawn only where it reads them otherwise.
        const own = [cur.father, cur.mother, ...(cur.altParents ?? []).map((a) => a.id)];
        if (par && own.includes(par.id)) continue;
        link({ from: node(pid, pname), to: self, kind: 'differs', note: `TIPNR reads ${pname} as ${name}'s parent${tied ? '' : ', though no verse near says so'}` });
        continue;
      }
      link({ from: node(pid, pname), to: self, kind: tied ? 'parent' : 'reading', note: tied ? undefined : reading(`${pname} to ${name}`) });
    }
    if (!cur) for (const [sid, sname, tied] of spouses) {
      const s = node(sid, sname);
      if (!seen.has(`${s}>${self}`)) link({ from: self, to: s, kind: 'spouse', note: tied ? undefined : reading(`${name} and ${sname}`) });
    }
  }
  // Carry levels along the links: a child is a generation below a parent, spouses share one. What no curated
  // generation reaches starts from the top of the curated people in view, or 0.
  for (const n of nodes.values()) if (!level.has(n.id) && Number.isFinite(n.level)) level.set(n.id, n.level);
  const relax = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        const a = level.get(e.from), b = level.get(e.to), d = e.kind === 'spouse' ? 0 : 1;
        if (a !== undefined && b === undefined) { level.set(e.to, a + d); changed = true; }
        else if (b !== undefined && a === undefined) { level.set(e.from, b - d); changed = true; }
      }
    }
  };
  relax();
  const top = level.size ? Math.min(...level.values()) : 0;
  for (const n of nodes.values()) if (!level.has(n.id)) { level.set(n.id, top); relax(); }
  for (const n of nodes.values()) n.level = level.get(n.id)!;
  return { nodes: [...nodes.values()], edges };
}
