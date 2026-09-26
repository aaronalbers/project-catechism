import { describe, expect, it } from 'vitest';
import { DOMAIN, kingById, prophetRows, reached, reignsInChapter, span, synchronism, verdictClass, verdictIn, windowFor, anchorFits } from '@/lib/reign';
import { MONARCHY } from '@/lib/content';

const king = (id: string) => kingById.get(id)!;

describe('reign chart', () => {
  it('fills a bar once its reign is read, in Kings and in Chronicles', () => {
    const at = { book: '1Kgs', chapter: 16, verse: 29 };
    expect(reached(king('ahab'), at)).toBe(true);
    expect(reached(king('jehoshaphat'), at)).toBe(false);
    const chron = { book: '2Chr', chapter: 14, verse: 1 };
    expect(reached(king('asa'), chron)).toBe(true);
    expect(reached(king('jehoshaphat'), chron)).toBe(false);
    expect(reached(king('hoshea'), chron)).toBe(true); // Chronicles never tells Israel's kings, so they are drawn throughout
    expect(reached(king('zedekiah'), { book: 'Matt', chapter: 1, verse: 1 })).toBe(true);
  });
  it('colours by the account being read', () => {
    expect(verdictClass(verdictIn(king('asa'), 'kings'))).toBe('right-but');
    expect(verdictClass(verdictIn(king('abijah'), 'chronicles'))).toBe('none');
    expect(verdictClass(verdictIn(king('ahab'), 'chronicles'))).toBe('untold');
    expect(verdictClass(verdictIn(king('manasseh'), 'kings'))).toBe('evil');
    expect(verdictClass(verdictIn(king('manasseh'), 'chronicles'))).toBe('evil-but');
  });
  it('lays the stated lengths end to end, so the kingdoms drift apart', () => {
    expect(span(king('jeroboam1'), 'stated')).toEqual([-931, -909]);
    expect(Math.round(span(king('jehu'), 'stated')[0])).toBe(-833);
    expect(span(king('athaliah'), 'stated')[0]).toBe(-836);
    expect(span(king('zedekiah'), 'stated')[1]).toBeGreaterThan(-586); // Judah's stated years overrun the fall
  });
  it('draws a synchronism at the reign it dates, and shows how far out the unresolved ones are', () => {
    expect(synchronism(king('ahab'), 'thiele')).toMatchObject({ at: -874, to: -874 });
    expect(synchronism(king('jeroboam2'), 'thiele')).toMatchObject({ at: -782, to: -782 }); // dated from his sole reign
    expect(synchronism(king('jotham'), 'thiele')).toMatchObject({ to: -750 }); // from his coregency
    expect(synchronism(king('hezekiah'), 'thiele')).toMatchObject({ at: -730, to: -715 });
    expect(synchronism(king('jehu'), 'thiele')).toBeNull();
    const stated = synchronism(king('ahab'), 'stated')!;
    expect(stated.at).toBe(-931 + 17 + 3 + 37);
  });
  it('shows where each reading meets the synchronisms and where it does not', () => {
    const off = (mode: string) => [...kingById.values()].filter((k) => synchronism(k, mode)?.off).map((k) => k.id);
    expect(off('thiele')).toEqual(['hezekiah', 'hoshea']); // the two Thiele left unresolved
    expect(off('young')).toEqual(['hoshea']); // McFall reads 2 Kgs 17:1 as dating the end of Hoshea's reign
    expect(synchronism(king('hezekiah'), 'young')).toMatchObject({ off: false, to: -729 }); // met by the coregency with Ahaz
    expect(span(king('rehoboam'), 'young')[0]).toBe(-932);
    expect(span(king('joash-j'), 'galil')).toEqual([-842, -802]);
    expect(span(king('asa'), 'no-such-reading')).toEqual(span(king('asa'), 'thiele')); // an unknown stored choice falls back to Thiele
  });
  it('frames at least eighty years round a reign, inside the period', () => {
    for (const mode of ['thiele', 'stated'] as const) {
      for (const id of ['jeroboam1', 'zimri', 'zedekiah', 'hezekiah']) {
        const [a, b] = windowFor(king(id), mode), [s, e] = span(king(id), mode);
        expect(b - a, `${id} ${mode}`).toBeGreaterThanOrEqual(80);
        expect(a <= s && b >= e && a >= DOMAIN[0] - 4 && b <= DOMAIN[1] + 4, `${id} ${mode}`).toBe(true);
      }
    }
  });
  it('charts each reign at its verse', () => {
    expect([...reignsInChapter('2Kgs', 15)].sort(([a], [b]) => a - b).map(([, r]) => r.k.id)).toEqual(['uzziah', 'zechariah-i', 'shallum', 'menahem', 'pekahiah', 'pekah', 'jotham']);
    expect(reignsInChapter('2Chr', 36).get(9)).toMatchObject({ account: 'chronicles' });
  });
  it('stacks prophets so no two share a row where they overlap', () => {
    const rows = prophetRows(-800, -680);
    for (const a of rows) for (const b of rows) if (a !== b && a.row === b.row) expect(a.p.to < b.p.from || b.p.to < a.p.from).toBe(true);
    expect(rows.map((r) => r.p.id)).toContain('isaiah');
  });
  it('pins a date outside the Bible to a reign, where the view allows', () => {
    const pin = (id: string) => MONARCHY.anchors.find((a) => a.id === id)!;
    expect(anchorFits(pin('qarqar'), 'thiele')).toBe(true);
    expect(anchorFits(pin('jehu-tribute'), 'thiele')).toBe(true);
    expect(anchorFits(pin('jehu-tribute'), 'stated')).toBe(false); // as stated, Jehu has not yet come to the throne
    expect(anchorFits(pin('menahem-tribute'), 'thiele')).toBe(false); // the disputed one
  });
});
