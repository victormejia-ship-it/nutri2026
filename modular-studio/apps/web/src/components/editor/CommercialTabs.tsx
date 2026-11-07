'use client';
import { useState } from 'react';
import {
  QC_CHECKLIST, SUPPLIERS, diagonalChecks, evaluateOffers, formatMXN,
  type ManufacturingPlan, type PricingSettings, type Project, type ProjectRevisionRecord, type SupplierOffer,
} from '@ms/domain';
import { api, errorMessage } from '@/lib/api';
import { IS_FIREBASE, getDataClient, type ExportFormat } from '@/lib/data';
import { Alert, Badge, Button, EmptyState, Stat, quoteTone, releaseLabel, releaseTone, severityLabel, severityTone } from '../ui';
import { PRICE_STATUS_TONE } from '../Suppliers';
import { MoneyInput, NumberInput, SelectInput } from './inputs';

const supplierName = (id: string | null) => SUPPLIERS.find((s) => s.id === id)?.name ?? id ?? '—';

export function OffersTab({ plan, project, offers, today, onPricing }: { plan: ManufacturingPlan; project: Project; offers: SupplierOffer[]; today: string; onPricing: (p: PricingSettings) => void }) {
  const p = project.pricing;
  const lines = plan.quote.lines.filter((l) => l.category !== 'service');
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={p.allowEstimatedPrices} onChange={(e) => onPricing({ ...p, allowEstimatedPrices: e.target.checked })} data-testid="allow-estimates" />
        Permitir precios ESTIMADOS en selección automática (la cotización quedará como SIMULACIÓN)
      </label>
      {lines.map((l) => {
        const evals = evaluateOffers({ key: l.key, quantity: l.requiredQuantity }, offers, today, p.allowEstimatedPrices);
        const sel = p.selectedOffers[l.key] ?? '';
        return (
          <section key={l.key} className="rounded-xl border border-line p-3" data-testid={`req-${l.key}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><span className="font-semibold">{l.description}</span> <span className="text-muted">· {l.requiredQuantity} {l.requiredUnit} · <code className="text-[11px]">{l.key}</code></span></div>
              <Badge tone={l.status === 'PRICED' ? 'ok' : l.status === 'ESTIMATED' ? 'info' : 'warn'}>{l.status === 'PRICED' ? `${formatMXN(l.lineNetCents)} neto` : l.status === 'ESTIMATED' ? `Estimado ${formatMXN(l.lineNetCents)}` : 'Precio pendiente'}</Badge>
            </div>
            {evals.length === 0 ? <p className="mt-1 text-[12px] text-muted">Sin ofertas para esta clave. Registre una cotización en «Proveedores y precios».</p> : (
              <fieldset className="mt-2">
                <legend className="sr-only">Oferta para {l.description}</legend>
                <table>
                  <thead><tr><th></th><th>Proveedor</th><th>SKU</th><th className="num">Presentación</th><th className="num">Neto/presentación</th><th className="num">Compra</th><th className="num">Costo aterrizado</th><th>Estado</th><th>Motivo</th></tr></thead>
                  <tbody>
                    <tr><td><input type="radio" name={`sel-${l.key}`} checked={sel === ''} onChange={() => { const s = { ...p.selectedOffers }; delete s[l.key]; onPricing({ ...p, selectedOffers: s }); }} aria-label="Selección automática" /></td><td colSpan={8} className="text-muted">Automático: la oferta utilizable de menor costo neto</td></tr>
                    {evals.map((e) => (
                      <tr key={e.offer.id} className={e.usable ? '' : 'opacity-70'}>
                        <td><input type="radio" name={`sel-${l.key}`} checked={sel === e.offer.id} onChange={() => onPricing({ ...p, selectedOffers: { ...p.selectedOffers, [l.key]: e.offer.id } })} aria-label={`Elegir ${e.offer.sku} de ${supplierName(e.offer.supplierId)}`} data-testid={`offer-${e.offer.id}`} /></td>
                        <td>{supplierName(e.offer.supplierId)}</td><td>{e.offer.sku}</td><td className="num">{e.offer.packQuantity} / {e.offer.purchaseUnit}</td>
                        <td className="num">{formatMXN(e.netPackCents)}</td><td className="num">{e.purchaseQuantity}</td><td className="num">{formatMXN(e.landedNetCents)}</td>
                        <td><Badge tone={PRICE_STATUS_TONE[e.offer.priceStatus]}>{e.offer.priceStatus}</Badge></td>
                        <td className="text-[11px] text-muted">{e.reason ?? 'Utilizable'}{e.offer.verifiedAt ? ` · ${e.offer.verifiedAt}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </fieldset>
            )}
          </section>
        );
      })}
      <p className="text-[11.5px] text-muted">Comparación por clave de producto equivalente (misma especificación). Precios normalizados a neto sin IVA según «IVA incluido/excluido»; la compra se redondea a presentaciones completas. Flete y disponibilidad: registrar en notas de la oferta o como costo manual.</p>
    </div>
  );
}

export function QuoteTab({ plan, project, onPricing, saved }: { plan: ManufacturingPlan; project: Project; onPricing: (p: PricingSettings) => void; saved: boolean }) {
  const p = project.pricing;
  const q = plan.quote;
  const [server, setServer] = useState<string | null>(null);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={quoteTone(q.completeness)}><span data-testid="quote-status">{q.completeness}</span></Badge>
        {q.completeness === 'INCOMPLETO' && <span className="text-[12.5px] text-warn">Faltan {q.missingLines.length} precio(s) obligatorio(s); los importes son parciales y no constituyen cotización.</span>}
        {q.completeness === 'SIMULACION' && <span className="text-[12.5px] text-[#bce8f2]">Incluye precios ESTIMADOS: sólo simulación.</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Stat label="Costo directo neto" value={formatMXN(q.directCostNetCents)} />
        <Stat label={p.mode === 'margin' ? `Venta (margen ${p.marginPct} %)` : `Venta (markup ${p.markupPct} %)`} value={<span data-testid="sell-price">{formatMXN(q.sellBeforeTaxCents)}</span>} />
        <Stat label={`IVA ${p.taxRatePct} %`} value={formatMXN(q.taxCents)} />
        <Stat label={q.completeness === 'COMPLETO' ? 'Total' : 'Total parcial'} value={formatMXN(q.totalCents)} />
      </div>
      <div className="grid max-w-3xl grid-cols-2 gap-2 md:grid-cols-4">
        <SelectInput label="Método de precio" value={p.mode} onChange={(v) => onPricing({ ...p, mode: v })} options={[{ value: 'margin', label: 'Margen sobre venta' }, { value: 'markup', label: 'Markup sobre costo' }]} testId="pricing-mode" />
        {p.mode === 'margin'
          ? <NumberInput label="Margen" suffix="%" value={p.marginPct} min={0} max={99.99} step={0.5} onChange={(v) => onPricing({ ...p, marginPct: v })} hint="venta = costo / (1 − margen)" testId="pricing-margin" />
          : <NumberInput label="Markup" suffix="%" value={p.markupPct} min={0} max={1000} step={0.5} onChange={(v) => onPricing({ ...p, markupPct: v })} hint="venta = costo × (1 + markup)" />}
        <NumberInput label="IVA" suffix="%" value={p.taxRatePct} min={0} max={100} onChange={(v) => onPricing({ ...p, taxRatePct: v })} />
        <NumberInput label="Merma de canto" suffix="%" value={p.edgeWastePct} min={0} max={100} onChange={(v) => onPricing({ ...p, edgeWastePct: v })} />
        <NumberInput label="Margen por tramo de canto" suffix="mm" value={p.edgeAllowancePerSegmentMm} min={0} max={200} onChange={(v) => onPricing({ ...p, edgeAllowancePerSegmentMm: v })} />
        <NumberInput label="Merma de herrería" suffix="%" value={p.steelWastePct} min={0} max={100} onChange={(v) => onPricing({ ...p, steelWastePct: v })} />
      </div>
      <section>
        <h3 className="mb-1 font-semibold">Servicios y costos manuales</h3>
        <table>
          <thead><tr><th>Aplica</th><th>Concepto</th><th>Importe (MXN)</th><th>IVA incluido</th></tr></thead>
          <tbody>{p.manualCosts.map((c, i) => {
            const upd = (patch: Partial<typeof c>) => onPricing({ ...p, manualCosts: p.manualCosts.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
            return (
              <tr key={c.key}>
                <td><input type="checkbox" checked={c.applies} onChange={(e) => upd({ applies: e.target.checked })} aria-label={`Aplica ${c.label}`} /></td>
                <td>{c.label}</td>
                <td className="w-40"><MoneyInput label={`Importe ${c.label}`} cents={c.amountCents} onChange={(v) => upd({ amountCents: v })} testId={`cost-${c.key}`} /></td>
                <td><input type="checkbox" checked={c.taxIncluded} onChange={(e) => upd({ taxIncluded: e.target.checked })} aria-label={`IVA incluido en ${c.label}`} /></td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>
      <section className="max-h-[460px] overflow-auto">
        <table data-testid="quote-table">
          <thead><tr><th>Concepto</th><th className="num">Requerido</th><th className="num">Compra</th><th>Proveedor / SKU</th><th className="num">Neto unit.</th><th className="num">Importe neto</th><th>Precio</th><th>Línea</th><th>Notas</th></tr></thead>
          <tbody>{q.lines.filter((l) => l.status !== 'NOT_APPLICABLE').map((l) => (
            <tr key={l.key}>
              <td>{l.description}</td><td className="num">{l.requiredQuantity} {l.requiredUnit}</td><td className="num">{l.purchaseQuantity ?? '—'} {l.purchaseUnit ?? ''}</td>
              <td>{l.supplierId ? `${supplierName(l.supplierId)} · ${l.sku}` : '—'}</td><td className="num">{formatMXN(l.unitNetCents)}</td><td className="num">{formatMXN(l.lineNetCents)}</td>
              <td>{l.priceStatus ? <Badge tone={PRICE_STATUS_TONE[l.priceStatus]}>{l.priceStatus}</Badge> : <Badge tone="neutral">PENDIENTE</Badge>}</td>
              <td><Badge tone={l.status === 'PRICED' ? 'ok' : l.status === 'ESTIMATED' ? 'info' : 'warn'}>{l.status}</Badge></td>
              <td className="max-w-[280px] whitespace-normal text-[11px] text-muted">{l.notes.join(' · ')}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      {q.warnings.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
      {!IS_FIREBASE && <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={!saved} title={saved ? '' : 'Guarde para validar en servidor'} onClick={async () => {
          try {
            const r = await api<{ quote: typeof q }>('/api/quotes', { method: 'POST', json: { projectId: project.id } });
            setServer(r.quote.directCostNetCents === q.directCostNetCents && r.quote.completeness === q.completeness ? `Servidor confirma: ${r.quote.completeness}, costo ${formatMXN(r.quote.directCostNetCents)}.` : `Discrepancia: servidor ${r.quote.completeness} ${formatMXN(r.quote.directCostNetCents)} — guarde y vuelva a calcular.`);
          } catch (e) { setServer(errorMessage(e)); }
        }}>Validar cotización en servidor</Button>
        {server && <span className="text-[12.5px]">{server}</span>}
      </div>}
    </div>
  );
}

export function QualityTab({ plan, project, onProject }: { plan: ManufacturingPlan; project: Project; onProject: (p: Project) => void }) {
  const [moduleFilter, setModuleFilter] = useState('');
  const [appr, setAppr] = useState({ approvedBy: project.approval?.approvedBy ?? '', validationEvidence: project.approval?.validationEvidence ?? '' });
  const issues = plan.calc.issues.filter((i) => !moduleFilter || i.moduleId === moduleFilter);
  const order = { error: 0, blocker: 1, warning: 2, info: 3 } as const;
  const insp = project.inspection;
  const hasErrors = plan.calc.issues.some((i) => i.severity === 'error');
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px]">Estado de liberación:</span>
        <Badge tone={releaseTone(plan.calc.releaseStatus)}><span data-testid="release-status">{releaseLabel[plan.calc.releaseStatus]}</span></Badge>
        {(['error', 'blocker', 'warning', 'info'] as const).map((s) => <Badge key={s} tone={severityTone(s)}>{plan.calc.issues.filter((i) => i.severity === s).length} {severityLabel[s]}</Badge>)}
      </div>
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-semibold">Errores, bloqueos y advertencias</h3>
          <select aria-label="Filtrar por módulo" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="!w-48"><option value="">Todos los módulos</option>{project.modules.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.label}</option>)}</select>
        </div>
        <ul className="grid gap-1.5" data-testid="issues-list">
          {[...issues].sort((a, b) => order[a.severity] - order[b.severity]).map((i, k) => (
            <li key={k} className="flex gap-2 text-[12.5px]"><Badge tone={severityTone(i.severity)}>{severityLabel[i.severity]}</Badge><span><code className="text-[11px] text-muted">{i.code}</code>{i.moduleId ? ` · ${i.moduleId}` : ''} — {i.message}</span></li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Inspección</h3>
        <div className="grid gap-1">
          {QC_CHECKLIST.map((c, i) => (
            <label key={c.id} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={!!insp.checklist[c.id]} onChange={(e) => onProject({ ...project, inspection: { ...insp, checklist: { ...insp.checklist, [c.id]: e.target.checked } } })} />{i + 1}. {c.label}
            </label>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Diagonales de caja</h3>
        <div className="max-w-[200px]"><NumberInput label="Tolerancia de diferencia" suffix="mm" value={insp.diagonalToleranceMm} min={0} max={20} step={0.5} onChange={(v) => onProject({ ...project, inspection: { ...insp, diagonalToleranceMm: v } })} hint="Default editable, no norma" /></div>
        <table className="mt-2">
          <thead><tr><th>Módulo</th><th className="num">Teórica</th><th>Diagonal 1 (mm)</th><th>Diagonal 2 (mm)</th><th className="num">Diferencia</th><th>Resultado</th></tr></thead>
          <tbody>{diagonalChecks(project, plan.calc).map((d) => {
            const set = (k: 'd1Mm' | 'd2Mm', v: string) => {
              const cur = insp.diagonals[d.moduleId] ?? { d1Mm: null, d2Mm: null };
              const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
              onProject({ ...project, inspection: { ...insp, diagonals: { ...insp.diagonals, [d.moduleId]: { ...cur, [k]: n !== null && Number.isFinite(n) ? n : null } } } });
            };
            return (
              <tr key={d.moduleId}>
                <td>{d.moduleId}</td><td className="num">{d.theoreticalMm ?? '—'}</td>
                <td><input aria-label={`Diagonal 1 ${d.moduleId}`} inputMode="decimal" defaultValue={d.d1Mm ?? ''} onBlur={(e) => set('d1Mm', e.target.value)} /></td>
                <td><input aria-label={`Diagonal 2 ${d.moduleId}`} inputMode="decimal" defaultValue={d.d2Mm ?? ''} onBlur={(e) => set('d2Mm', e.target.value)} /></td>
                <td className="num">{d.differenceMm ?? '—'}</td>
                <td><Badge tone={d.result === 'PASA' ? 'ok' : d.result === 'NO_PASA' ? 'err' : 'neutral'}>{d.result}</Badge></td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>
      <section className="rounded-xl border border-line p-3">
        <h3 className="mb-1 font-semibold">Aprobación documentada</h3>
        <p className="mb-2 text-[12px] text-muted">La liberación requiere cero errores. Si hay elementos pendientes de validación (herrajes, mecanizado, herrería, anclajes), la aprobación debe incluir la evidencia (fichas, cálculo estructural, folios). Nada se presenta como listo para CNC o estructura suspendida sin esta aprobación.</p>
        {project.approval ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span>Aprobado por <strong>{project.approval.approvedBy}</strong> el {project.approval.approvedAt.slice(0, 10)}.</span>
            <Button variant="danger" onClick={() => onProject({ ...project, approval: null, status: 'DRAFT_NOT_RELEASED_FOR_MANUFACTURING' })}>Retirar aprobación</Button>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <label className="grid gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Responsable<input value={appr.approvedBy} onChange={(e) => setAppr({ ...appr, approvedBy: e.target.value })} /></label>
            <label className="grid gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Evidencia de validación<input value={appr.validationEvidence} onChange={(e) => setAppr({ ...appr, validationEvidence: e.target.value })} placeholder="Fichas técnicas, memoria de cálculo, folios…" /></label>
            <Button disabled={hasErrors || !appr.approvedBy.trim()} onClick={() => onProject({ ...project, approval: { ...appr, approvedAt: new Date().toISOString() }, status: 'RELEASED_WITH_APPROVAL' })}>Registrar aprobación</Button>
          </div>
        )}
      </section>
    </div>
  );
}

export function ExportTab({ project, dirty, onSave, revisionId }: { project: Project; dirty: boolean; onSave: () => Promise<boolean>; revisionId?: string | null }) {
  const [sep, setSep] = useState<',' | ';'>(';');
  const [msg, setMsg] = useState<string | null>(null);
  const [render, setRender] = useState<string | null>(null);
  const run = async (format: string, extra: Record<string, unknown> = {}) => {
    setMsg(null);
    if (dirty && !revisionId && !(await onSave())) return;
    try { setMsg(`Descargado: ${await (await getDataClient()).exportProject(project.id, format as ExportFormat, { revisionId, separator: sep, ...extra })}`); } catch (e) { setMsg(errorMessage(e)); }
  };
  const items: { f: string; label: string; desc: string; extra?: Record<string, unknown> }[] = [
    { f: 'pdf', label: 'PDF de fabricación', desc: 'Expediente: isométrico, despiece, tableros, herrajes, incidencias, presupuesto, armado y QC.' },
    { f: 'parts-csv', label: 'Despiece CSV', desc: 'UTF-8 con BOM; IDs, medidas, veta, cantos, material, estado.' },
    { f: 'quote-csv', label: 'Cotización CSV', desc: 'Líneas con proveedor, SKU, fecha, estado de precio y totales.' },
    { f: 'hardware-csv', label: 'Herrajes y herrería CSV', desc: 'Requerimientos con regla aplicada y validación.' },
    { f: 'json', label: 'JSON versionado', desc: 'Proyecto + cálculo + acomodo + cotización (schemaVersion, calcVersion).' },
    { f: 'svg', label: 'SVG isométrico', desc: 'Vector con cotas en mm e IDs de pieza.' },
    { f: 'svg', label: 'SVG despiece separado', desc: 'Piezas separadas con etiquetas.', extra: { exploded: true } },
    { f: 'cut-svg', label: 'SVG mapa de corte (tablero 1)', desc: 'Acomodo guillotina del primer tablero.' },
    { f: 'mermaid', label: 'Mermaid (.mmd)', desc: 'Diagrama de dependencias de armado.' },
  ];
  return (
    <div className="grid gap-3">
      {revisionId && <Alert tone="info">Exportando la revisión {revisionId} (congelada).</Alert>}
      {dirty && !revisionId && <Alert tone="warn">Hay cambios sin guardar: se guardarán antes de exportar (la exportación se calcula desde lo guardado).</Alert>}
      <div className="max-w-xs"><SelectInput label="Separador CSV" value={sep} onChange={setSep} options={[{ value: ';', label: '; (Excel es-MX, coma decimal)' }, { value: ',', label: ', (estándar, punto decimal)' }]} testId="csv-sep" /></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col gap-1 rounded-xl border border-line bg-panel-2 p-3">
            <span className="font-semibold">{it.label}</span><span className="text-[12px] text-muted">{it.desc}</span>
            <Button className="mt-auto self-start" variant="secondary" onClick={() => run(it.f, it.extra)} data-testid={`export-${it.f}${it.extra ? '-x' : ''}`}>Descargar</Button>
          </div>
        ))}
      </div>
      {msg && <p role="status" className="text-[12.5px]" data-testid="export-msg">{msg}</p>}
      <p className="text-[11.5px] text-muted">DXF y DWG no están implementados (no se prometen). Programas CNC: fuera de alcance hasta contar con posprocesador homologado.</p>
      {!IS_FIREBASE && <section className="rounded-xl border border-line p-3">
        <h3 className="font-semibold">Render fotorrealista (opcional)</h3>
        <p className="text-[12px] text-muted">Interfaz preparada para un servicio externo configurado en servidor. Distingue «inspiración visual» de «render geométricamente fiel». Un render nunca sustituye planos ni despiece.</p>
        <Button className="mt-2" variant="secondary" onClick={async () => { const r = await api<{ status: string; disclaimer: string }>('/api/render', { method: 'POST', json: { projectId: project.id, moduleId: project.modules[0]?.id, kind: 'inspiracion_visual' } }); setRender(`${r.status}: ${r.disclaimer}`); }}>Solicitar render de inspiración</Button>
        {render && <p className="mt-1 text-[12px]">{render}</p>}
      </section>}
    </div>
  );
}

export function HistoryTab({ revisions, onCreate, onOpen, onRefresh, saved }: {
  revisions: Omit<ProjectRevisionRecord, 'snapshot'>[] | null; onCreate: (note: string) => Promise<void>; onOpen: (id: string) => void; onRefresh: () => void; saved: boolean;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Nota de la revisión<input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Ajuste de medidas tras visita a obra" data-testid="revision-note" /></label>
        <Button disabled={!saved} title={saved ? '' : 'Guarde los cambios primero'} onClick={async () => { await onCreate(note); setNote(''); }} data-testid="create-revision">Congelar revisión</Button>
        <Button variant="secondary" onClick={onRefresh}>Actualizar</Button>
      </div>
      {!saved && <Alert tone="warn">Guarde antes de congelar una revisión: la revisión se toma del proyecto guardado.</Alert>}
      {revisions === null ? <p className="text-muted">Cargando…</p> : revisions.length === 0 ? <EmptyState title="Sin revisiones">Las revisiones congelan geometría, versión de cálculo y estados.</EmptyState> : (
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Nota</th><th>Autor</th><th>Cálculo</th><th>Liberación</th><th>Cotización</th><th></th></tr></thead>
          <tbody>{revisions.map((r) => (
            <tr key={r.id}>
              <td>{r.number}</td><td>{new Date(r.createdAt).toLocaleString('es-MX')}</td><td>{r.note || '—'}</td><td>{r.author}</td><td>{r.calcVersion}</td>
              <td><Badge tone={releaseTone(r.releaseStatus)}>{releaseLabel[r.releaseStatus]}</Badge></td><td><Badge tone={quoteTone(r.quoteCompleteness)}>{r.quoteCompleteness}</Badge></td>
              <td><Button variant="ghost" onClick={() => onOpen(r.id)}>Abrir</Button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
