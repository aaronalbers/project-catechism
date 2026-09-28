// The family tree drawn for a chapter (src/lib/tree.ts): the curated genealogies, with TIPNR's people round them.
import { describe, expect, it } from 'vitest';
import { PEOPLE_BY_ID } from '@/lib/content';
import { familyTree } from '@/lib/tree';
import type { PeopleInBook } from '@/lib/types';

describe('family tree', () => {
  it('draws TIPNR reading a curated person’s parent otherwise, and not where it agrees', () => {
    const zerubbabel = PEOPLE_BY_ID.get('zorobabel')!;
    // 1 Chronicles 3:19 makes Zerubbabel a son of Pedaiah; the curated tree follows Ezra, Haggai and the Gospels (Shealtiel).
    const data: PeopleInBook = {
      verses: { '3.19': [zerubbabel.tipnr!] },
      people: { [zerubbabel.tipnr!]: ['Zerubbabel', '', 'm', [['H6305H', 'Pedaiah', 1], [PEOPLE_BY_ID.get(zerubbabel.father!)!.tipnr!, 'Shealtiel', 1]]] },
    };
    const { nodes, edges } = familyTree([zerubbabel], data, 3);
    expect(edges.filter((e) => e.to === 'zorobabel').map((e) => [e.from, e.kind])).toEqual([['H6305H', 'differs']]);
    expect(nodes.find((n) => n.id === 'zorobabel')?.person).toBe(zerubbabel);
    expect(nodes.find((n) => n.id === 'H6305H')?.level).toBe(zerubbabel.generation - 1);
  });
  it('draws the people the curated tree leaves out, dashing the links no verse makes', () => {
    const data: PeopleInBook = {
      verses: { '2.19': ['X1'], '2.20': ['X2'] },
      people: { X0: ['Caleb', '', 'm'], X1: ['Hur', 'son of Caleb', 'm', [['X0', 'Caleb', 1]], [['X3', 'Ephrath', 0]]], X2: ['Uri', '', 'm', [['X1', 'Hur', 0]]] },
    };
    const { nodes, edges } = familyTree([], data, 2);
    expect(edges.map((e) => [e.from, e.to, e.kind])).toEqual([['X0', 'X1', 'parent'], ['X1', 'X3', 'spouse'], ['X1', 'X2', 'reading']]);
    expect(edges.find((e) => e.kind === 'spouse')?.note).toMatch(/TIPNR/);
    const level = Object.fromEntries(nodes.map((n) => [n.id, n.level]));
    expect([level.X1 - level.X0, level.X2 - level.X1, level.X3 - level.X1]).toEqual([1, 1, 0]);
  });
});
