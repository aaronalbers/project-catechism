import { useState } from 'react';
import { useStore } from '@/app/store';
import { VIDEO_SERIES, VIDEOS, videosFor } from '@/lib/content';
import { RefChip } from '@/components/SourceList';
import type { Video } from '@/lib/types';

/** Click-to-load: no YouTube cookies/requests until the viewer opts in. */
function VideoEmbed({ v }: { v: Video }) {
  const [on, setOn] = useState(false);
  if (v.provider !== 'youtube' || !v.videoId) {
    return (
      <a className="video external" href={v.url} target="_blank" rel="noreferrer">
        <span>Watch on bibleproject.com</span>
        <small>Published on BibleProject's own site, not on YouTube</small>
      </a>
    );
  }
  return (
    <div className="video">
      {on ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0`} title={v.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : (
        <button className="playbtn" onClick={() => setOn(true)} aria-label={`Play ${v.title}`}>
          <img className="poster" src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} alt="" loading="lazy" />
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14.5v-9l7 4.5-7 4.5z" /></svg>
        </button>
      )}
    </div>
  );
}

function duration(s?: number) {
  if (!s) return null;
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const MAX_CHIPS = 6;

export function VideoCard({ v }: { v: Video }) {
  const verses = v.verses ?? [];
  return (
    <div className="card">
      <h3>{v.title}</h3>
      <div className="verses">
        <span className="badge kind">{v.series}</span>
        {duration(v.duration) && <span className="badge kind">{duration(v.duration)}</span>}
        {verses.slice(0, MAX_CHIPS).map((r) => <RefChip key={r} r={r} />)}
        {verses.length > MAX_CHIPS && <span className="chip">+{verses.length - MAX_CHIPS} more</span>}
      </div>
      <VideoEmbed v={v} />
      {v.summary && <p className="summary">{v.summary}</p>}
      <div className="sources"><ol><li>
        <span className="skind">Video</span>
        {v.provider === 'youtube'
          ? <><a href={v.url} target="_blank" rel="noreferrer">Watch on YouTube</a> — © {v.channel}, embedded under YouTube's terms</>
          : <>© {v.channel}</>}
        {v.page && v.page !== v.url && <> · <a href={v.page} target="_blank" rel="noreferrer">bibleproject.com</a></>}
        ; not affiliated with this project.
      </li></ol></div>
    </div>
  );
}

/** One collapsible series; its cards only mount (and fetch posters) once opened. */
function SeriesGroup({ series, videos, forceOpen }: { series: string; videos: Video[]; forceOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const shown = open || forceOpen;
  return (
    <details className="video-series" open={shown} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>{series} <span className="count">{videos.length}</span></summary>
      {shown && videos.map((v) => <VideoCard key={v.id} v={v} />)}
    </details>
  );
}

function Library() {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const groups = needle
    ? VIDEO_SERIES.map((g) => ({ ...g, videos: g.videos.filter((v) => `${v.title} ${v.summary ?? ''} ${v.series}`.toLowerCase().includes(needle)) })).filter((g) => g.videos.length)
    : VIDEO_SERIES;
  return (
    <>
      <div className="panel-title">All BibleProject videos ({VIDEOS.length})</div>
      <input className="video-search" type="search" placeholder="Search titles, e.g. “khesed” or “Sabbath”" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map((g) => <SeriesGroup key={g.series} series={g.series} videos={g.videos} forceOpen={!!needle} />)}
      {needle && groups.length === 0 && <div className="empty"><p>No videos match “{q}”.</p></div>}
    </>
  );
}

export function VideosPanel() {
  const loc = useStore((s) => s.loc);
  const list = videosFor(loc);
  return (
    <div className="panel-body">
      {list.length === 0 && <div className="empty"><p>No videos linked to this passage yet.</p><small>Browse the full library below, or add entries to <code>content/videos.json</code>.</small></div>}
      {list.length > 0 && <div className="panel-title">For this passage ({list.length})</div>}
      {list.map((v) => <VideoCard key={v.id} v={v} />)}
      <hr />
      <Library />
    </div>
  );
}
