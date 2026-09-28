// The written profiles (content/profiles/*.json) in full. Each is its own chunk, loaded when it is opened;
// the lists and the index use PROFILE_INDEX (content.ts).
import { useEffect, useState } from 'react';
import { PEOPLE, PROFILE_BY_PERSON } from './content';
import { loadPerson } from './data';
import { compareLoc, contains, parseRef } from './refs';
import type { BiblePerson, Person, Profile, Ref } from './types';

const files = import.meta.glob<Profile>('@content/profiles/*.json', { import: 'default' });
export const loadProfile = (id: string) => files[`/content/profiles/${id}.json`]?.();

/** The profile of a person, once loaded: undefined while loading, null when they have none. */
export function useProfile(personId: string): Profile | null | undefined {
  const id = PROFILE_BY_PERSON.get(personId)?.id;
  const [p, setP] = useState<{ id: string; p: Profile }>();
  useEffect(() => {
    let live = true;
    if (id) loadProfile(id)?.then((p) => live && setP({ id, p }));
    return () => { live = false; };
  }, [id]);
  if (!id) return null;
  return p?.id === id ? p.p : undefined;
}

/** A person, with the verses of any duplicate entries a profile merges into them; null if there is no such person. */
export function usePerson(id: string): BiblePerson | null | undefined {
  const [p, setP] = useState<{ id: string; p: BiblePerson | null }>();
  useEffect(() => {
    let live = true;
    const ids = PROFILE_BY_PERSON.get(id)?.people ?? [id];
    Promise.all(ids.map(loadPerson)).then(([main, ...rest]) => {
      if (!live) return;
      if (!main) { setP({ id, p: null }); return; }
      const refs = [...new Set([main, ...rest].flatMap((x) => x?.refs ?? []))].sort((a, b) => compareLoc(parseRef(a)!.start, parseRef(b)!.start));
      setP({ id, p: { ...main, refs } });
    });
    return () => { live = false; };
  }, [id]);
  return p?.id === id ? p.p : undefined;
}

/**
 * The family-tree entry for a named person: the one a profile names, the one with their TIPNR id, or else one of
 * the same name whose references take in a verse naming this person, so the two Enochs and the many Zechariahs
 * stay apart.
 */
export function genealogyOf(id: string, name: string, refs: Ref[]): Person | undefined {
  const curated = PROFILE_BY_PERSON.get(id)?.genealogy;
  if (curated) return PEOPLE.find((p) => p.id === curated);
  const same = PEOPLE.find((p) => p.tipnr === id);
  if (same) return same;
  const verses = refs.map((r) => parseRef(r)?.start).filter((l) => !!l);
  return PEOPLE.find((p) => p.name === name && p.refs.some((r) => verses.some((l) => contains(r, l))));
}
