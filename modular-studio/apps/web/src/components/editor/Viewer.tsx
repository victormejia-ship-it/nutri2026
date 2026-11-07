'use client';
import { useMemo, useState } from 'react';
import { DEFAULT_CATALOG, type ProjectCalculation, type Project } from '@ms/domain';
import { buildScene, sceneToSvg, type ViewKind } from '@ms/geometry';
import { Button } from '../ui';

export function Viewer({ project, calc, selected, onSelect }: { project: Project; calc: ProjectCalculation; selected: string | null; onSelect: (id: string | null) => void }) {
  const [view, setView] = useState<ViewKind>('iso');
  const [exploded, setExploded] = useState(false);
  const [showIds, setShowIds] = useState(false);
  const [hideFronts, setHideFronts] = useState(false);
  const scene = useMemo(() => buildScene(project, calc, DEFAULT_CATALOG, { view, exploded, showIds, hideFronts, selectedPartId: selected }), [project, calc, view, exploded, showIds, hideFronts, selected]);
  const views: { v: ViewKind; label: string }[] = [{ v: 'iso', label: 'Isométrico' }, { v: 'front', label: 'Frente' }, { v: 'side', label: 'Lateral' }, { v: 'top', label: 'Planta' }];

  function downloadSvg() {
    const blob = new Blob([sceneToSvg(scene, 'light')], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.id}-${view}${exploded ? '-despiece' : ''}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div role="radiogroup" aria-label="Vista" className="flex gap-1">
          {views.map((x) => (
            <button key={x.v} type="button" role="radio" aria-checked={view === x.v} onClick={() => setView(x.v)}
              className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${view === x.v ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}>{x.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={exploded} onChange={(e) => setExploded(e.target.checked)} data-testid="toggle-exploded" />Despiece separado</label>
        <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} />IDs de pieza</label>
        <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={hideFronts} onChange={(e) => setHideFronts(e.target.checked)} />Ocultar frentes</label>
        <Button variant="secondary" onClick={downloadSvg}>Descargar SVG de esta vista</Button>
      </div>
      <div className="overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,#304555,#14202a_75%)]">
        <svg viewBox={`0 0 ${scene.width} ${scene.height}`} className="h-auto w-full max-h-[620px]" role="img" aria-label={scene.ariaLabel} data-testid="model-svg" fontFamily="Inter, system-ui, sans-serif">
          <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#ffbe66" strokeWidth="1.2" /></marker></defs>
          {scene.polygons.map((p) => (
            <polygon key={p.key} data-part-id={p.partId} points={p.points.map((x) => x.join(',')).join(' ')} fill={p.fill} stroke={p.stroke} strokeWidth={p.selected ? 2.4 : 1} strokeLinejoin="round"
              className="cursor-pointer" onClick={() => onSelect(p.partId === selected ? null : p.partId)}>
              <title>{p.partId}</title>
            </polygon>
          ))}
          {scene.lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#ffbe66" strokeWidth={1.3} markerStart="url(#arrow)" markerEnd="url(#arrow)" />)}
          {scene.labels.map((t, i) => (
            <text key={i} x={t.x} y={t.y} textAnchor={t.anchor}
              {...(t.kind === 'title' ? { fontSize: 17, fill: '#a7dae4', fontWeight: 700 } : t.kind === 'subtitle' ? { fontSize: 12, fill: '#c8d3df' } : t.kind === 'dim' ? { fontSize: 14, fill: '#ffe0a9', fontWeight: 700, stroke: '#17202a', strokeWidth: 3.5, paintOrder: 'stroke' } : { fontSize: 10.5, fill: '#fff', stroke: '#0b1218', strokeWidth: 3, paintOrder: 'stroke', pointerEvents: 'none' })}>
              {t.text}
            </text>
          ))}
        </svg>
      </div>
      <p className="text-[11.5px] text-muted">Proyección esquemática derivada de las mismas posiciones del despiece (cada polígono es una pieza del BOM; clic para seleccionar). No es render fotorrealista, CAD 3D ni plano CNC.{selected ? ` Seleccionada: ${selected}.` : ''}</p>
    </div>
  );
}
