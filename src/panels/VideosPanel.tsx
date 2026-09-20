import { useState } from 'react';
import { useStore } from '@/app/store';
import { videosFor } from '@/lib/content';
import { RefChip } from '@/components/SourceList';
import type { Video } from '@/lib/types';

/** Click-to-load: no YouTube cookies/requests until the viewer opts in. */
function VideoEmbed({ v }: { v: Video }) {
  const [on, setOn] = useState(false);
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

export function VideosPanel() {
  const loc = useStore((s) => s.loc);
  const list = videosFor(loc);
  return (
    <div className="panel-body">
      {list.length === 0 && <div className="empty"><p>No videos linked to this passage yet.</p><small>Add entries to <code>content/videos.json</code>.</small></div>}
      {list.map((v) => (
        <div className="card" key={v.id}>
          <h3>{v.title}</h3>
          <div className="verses"><span className="badge kind">{v.channel}</span>{v.verses?.map((r) => <RefChip key={r} r={r} />)}</div>
          <VideoEmbed v={v} />
          {v.summary && <p className="summary">{v.summary}</p>}
          <div className="sources"><ol><li><span className="skind">Video</span><a href={v.url} target="_blank" rel="noreferrer">Watch on YouTube</a> — © {v.channel}, embedded under YouTube's terms; not affiliated with this project.</li></ol></div>
        </div>
      ))}
    </div>
  );
}
