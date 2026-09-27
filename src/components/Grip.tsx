import { useRef } from 'react';

/**
 * A handle dragged to resize. `onDrag` gets the pointer's travel in px along the axis since the drag
 * began, with `done` false while dragging and true on release: a caller moves the DOM directly while
 * dragging (so heavy panels do not re-render on every move) and commits to the store when done.
 */
export function Grip({ axis, onDrag, onReset, label }: { axis: 'x' | 'y'; onDrag: (d: number, done: boolean) => void; onReset?: () => void; label: string }) {
  const start = useRef<number | null>(null);
  const at = (e: React.PointerEvent) => (axis === 'x' ? e.clientX : e.clientY);
  const end = (e: React.PointerEvent) => {
    if (start.current === null) return;
    onDrag(at(e) - start.current, true);
    start.current = null;
    document.body.classList.remove('resizing', 'resizing-x', 'resizing-y');
  };
  return (
    <div className={`grip grip-${axis}`} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} aria-label={label} title={`${label} (double-click to reset)`}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); start.current = at(e); document.body.classList.add('resizing', `resizing-${axis}`); }}
      onPointerMove={(e) => { if (start.current !== null) onDrag(at(e) - start.current, false); }}
      onPointerUp={end} onPointerCancel={end}
      onDoubleClick={onReset} />
  );
}
