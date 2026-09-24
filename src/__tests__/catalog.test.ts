import { describe, expect, it } from 'vitest';
import { CATALOG, chaptersOf, featuresInBook } from '@/lib/catalog';
import { CHIASMS, INSIGHTS, MODELS } from '@/lib/content';
import { parseRef } from '@/lib/refs';

describe('catalog', () => {
  it('lists every model, chiasm and insight once', () => {
    const ids = (kind: string) => CATALOG.find((s) => s.kind === kind)!.entries.map((e) => e.id).sort();
    expect(ids('model')).toEqual(MODELS.map((m) => m.id).sort());
    expect(ids('chiasm')).toEqual(CHIASMS.map((c) => c.id).sort());
    expect(ids('insight')).toEqual(INSIGHTS.map((i) => i.id).sort());
  });
  it('goes somewhere that parses, and every ref on an entry parses', () => {
    for (const e of CATALOG.flatMap((s) => s.entries)) {
      expect(parseRef(e.go), e.id).not.toBeNull();
      for (const r of e.lines.flatMap((l) => l.refs)) expect(parseRef(r), `${e.id}: ${r}`).not.toBeNull();
    }
  });
  it('sends a model with a build to its first step', () => {
    expect(CATALOG[0].entries.find((e) => e.id === 'ezekiels-temple')!.go).toBe(MODELS.find((m) => m.id === 'ezekiels-temple')!.builds![0].steps[0].ref);
  });
  it('spans chapters and books', () => {
    expect(chaptersOf('Exod.25.10-27.2').map((c) => c.chapter)).toEqual([25, 26, 27]);
    expect(chaptersOf('Matt.1')).toEqual([{ book: 'Matt', chapter: 1 }]);
    expect(chaptersOf('Mal.4.5-Matt.1.2')).toEqual([{ book: 'Mal', chapter: 4 }, { book: 'Matt', chapter: 1 }]);
  });
  it('marks the chapters a model covers', () => {
    const ezek = featuresInBook('Ezek');
    for (let c = 40; c <= 43; c++) expect(ezek.get(c)?.has('model'), `Ezek ${c}`).toBe(true);
    expect(ezek.get(1)?.has('model') ?? false).toBe(false);
  });
});
