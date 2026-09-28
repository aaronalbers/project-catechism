// The family tree (scripts/families.mjs): the curated genealogies and TIPNR's people merged, split into families
// and laid out at build time.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { families, familyGraph, layout } from '../../scripts/families.mjs';
import { PEOPLE, PEOPLE_BY_ID } from '@/lib/content';
import type { Family } from '@/lib/types';

const david = PEOPLE_BY_ID.get('david')!, jesse = PEOPLE_BY_ID.get('jesse')!, zerubbabel = PEOPLE_BY_ID.get('zorobabel')!;
const edgesTo = (edges: [string, string, string, string?][], id: string) => edges.filter((e) => e[1] === id).map((e) => [e[0], e[2]]);

describe('family tree', () => {
  it('draws TIPNR reading a curated person’s parent otherwise, and not where it agrees', () => {
    // 1 Chronicles 3:19 makes Zerubbabel a son of Pedaiah; the curated tree follows Ezra, Haggai and the Gospels (Shealtiel).
    const shealtiel = PEOPLE_BY_ID.get(zerubbabel.father!)!;
    const { edges } = familyGraph([zerubbabel, shealtiel], [
      { id: zerubbabel.tipnr!, name: 'Zerubbabel', sex: 'male', father: [{ id: 'H6305H', name: 'Pedaiah' }, { id: shealtiel.tipnr!, name: 'Shealtiel' }] },
      { id: 'H6305H', name: 'Pedaiah', sex: 'male' },
    ]);
    expect(edgesTo(edges, zerubbabel.tipnr!)).toEqual([[shealtiel.tipnr, 'parent'], ['H6305H', 'differs']]);
  });
  it('draws a curated person as the TIPNR person they are, keeping the curated name', () => {
    const { nodes, edges } = familyGraph([david, jesse], [{ id: david.tipnr!, name: 'David', sex: 'male', father: [{ id: jesse.tipnr!, name: 'Jesse' }] }]);
    expect(nodes.get(david.tipnr!)).toEqual({ id: david.tipnr, name: david.name, sex: 'male', curated: 'david' });
    expect(edges).toEqual([[jesse.tipnr, david.tipnr, 'parent']]);
  });
  it('dashes the links TIPNR is unsure of, and lays a family out a generation to a row', () => {
    const graph = familyGraph([], [
      { id: 'X0', name: 'Caleb', sex: 'male' },
      { id: 'X1', name: 'Hur', sex: 'male', father: [{ id: 'X0', name: 'Caleb' }], spouses: [{ id: 'X3', name: 'Ephrath', uncertain: true }] },
      { id: 'X2', name: 'Uri', sex: 'male', father: [{ id: 'X1', name: 'Hur', uncertain: true }] },
      { id: 'X3', name: 'Ephrath', sex: 'female' },
      { id: 'X4', name: 'Alone', sex: 'male' },
    ]);
    expect(graph.edges.map((e) => e.slice(0, 3))).toEqual([['X0', 'X1', 'parent'], ['X1', 'X3', 'spouse'], ['X1', 'X2', 'uncertain']]);
    const [only, ...rest] = families(graph);
    expect(rest).toEqual([]); // someone with no kin is in no family
    const y = Object.fromEntries(layout(only).map((n) => [n.id, n.y]));
    expect(y.X1).toBeGreaterThan(y.X0);
    expect(y.X2).toBeGreaterThan(y.X1);
    expect(y.X3).toBe(y.X1); // a couple share a row
  });
});

const built = new URL('../../public/data/people/families.json', import.meta.url);
describe.skipIf(!existsSync(built))('families.json', () => {
  const all = JSON.parse(readFileSync(built, 'utf8')) as Family[];
  it('holds the whole known line in one family, from Adam through David to Jesus', () => {
    const ids = new Set(all[0].n.map((x) => x[0]));
    for (const id of ['H0121G', 'H0085', 'H1732', 'G2424G']) expect(ids.has(id), id).toBe(true);
    // Everyone in the curated tree is drawn.
    const drawn = new Set(all.flatMap((f) => f.n.map((x) => x[0])));
    expect(PEOPLE.filter((p) => !drawn.has(p.tipnr ?? p.id)).map((p) => p.id)).toEqual([]);
  });
  it('puts Jesse a row above David, and every edge between people in the family', () => {
    const at = new Map(all[0].n.map((x) => [x[0], x]));
    expect(at.get(jesse.tipnr!)![4]).toBeLessThan(at.get(david.tipnr!)![4]);
    for (const f of all) {
      const ids = new Set(f.n.map((x) => x[0]));
      for (const [a, b] of f.e) expect(ids.has(a) && ids.has(b), `${a} → ${b}`).toBe(true);
    }
  });
});
