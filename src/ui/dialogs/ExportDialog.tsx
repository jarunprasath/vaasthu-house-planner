import { useState } from 'react';
import type Konva from 'konva';
import { PAPER_MM, SCALES, type PaperSize } from '../../export/paper';
import { downloadBlob, FILE_EXTENSION, safeFileName, serializeProject } from '../../storage/projectFile';
import { useProjectStore } from '../../store/projectStore';
import { Button, Check, Dialog, Field, NumberInput, Select, TextInput } from '../fields';

export function ExportDialog({ onClose, stageRef }: { onClose: () => void; stageRef: React.RefObject<Konva.Stage | null> }) {
  const project = useProjectStore((s) => s.project);
  const commit = useProjectStore((s) => s.commit);
  const floors = [...project.floors].sort((a, b) => a.level - b.level);
  const [paper, setPaper] = useState<PaperSize>('a3');
  const [scale, setScale] = useState('0');
  const [includeSite, setIncludeSite] = useState(true);
  const [includeSchedule, setIncludeSchedule] = useState(true);
  const [floorIds, setFloorIds] = useState<string[]>(floors.map((f) => f.id));
  const [preparedBy, setPreparedBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const base = safeFileName(project.name);

  const [busy, setBusy] = useState(false);
  const pdf = async () => {
    setError(null);
    setBusy(true);
    try {
      const { exportPdf } = await import('../../export/pdf');
      exportPdf(
        project,
        { paper, scale: Number(scale), includeSite, includeSchedule, floorIds, revision: project.revision, preparedBy },
        `${base}_R${project.revision}.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const png = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const url = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
    fetch(url)
      .then((r) => r.blob())
      .then((b) => downloadBlob(b, `${base}_view.png`));
  };

  const json = () => downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${base}${FILE_EXTENSION}`);

  return (
    <Dialog title="Export & print" onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <div className="space-y-3">
          <h3 className="text-sm font-bold">PDF drawing set</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Paper (landscape)">
              <Select<PaperSize>
                value={paper}
                onChange={setPaper}
                options={(Object.keys(PAPER_MM) as PaperSize[]).map((p) => ({
                  value: p,
                  label: `${p.toUpperCase()} — ${PAPER_MM[p].w} × ${PAPER_MM[p].h} mm`,
                }))}
              />
            </Field>
            <Field label="Scale">
              <Select
                value={scale}
                onChange={setScale}
                options={[{ value: '0', label: 'Largest that fits' }, ...SCALES.map((s) => ({ value: String(s), label: `1:${s}` }))]}
              />
            </Field>
            <Field label="Revision">
              <NumberInput
                value={project.revision}
                min={1}
                onCommit={(v) =>
                  commit((d) => {
                    d.revision = Math.round(v);
                  })
                }
              />
            </Field>
            <Field label="Prepared by (optional)">
              <TextInput value={preparedBy} onCommit={setPreparedBy} />
            </Field>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted">Pages</p>
            <Check checked={includeSite} onChange={setIncludeSite} label="Site plan" />
            {floors.map((f) => (
              <Check
                key={f.id}
                checked={floorIds.includes(f.id)}
                onChange={(on) => setFloorIds((ids) => (on ? [...ids, f.id] : ids.filter((x) => x !== f.id)))}
                label={`${f.name} plan`}
              />
            ))}
            <Check checked={includeSchedule} onChange={setIncludeSchedule} label="Door/window schedule and area statement" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={pdf} disabled={busy}>
            {busy ? 'Preparing PDF…' : 'Download PDF'}
          </Button>
          <p className="text-xs text-muted">
            Every page carries a title block and is marked “Preliminary — not for construction”. Print the PDF at 100% (no
            “fit to page”) for the stated scale to hold. Room names are printed in Latin script only for now.
          </p>
        </div>
        <div className="space-y-4 border-line md:border-l md:pl-5">
          <div>
            <h3 className="mb-1 text-sm font-bold">Image</h3>
            <p className="mb-2 text-xs text-muted">The plan as currently shown on screen, at double resolution.</p>
            <Button onClick={png}>Download PNG</Button>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold">Project file</h3>
            <p className="mb-2 text-xs text-muted">An editable backup you can open again with Projects → Open project file.</p>
            <Button onClick={json}>Download project file</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
