import { describe, expect, it } from 'vitest';
import { partialPath, resolveRoute, stopAt } from '@/lib/journey';
import type { Journey, Place } from '@/lib/types';

const place = (id: string, lat: number, lon: number, approx?: string) =>
  ({ id, name: id, lat, lon, approx, confidence: { score: null, yes: 0, likely: 0, possible: 0 } }) as Place;
const places = new Map([place('a', 30, 34), place('d', 31, 35), place('e', 31, 36, 'within 50 km of D')].map((p) => [p.id, p]));
const journey: Journey = {
  id: 'j', title: 'J', ref: 'Num.33', summary: '', sources: [], confidence: 'estimate',
  stations: [
    { verse: 'Num.33.3', name: 'A', place: 'a', segment: 'South' },
    { verse: 'Num.33.4', name: 'B', estimate: { basis: 'unknown' } },
    { verse: 'Num.33.5', name: 'C', estimate: { basis: 'unknown' } },
    { verse: 'Num.33.6', name: 'D', place: 'd', via: { points: [[30.5, 35]], basis: 'coast' } },
    { verse: 'Num.33.9', name: 'E', place: 'e', segment: 'East' },
  ],
};

describe('resolveRoute', () => {
  const stops = resolveRoute(journey, places);
  it('spaces unplaced stations evenly between fixed ones', () => {
    expect(stops[1].at[0]).toBeCloseTo(30 + 1 / 3);
    expect(stops[2].at[1]).toBeCloseTo(34 + 2 / 3);
  });
  it('marks estimates, including OpenBible placeholders, and threads waypoints into the leg', () => {
    expect(stops.map((s) => !!s.estimate)).toEqual([false, true, true, false, true]);
    expect(stops[4].estimate).toContain('within 50 km of D');
    expect(stops[3].leg).toEqual([stops[2].at, [30.5, 35], [31, 35]]);
    expect(stops[3].legEstimated).toBe(true);
  });
  it('carries a named segment forward until the next one starts', () => {
    expect(stops.map((s) => s.segment)).toEqual(['South', 'South', 'South', 'South', 'East']);
  });
  it('finds the camp reached at a verse', () => {
    expect([2, 3, 7, 50].map((v) => stopAt(stops, v))).toEqual([-1, 0, 3, 4]);
  });
});

describe('partialPath', () => {
  it('cuts a polyline by length', () => {
    expect(partialPath([[0, 0], [0, 1], [0, 3]], 0.5)).toEqual([[0, 0], [0, 1], [0, 1.5]]);
    expect(partialPath([[0, 0], [0, 2]], 1)).toEqual([[0, 0], [0, 2]]);
  });
});
