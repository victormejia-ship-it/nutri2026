'use client';
import { useMemo, useState } from 'react';
import { DEFAULT_CATALOG, assemblySteps, catalogLookup, mermaidDiagram, type ManufacturingPlan, type Project } from '@ms/domain';
import { cutSheetSvg } from '@ms/geometry';
import { Alert, Badge, Button, EmptyState, Stat } from '../ui';
import { NumberInput } from './inputs';

const L = catalogLookup(DEFAULT_CATALOG);
const vTone = (s: string) => (s === 'verified' ? 'ok' : s === 'blocked' ? 'err' : 'warn') as 'ok' | 'err' | 'warn';
const vLabel: Record<string, string> = { verified: 'Verificado', pending_validation: 'Pendiente validación', blocked: 'Bloqueado' };

export function PartsTab({ plan, selected, onSelect }: { plan: ManufacturingPlan; selected: string | null; onSelect: (id: string | null) => void }) {
  const { calc } = plan;
  if (!calc.parts.length) return <EmptyState title="Sin piezas">Corrija los errores del módulo para generar el despiece.</EmptyState>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Stat label="Piezas totales" value={<span data-testid="stat-pieces">{calc.totals.panelCount}</span>} />
        <Stat label="Modelos de corte" value={calc.totals.partModels} />
        <Stat label="Área de tablero" value={`${calc.totals.panelAreaM2} m²`} />
        {calc.edgeBands.map((e) => <Stat key={e.edgeBandId} label={`Canto ${L.edgeBand(e.edgeBandId).name}`} value={`${(e.netLengthMm / 1000).toFixed(2)} m neto · ${(e.purchaseLengthMm / 1000).toFixed(2)} m compra`} />)}
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table data-testid="parts-table">
          <thead><tr><th>ID</th><th>Pieza</th><th className="num">Cant.</th><th className="num">Largo</th><th className="num">Ancho</th><th className="num">Esp.</th><th>Veta</th><th>L1</th><th>L2</th><th>A1</th><th>A2</th><th>Material</th><th>Acabado</th><th>Estado</th><th className="num">Mec.</th><th>Observaciones</th></tr></thead>
          <tbody>
            {calc.parts.map((p) => (
              <tr key={p.id} onClick={() => onSelect(p.id === selected ? null : p.id)} className={`cursor-pointer ${p.id === selected ? 'bg-[#2b4252]' : 'hover:bg-[#1f2d39]'}`} aria-selected={p.id === selected}>
                <td className="font-mono text-[11px]">{p.id}</td><td>{p.name}</td><td className="num">{p.quantity}</td>
                <td className="num">{p.lengthMm}</td><td className="num">{p.widthMm}</td><td className="num">{p.thicknessMm}</td><td>{p.grainAxis === 'length' ? 'Largo' : p.grainAxis === 'width' ? 'Ancho' : '—'}</td>
                {(['L1', 'L2', 'A1', 'A2'] as const).map((e) => <td key={e}>{p.edgeBand[e] ? '●' : '○'}</td>)}
                <td>{L.material(p.materialId).name}</td><td>{L.finish(p.finishId).name}</td>
                <td><Badge tone={vTone(p.validationStatus)}>{vLabel[p.validationStatus]}</Badge></td>
                <td className="num">{p.machiningOperationIds.length}</td>
                <td className="max-w-[260px] whitespace-normal text-[11px] text-muted">{p.notes.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-muted">Medidas nominales de corte antes de tapacanto (sin compensación). L1/L2 = aristas del largo; A1/A2 = aristas del ancho; ● con canto.</p>
    </div>
  );
}

export function CutTab({ plan, project, onCut }: { plan: ManufacturingPlan; project: Project; onCut: (c: Project['cut']) => void }) {
  return (
    <div className="grid gap-4">
      <div className="grid max-w-md grid-cols-2 gap-2">
        <NumberInput label="Kerf (disco)" suffix="mm" value={project.cut.kerfMm} min={0} max={10} step={0.1} onChange={(v) => onCut({ ...project.cut, kerfMm: v })} />
        <NumberInput label="Escuadrado por lado" suffix="mm" value={project.cut.trimMarginMm} min={0} max={50} onChange={(v) => onCut({ ...project.cut, trimMarginMm: v })} />
      </div>
      {plan.nesting.map((n) => (
        <section key={n.materialId} className="grid gap-2 rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{n.materialName}</h3>
            {n.sheetsRequired !== null ? <Badge tone="ok">layout_factible · {n.sheetsRequired} tablero(s)</Badge> : <Badge tone="warn">sin confirmar</Badge>}
            <Badge tone="neutral" title="Una estimación por área nunca confirma el número de tableros">Estimación por área: {n.areaEstimate.sheetsEstimated} (estimacion_area_no_validada)</Badge>
          </div>
          <p className="text-[12px] text-muted">{n.note}</p>
          {n.layout?.unplaced.length ? <Alert tone="err">Sin acomodo: {n.layout.unplaced.map((u) => `${u.partId}#${u.instance} (${u.reason})`).join('; ')}</Alert> : null}
          <div className="grid gap-3 xl:grid-cols-2">
            {n.layout?.sheets.map((s) => (
              <div key={s.index} className="overflow-auto rounded-lg bg-white" dangerouslySetInnerHTML={{ __html: cutSheetSvg({ materialName: n.materialName, sheet: n.layout!.sheet, index: s.index, utilization: s.utilization, placements: s.placements }, 820, true) }} />
            ))}
          </div>
        </section>
      ))}
      <p className="text-[11.5px] text-muted">Optimizador guillotina (Best Short Side Fit) con kerf, escuadrado y veta. No considera defectos, retazos en inventario ni secuencia de seccionadora: validar en el optimizador del taller.</p>
    </div>
  );
}

export function HardwareTab({ plan }: { plan: ManufacturingPlan }) {
  const { calc, steel } = plan;
  return (
    <div className="grid gap-4">
      <Alert tone="warn">Cantidades orientativas derivadas de la geometría. Bisagras, correderas, conectores y anclajes requieren SKU con ficha técnica para quedar verificados; nunca se perfora con cotas genéricas.</Alert>
      <div className="max-h-[420px] overflow-auto">
        <table data-testid="hardware-table">
          <thead><tr><th>Módulo</th><th>Tipo</th><th>Descripción</th><th className="num">Cant.</th><th>Unidad</th><th>Regla</th><th>Estado</th></tr></thead>
          <tbody>{calc.hardware.map((h) => (
            <tr key={h.id}><td>{h.moduleId}</td><td>{h.category}</td><td>{h.description}</td><td className="num">{h.quantity}</td><td>{h.unit}</td><td className="max-w-[320px] whitespace-normal text-[11px] text-muted">{h.basis}</td><td><Badge tone={vTone(h.validationStatus)}>{vLabel[h.validationStatus]}</Badge></td></tr>
          ))}</tbody>
        </table>
      </div>
      <h3 className="font-semibold">Herrería</h3>
      {steel.length === 0 ? <p className="text-[12.5px] text-muted">Sin herrería. Active «Bastidor PTR» en la base o la estructura de escritorio.</p> : (
        <>
          <Alert tone="err">Herrería estructural: requiere validación de cargas, soldadura y anclajes por responsable estructural. La liberación queda bloqueada sin evidencia.</Alert>
          {steel.map((s) => (
            <div key={s.profileId} className="rounded-xl border border-line p-3 text-[12.5px]">
              <p className="font-semibold">{s.profileName}: {s.layout.bars.length} barra(s) de {s.layout.barLengthMm / 1000} m · corte total {(s.layout.totalCutLengthMm / 1000).toFixed(2)} m · masa {s.massKg === null ? 'no calculada (kg/m pendiente de ficha)' : `${s.massKg} kg`}</p>
              <ul className="mt-1 list-disc pl-5">{s.layout.bars.map((b) => <li key={b.index}>Barra {b.index}: {b.cuts.map((c) => `${c.label} ${c.lengthMm}`).join(' + ')} mm · sobrante {b.remainderMm} mm</li>)}</ul>
            </div>
          ))}
          <table>
            <thead><tr><th>Módulo</th><th>Pieza</th><th>Sección</th><th className="num">Largo (mm)</th><th className="num">Cant.</th><th>Acabado</th></tr></thead>
            <tbody>{calc.steel.flatMap((r) => r.pieces.map((p) => <tr key={p.id}><td>{r.moduleId}</td><td>{p.label}</td><td>{r.sectionSpec}</td><td className="num">{p.lengthMm}</td><td className="num">{p.count}</td><td>{r.finish}</td></tr>))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function MachiningTab({ plan }: { plan: ManufacturingPlan }) {
  const ops = plan.calc.machining;
  const pending = ops.filter((o) => o.validationStatus !== 'verified').length;
  return (
    <div className="grid gap-3">
      <Alert tone={pending ? 'warn' : 'ok'}>{ops.length} operaciones; {pending} pendientes de ficha técnica. Las operaciones pendientes no tienen coordenadas: no se afirman cotas sin ficha del fabricante.</Alert>
      <div className="grid gap-2 md:grid-cols-2">
        {DEFAULT_CATALOG.machiningPatterns.map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-panel-2 p-3 text-[12.5px]">
            <div className="flex justify-between gap-2"><span className="font-semibold">{p.name}</span><Badge tone={vTone(p.validationStatus)}>{vLabel[p.validationStatus]}</Badge></div>
            <p className="text-muted">Ficha: {p.technicalDatasheetUrl ?? 'no asociada'} · barrenos definidos: {p.holes.length} · remanente mínimo {p.minRemainingMm} mm</p>
          </div>
        ))}
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table>
          <thead><tr><th>ID</th><th>Pieza</th><th>Patrón</th><th className="num">X</th><th className="num">Y</th><th className="num">Ø</th><th className="num">Prof.</th><th>Estado</th><th>Descripción</th></tr></thead>
          <tbody>{ops.map((o) => (
            <tr key={o.id}><td className="font-mono text-[11px]">{o.id}</td><td>{o.partId}</td><td>{o.patternId}</td><td className="num">{o.xMm ?? '—'}</td><td className="num">{o.yMm ?? '—'}</td><td className="num">{o.diameterMm ?? '—'}</td><td className="num">{o.depthMm ?? '—'}</td><td><Badge tone={vTone(o.validationStatus)}>{vLabel[o.validationStatus]}</Badge></td><td className="text-[11px] text-muted">{o.description}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-muted">Para generar coordenadas, capture el patrón desde la ficha técnica del SKU (packages/domain/src/catalog/hardware.ts) con estado «verified». El motor valida salida de broca y traslape de barrenos. No se generan programas CNC.</p>
    </div>
  );
}

export function AssemblyTab({ plan, project }: { plan: ManufacturingPlan; project: Project }) {
  const code = useMemo(() => mermaidDiagram(project, plan.calc), [project, plan.calc]);
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4">
      {project.modules.map((m) => (
        <section key={m.id}>
          <h3 className="mb-1 font-semibold">{m.id} · {m.label}</h3>
          <ol className="list-decimal space-y-1 pl-6 text-[13px]">
            {assemblySteps(m, plan.calc).map((s) => (
              <li key={s.id}><span className="font-semibold">{s.title}</span>{s.pending && <> <Badge tone="warn">pendiente de validación</Badge></>} — <span className="text-muted">{s.detail}</span></li>
            ))}
          </ol>
        </section>
      ))}
      <section>
        <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">Mermaid · diagrama de dependencias</h3>
          <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copiado' : 'Copiar Mermaid'}</Button></div>
        <pre data-testid="mermaid-code" className="max-h-[360px]">{code}</pre>
        <p className="mt-1 text-[11.5px] text-muted">Sintaxis lista para Mermaid.js o cualquier visor compatible (no se carga la librería en la app para mantenerla ligera).</p>
      </section>
    </div>
  );
}
