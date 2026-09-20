import { goTo } from '@/app/store';
import { formatRef, parseRef } from '@/lib/refs';
import type { Confidence, Media, Source } from '@/lib/types';
import { Icon } from './Icons';

export function RefChip({ r }: { r: string }) {
  const parsed = parseRef(r);
  return (
    <button className="chip link" onClick={(e) => { e.stopPropagation(); if (parsed) goTo(parsed.start); }} title={`Go to ${formatRef(r)}`}>
      {formatRef(r)}
    </button>
  );
}

const KIND_LABEL: Record<Source['kind'], string> = {
  scripture: 'Scripture', archaeology: 'Archaeology', primary: 'Primary source', scholarship: 'Scholarship', lexicon: 'Lexicon', image: 'Image', video: 'Video', data: 'Dataset',
};

export function SourceList({ sources, traditions }: { sources: Source[]; traditions?: string[] }) {
  if (!sources.length && !traditions?.length) return null;
  return (
    <div className="sources">
      {sources.length > 0 && <>
        <h4>Sources</h4>
        <ol>
          {sources.map((s, i) => (
            <li key={i}>
              <span className="skind">{KIND_LABEL[s.kind]}</span>
              {s.kind === 'scripture' && s.ref ? <RefChip r={s.ref} /> : null}
              {s.title && (s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title} <Icon.External /></a> : <span>{s.title}</span>)}
              {s.author && <>, {s.author}</>}
              {s.year && <> ({s.year})</>}
              {s.note && <> — {s.note}</>}
            </li>
          ))}
        </ol>
      </>}
      {traditions && traditions.length > 0 && <div className="traditions"><strong>Held by:</strong> {traditions.join(' · ')}</div>}
    </div>
  );
}

const CONF_LABEL: Record<Confidence, string> = { evidence: 'Evidence', consensus: 'Consensus', interpretation: 'Interpretation', estimate: 'Estimate' };
const CONF_TITLE: Record<Confidence, string> = {
  evidence: 'Directly attested by the text or by physical evidence',
  consensus: 'Broadly agreed among scholars, but reconstructed',
  interpretation: 'One reading among several — see which traditions hold it',
  estimate: 'A guess or approximation — the card says what it is based on',
};
export function ConfidenceBadge({ c }: { c: Confidence }) {
  return <span className={`badge ${c}`} title={CONF_TITLE[c]}>{CONF_LABEL[c]}</span>;
}

export function MediaList({ media }: { media?: Media[] }) {
  if (!media?.length) return null;
  return (
    <>
      {media.filter((m) => m.type === 'image').map((m, i) => (
        <figure className="media" key={i}>
          <img src={m.src} alt={m.caption} loading="lazy" />
          <figcaption>{m.caption}{m.credit && <> — {m.creditUrl ? <a href={m.creditUrl} target="_blank" rel="noreferrer">{m.credit}</a> : m.credit}{m.license && <>, {m.license}</>}</>}</figcaption>
        </figure>
      ))}
    </>
  );
}
