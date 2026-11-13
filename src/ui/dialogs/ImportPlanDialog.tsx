import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { houseContents } from '../../model/footprint';
import { formatLength } from '../../model/units';
import {
  ACCEPTED_TYPES,
  canvasPixels,
  canvasToDataUrl,
  cropRotate,
  detectExtents,
  detectWallRects,
  fileToCanvas,
  rotationFor,
  type NorthOnDrawing,
  type PxRect,
} from '../../import/planImage';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Button, Check, Dialog, Field, LengthInput } from '../fields';

type Corner = 'nw' | 'ne' | 'se' | 'sw';

/** Image with a draggable crop rectangle (coordinates in image pixels). */
function CropEditor({ src, width, height, crop, onChange }: { src: string; width: number; height: number; crop: PxRect; onChange: (c: PxRect) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ corner: Corner | 'move'; start: { x: number; y: number }; crop: PxRect } | null>(null);
  const toImage = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * width, y: ((clientY - r.top) / r.height) * height };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toImage(e.clientX, e.clientY);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    let { x, y, w, h } = d.crop;
    if (d.corner === 'move') {
      x = Math.min(Math.max(0, x + dx), width - w);
      y = Math.min(Math.max(0, y + dy), height - h);
    } else {
      let x1 = x + w;
      let y1 = y + h;
      if (d.corner.includes('w')) x = Math.min(Math.max(0, x + dx), x1 - 10);
      if (d.corner.includes('e')) x1 = Math.max(Math.min(width, x1 + dx), x + 10);
      if (d.corner.includes('n')) y = Math.min(Math.max(0, y + dy), y1 - 10);
      if (d.corner.includes('s')) y1 = Math.max(Math.min(height, y1 + dy), y + 10);
      w = x1 - x;
      h = y1 - y;
    }
    onChange({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  };
  const start = (corner: Corner | 'move') => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { corner, start: toImage(e.clientX, e.clientY), crop };
  };
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div ref={box} className="relative w-full select-none border border-line bg-white" style={{ aspectRatio: `${width} / ${height}`, touchAction: 'none' }} onPointerMove={onMove} onPointerUp={() => (drag.current = null)}>
      <img src={src} alt="Imported drawing" className="absolute inset-0 h-full w-full" draggable={false} />
      <div className="absolute inset-0 bg-black/35" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(crop.x, width)} ${pct(crop.y, height)},${pct(crop.x, width)} ${pct(crop.y + crop.h, height)},${pct(crop.x + crop.w, width)} ${pct(crop.y + crop.h, height)},${pct(crop.x + crop.w, width)} ${pct(crop.y, height)},${pct(crop.x, width)} ${pct(crop.y, height)})` }} />
      <div
        className="absolute cursor-move border-2 border-[#b8860b]"
        style={{ left: pct(crop.x, width), top: pct(crop.y, height), width: pct(crop.w, width), height: pct(crop.h, height) }}
        onPointerDown={start('move')}
        aria-label="Crop area: drag to move"
      >
        {(['nw', 'ne', 'se', 'sw'] as Corner[]).map((c) => (
          <span
            key={c}
            onPointerDown={start(c)}
            className="absolute h-4 w-4 rounded-sm border-2 border-[#b8860b] bg-white"
            style={{ left: c.includes('w') ? -8 : undefined, right: c.includes('e') ? -8 : undefined, top: c.includes('n') ? -8 : undefined, bottom: c.includes('s') ? -8 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }}
            aria-label={`Crop corner ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

export function ImportPlanDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  const placeHousePlan = useProjectStore((s) => s.placeHousePlan);
  const requestFit = useUiStore((s) => s.requestFit);
  const unit = project.settings.unit;
  const floors = [...project.floors].sort((a, b) => a.level - b.level);

  const [name, setName] = useState('');
  const [file, setFile] = useState<Blob | null>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [crop, setCrop] = useState<PxRect | null>(null);
  const [north, setNorth] = useState<NorthOnDrawing>('up');
  const [mirror, setMirror] = useState(false);
  const [w, setW] = useState(project.footprint?.w ?? 0);
  const [d, setD] = useState(project.footprint?.d ?? 0);
  const [floorId, setFloorId] = useState(activeFloorId);
  const [clearOld, setClearOld] = useState(true);
  const [walls, setWalls] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (f: Blob, p: number, label?: string) => {
    setBusy(true);
    setError(null);
    try {
      const { canvas, pages: n } = await fileToCanvas(f, p);
      setFile(f);
      setPages(n);
      setPage(p);
      setSrc(canvas);
      setSrcUrl(canvas.toDataURL('image/png'));
      setCrop(detectExtents(canvasPixels(canvas)) ?? { x: 0, y: 0, w: canvas.width, h: canvas.height });
      if (label) setName(label);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Paste an image from the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) load(f, 1, 'Pasted plan');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [load]);

  const rotation = rotationFor(north);
  const result = useMemo(() => (src && crop ? cropRotate(src, crop, rotation, mirror) : null), [src, crop, rotation, mirror]);
  const resultUrl = useMemo(() => (result ? result.toDataURL('image/png') : ''), [result]);

  const aspectWarning = useMemo(() => {
    if (!result || !w || !d) return null;
    const a1 = result.width / result.height;
    const a2 = w / d;
    const diff = Math.abs(a1 / a2 - 1);
    return diff > 0.06 ? `The cropped drawing’s proportions differ from ${formatLength(w, unit)} × ${formatLength(d, unit)} by ${Math.round(diff * 100)}%. Check the crop corners sit on the outer walls, and the size and north direction.` : null;
  }, [result, w, d, unit]);

  const targetFloor = floors.find((f) => f.id === floorId);
  const existing = useMemo(() => {
    if (!targetFloor || !project.footprint) return 0;
    const inside = houseContents({ ...project, floors: [targetFloor] }, project.footprint);
    return inside.rooms.size + inside.walls.size;
  }, [project, targetFloor]);

  const place = () => {
    if (!result || !w || !d) return;
    setBusy(true);
    try {
      const rects = walls ? detectWallRects(canvasPixels(result), w, d) : [];
      placeHousePlan({ floorId, name: name || 'Imported plan', dataUrl: canvasToDataUrl(result), w, d, clearOld, wallRects: rects });
      requestFit();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const fromUrl = async () => {
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`The address returned ${res.status}.`);
      const blob = await res.blob();
      await load(blob, 1, url.split('/').pop() || 'Plan from web');
    } catch {
      setError('That address could not be loaded here — many websites block this. Save the picture or PDF to your device, then choose it with “Choose file”.');
    }
  };

  return (
    <Dialog title="Import a house plan drawing" onClose={onClose} wide>
      {!src ? (
        <div
          className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-line px-4 py-10 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) load(f, 1, f.name.replace(/\.[^.]+$/, ''));
          }}
        >
          <p className="max-w-prose text-sm text-ink-soft">
            Choose a picture (PNG, JPG, WebP) or a PDF of a house plan, drop it here, or paste a copied image with Ctrl+V.
            The drawing is placed inside your house outline; the plot, roads and setbacks stay as they are.
          </p>
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Reading…' : 'Choose file'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f, 1, f.name.replace(/\.[^.]+$/, ''));
              e.target.value = '';
            }}
          />
          <div className="flex w-full max-w-md gap-1.5">
            <input
              className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
              placeholder="or a web address of a picture or PDF"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Web address"
            />
            <Button onClick={fromUrl} disabled={!url.trim() || busy}>
              Load
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[1fr_17rem]">
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">
              1. Drag the orange corners onto the <b>outer corners of the walls</b> (they were found automatically — check them).
            </p>
            {crop && <CropEditor src={srcUrl} width={src.width} height={src.height} crop={crop} onChange={setCrop} />}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {pages > 1 && (
                <label className="flex items-center gap-1">
                  PDF page
                  <select className="rounded border border-line bg-panel px-1 py-0.5" value={page} onChange={(e) => file && load(file, Number(e.target.value))}>
                    {Array.from({ length: pages }, (_, i) => (
                      <option key={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </label>
              )}
              <Button onClick={() => setCrop(detectExtents(canvasPixels(src)) ?? crop)}>Find walls again</Button>
              <Button onClick={() => setCrop({ x: 0, y: 0, w: src.width, h: src.height })}>Use whole picture</Button>
              <Button
                onClick={() => {
                  setSrc(null);
                  setFile(null);
                }}
              >
                Choose another file
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm text-ink-soft">2. Which way does north point on this drawing?</p>
              <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="North on the drawing">
                {(['up', 'right', 'down', 'left'] as NorthOnDrawing[]).map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={north === n}
                    onClick={() => setNorth(n)}
                    className={`rounded-md border px-1 py-1.5 text-xs ${north === n ? 'border-ochre bg-ochre-soft' : 'border-line'}`}
                  >
                    <span className="block text-base" style={{ transform: `rotate(${{ up: 0, right: 90, down: 180, left: 270 }[n]}deg)` }}>↑</span>
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1.5">
                <Check checked={mirror} onChange={setMirror} label="Mirror the drawing (east and west swapped)" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm text-ink-soft">3. House size shown by the drawing (after turning north up)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Width (east–west)">
                  <LengthInput valueMm={w} unit={unit} min={1000} onCommit={setW} ariaLabel="Plan width" />
                </Field>
                <Field label="Depth (north–south)">
                  <LengthInput valueMm={d} unit={unit} min={1000} onCommit={setD} ariaLabel="Plan depth" />
                </Field>
              </div>
            </div>
            {resultUrl && (
              <div>
                <p className="mb-1 text-xs text-muted">Preview, north up</p>
                <img src={resultUrl} alt="Cropped drawing with north up" className="max-h-44 border border-line bg-white" />
              </div>
            )}
            {aspectWarning && <p className="text-xs text-warn">{aspectWarning}</p>}
            <Field label="Put it on">
              <select className="w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm" value={floorId} onChange={(e) => setFloorId(e.target.value)}>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Check checked={clearOld} onChange={setClearOld} label={`Replace the current plan inside the house outline${existing ? ` (${existing} rooms/walls)` : ''}`} />
            <Check checked={walls} onChange={setWalls} label="Also create walls from the drawing (automatic — check them)" />
            <p className="text-xs text-muted">
              The plot, roads, setbacks, garden and compound wall are not changed. The house outline takes this size
              {project.footprint ? ', keeping its position' : ', centred in the buildable area'}. Undo reverses it.
            </p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button variant="primary" onClick={place} disabled={!w || !d || busy} className="w-full">
              {busy ? 'Placing…' : 'Place in my plot'}
            </Button>
            {(!w || !d) && <p className="text-xs text-warn">Enter the house width and depth first.</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
