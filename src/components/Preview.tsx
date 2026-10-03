import { useEffect, useRef, useState } from 'react';
import { goTo, leave, setState, useStore, type GoOpts } from '@/app/store';
import { loadBook } from '@/lib/data';
import { play } from '@/lib/reader';
import { formatRef, parseRef } from '@/lib/refs';
import type { Ref } from '@/lib/types';
import { Icon } from './Icons';

/** The most verses a preview shows; the rest are a tap on "Go there" away. */
const MOST = 6;

/** A passage a link asked for while the audio was reading: its text, and whether to go there or read from it. */
export function Preview() {
  const preview = useStore((s) => s.preview);
  return preview ? <Sheet key={preview.ref} ref_={preview.ref} opts={preview.opts} /> : null;
}

function Sheet({ ref_, opts }: { ref_: Ref; opts: GoOpts }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const r = parseRef(ref_)!;
  const [verses, setVerses] = useState<{ n: string; t: string }[] | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let live = true;
    loadBook(r.start.book).then((b) => {
      // A range across chapters is shown from its start to the end of the first.
      const last = r.end.chapter === r.start.chapter && r.end.book === r.start.book ? r.end.verse : Infinity;
      const all = (b.chapters[r.start.chapter - 1] ?? []).filter((v) => v.v >= r.start.verse && v.v <= last);
      if (!live) return;
      setVerses(all.slice(0, MOST).map((v) => ({ n: String(v.l ?? v.v), t: v.t || (v.f ?? []).join(' ') })));
      setMore(all.length > MOST || last === Infinity && r.end.chapter !== r.start.chapter);
    }, () => live && setVerses([]));
    return () => { live = false; };
  }, [ref_]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => setState({ preview: null });
  const readFromHere = () => { goTo(r.start, opts); void play(r.start); };
  return (
    <dialog ref={dialog} className="peek" aria-label={`Preview of ${formatRef(ref_)}`} onClose={close} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="peek-head">
        <h2>{formatRef(ref_)}</h2>
        <button className="iconbtn small" onClick={() => dialog.current?.close()} aria-label="Close the preview" title="Close: the reading goes on where it is"><Icon.Close /></button>
      </div>
      <div className="peek-body">
        {verses === null ? <p className="waiting">Loading…</p> : verses.map((v) => <p key={v.n}><span className="num">{v.n}</span> {v.t}</p>)}
        {more && <p className="waiting">…</p>}
      </div>
      <p className="peek-note">The audio is reading, so the link opens here and leaves it where it is.</p>
      <div className="peek-actions">
        <button className="chip" onClick={readFromHere}><Icon.Play /> Read from here</button>
        <button className="chip" onClick={() => leave(r.start, opts)}>Go there and stop</button>
      </div>
    </dialog>
  );
}
