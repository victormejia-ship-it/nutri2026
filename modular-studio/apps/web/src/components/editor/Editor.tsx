'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CATALOG, createModule, nextModuleId, planProject,
  type ModuleSpec, type PricingSettings, type Project, type ProjectRevisionRecord, type SupplierOffer,
} from '@ms/domain';
import { api, errorMessage } from '@/lib/api';
import { Alert, Badge, Button, Panel, Stat, quoteTone, releaseLabel, releaseTone } from '../ui';
import { ModuleForm, ModuleList } from './ModulePanel';
import { Viewer } from './Viewer';
import { AssemblyTab, CutTab, HardwareTab, MachiningTab, PartsTab } from './ProductionTabs';
import { ExportTab, HistoryTab, OffersTab, QualityTab, QuoteTab } from './CommercialTabs';

const TABS = [
  { id: 'model', label: 'Modelo y cotas' },
  { id: 'parts', label: 'Despiece' },
  { id: 'cut', label: 'Corte' },
  { id: 'hardware', label: 'Herrajes y herrería' },
  { id: 'machining', label: 'Mecanizado' },
  { id: 'assembly', label: 'Montaje' },
  { id: 'offers', label: 'Proveedores' },
  { id: 'quote', label: 'Presupuesto' },
  { id: 'qc', label: 'Calidad' },
  { id: 'export', label: 'Exportar' },
  { id: 'history', label: 'Historial' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function Editor({ initial }: { initial: Project }) {
  const [project, setProject] = useState<Project>(initial);
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [tab, setTab] = useState<TabId>('model');
  const [selectedModule, setSelectedModule] = useState<string | null>(initial.modules[0]?.id ?? null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Omit<ProjectRevisionRecord, 'snapshot'>[] | null>(null);
  const [viewing, setViewing] = useState<{ id: string; number: number; draft: Project } | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const readOnly = viewing !== null;

  useEffect(() => { api<{ offers: SupplierOffer[] }>('/api/offers').then((r) => setOffers(r.offers)).catch((e) => setError(errorMessage(e))); }, []);
  const loadRevisions = useCallback(() => {
    api<{ revisions: Omit<ProjectRevisionRecord, 'snapshot'>[] }>(`/api/projects/${initial.id}/revisions`).then((r) => setRevisions(r.revisions)).catch((e) => setError(errorMessage(e)));
  }, [initial.id]);
  useEffect(() => { loadRevisions(); }, [loadRevisions]);

  const { plan, calcError, elapsed } = useMemo(() => {
    const t0 = performance.now();
    try {
      const plan = planProject(project, DEFAULT_CATALOG, offers, today, 'vista-previa');
      return { plan, calcError: null, elapsed: performance.now() - t0 };
    } catch (e) { return { plan: null, calcError: errorMessage(e), elapsed: 0 }; }
  }, [project, offers, today]);
  // El tiempo medido sólo se muestra en cliente (evita discrepancias de hidratación).
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => { setMs(Math.round(elapsed)); }, [elapsed]);

  const update = useCallback((p: Project) => {
    if (readOnly) return;
    setProject(p);
    setDirty(true);
    setNotice(null);
  }, [readOnly]);
  const updateModule = (m: ModuleSpec) => update({ ...project, modules: project.modules.map((x) => (x.id === m.id ? m : x)) });
  const updatePricing = (pr: PricingSettings) => update({ ...project, pricing: pr });

  const save = useCallback(async (): Promise<boolean> => {
    if (readOnly) return false;
    setSaving(true); setError(null);
    try {
      const r = await api<{ project: Project }>(`/api/projects/${project.id}`, { method: 'PATCH', json: { project, expectedUpdatedAt: savedAt } });
      setProject(r.project); setSavedAt(r.project.updatedAt); setDirty(false); setNotice('Guardado.');
      return true;
    } catch (e) { setError(`No se guardó: ${errorMessage(e)}`); return false; } finally { setSaving(false); }
  }, [project, savedAt, readOnly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); } };
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); };
  }, [save, dirty]);

  async function openRevision(id: string) {
    try {
      const { revision } = await api<{ revision: ProjectRevisionRecord }>(`/api/projects/${project.id}/revisions/${id}`);
      setViewing({ id, number: revision.number, draft: project });
      setProject(revision.snapshot);
      setSelectedModule(revision.snapshot.modules[0]?.id ?? null);
      setTab('model');
    } catch (e) { setError(errorMessage(e)); }
  }
  function closeRevision(restore: boolean) {
    if (!viewing) return;
    if (restore) { setProject({ ...project, updatedAt: viewing.draft.updatedAt }); setDirty(true); setNotice(`Revisión ${viewing.number} restaurada como borrador: guarde para confirmar.`); }
    else setProject(viewing.draft);
    setViewing(null);
  }

  const mod = project.modules.find((m) => m.id === selectedModule) ?? project.modules[0] ?? null;
  const calc = plan?.calc;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <Link href="/" className="pb-1 text-[12.5px] text-[#bce8f2] underline">← Proyectos</Link>
          <label className="grid gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Proyecto<input data-testid="project-name" className="!w-72 text-[15px] font-bold" value={project.name} maxLength={160} onChange={(e) => update({ ...project, name: e.target.value })} disabled={readOnly} /></label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Cliente<input className="!w-48" value={project.customer} maxLength={160} onChange={(e) => update({ ...project, customer: e.target.value })} disabled={readOnly} /></label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Obra<input className="!w-48" value={project.site} maxLength={240} onChange={(e) => update({ ...project, site: e.target.value })} disabled={readOnly} /></label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted" aria-live="polite" data-testid="save-state">{readOnly ? 'Solo lectura' : saving ? 'Guardando…' : dirty ? 'Cambios sin guardar' : 'Guardado'}</span>
          <Button onClick={save} disabled={saving || !dirty || readOnly} data-testid="save">Guardar</Button>
        </div>
      </div>
      {viewing && (
        <Alert tone="info">
          Viendo la revisión {viewing.number} (congelada, solo lectura).{' '}
          <Button variant="secondary" onClick={() => closeRevision(false)}>Volver al borrador</Button>{' '}
          <Button variant="secondary" onClick={() => closeRevision(true)}>Restaurar como borrador</Button>
        </Alert>
      )}
      {error && <Alert tone="err">{error}</Alert>}
      {notice && <Alert tone="ok">{notice}</Alert>}
      {calcError && <Alert tone="err">Error de cálculo: {calcError}</Alert>}

      <div className="grid gap-3 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 no-print">
          <Panel title="Módulos">
            <fieldset disabled={readOnly}>
              <ModuleList modules={project.modules} results={calc?.modules ?? []} selected={mod?.id ?? null} onSelect={setSelectedModule}
                onAdd={(fid) => { const id = nextModuleId(project); update({ ...project, modules: [...project.modules, createModule(fid, DEFAULT_CATALOG, id)] }); setSelectedModule(id); }}
                onRemove={(id) => { const rest = project.modules.filter((m) => m.id !== id); update({ ...project, modules: rest }); setSelectedModule(rest[0]?.id ?? null); }}
                onDuplicate={(id) => { const src = project.modules.find((m) => m.id === id)!; const nid = nextModuleId(project); update({ ...project, modules: [...project.modules, { ...structuredClone(src), id: nid, label: `${src.label} (copia)` }] }); setSelectedModule(nid); }}
                onMove={(id, dir) => { const i = project.modules.findIndex((m) => m.id === id); const j = i + dir; if (j < 0 || j >= project.modules.length) return; const arr = [...project.modules]; [arr[i], arr[j]] = [arr[j]!, arr[i]!]; update({ ...project, modules: arr }); }}
              />
            </fieldset>
          </Panel>
          {mod && <Panel title={`Configurar ${mod.id}`}><fieldset disabled={readOnly}><ModuleForm key={mod.id} m={mod} onChange={updateModule} /></fieldset></Panel>}
        </aside>

        <Panel className="min-w-0">
          {calc && plan && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={releaseTone(calc.releaseStatus)}>{releaseLabel[calc.releaseStatus]}</Badge>
              <Badge tone={quoteTone(plan.quote.completeness)}>Cotización {plan.quote.completeness}</Badge>
              <Badge tone="neutral">{calc.issues.filter((i) => i.severity === 'error').length} errores · {calc.issues.filter((i) => i.severity === 'blocker').length} por validar · {calc.issues.filter((i) => i.severity === 'warning').length} advertencias</Badge>
              {ms !== null && <span className="text-[11px] text-muted" title="Tiempo de recálculo en el navegador">recalculado en {ms} ms</span>}
            </div>
          )}
          <div role="tablist" aria-label="Secciones del proyecto" className="mb-3 flex flex-wrap gap-1.5 no-print">
            {TABS.map((t) => (
              <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${tab === t.id ? 'bg-accent text-accent-ink' : 'bg-[#253541] text-[#e5edf3] hover:bg-[#2d4150]'}`}>{t.label}</button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {!plan || !calc ? <Alert tone="err">No hay cálculo disponible.</Alert> : (
              <>
                {tab === 'model' && (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Stat label="Piezas totales" value={calc.totals.panelCount} />
                      <Stat label="Modelos de corte" value={calc.totals.partModels} />
                      <Stat label="Tableros (acomodo)" value={plan.nesting.map((n) => `${n.sheetsRequired ?? '?'}× ${n.thicknessMm}mm`).join(' · ') || '—'} />
                      <Stat label="Conjunto" value={`${project.modules.reduce((s, m) => s + m.widthMm, 0)} mm de ancho`} />
                    </div>
                    {calc.issues.filter((i) => i.severity === 'error').map((i, k) => <Alert key={k} tone="err">{i.moduleId ? `${i.moduleId}: ` : ''}{i.message}</Alert>)}
                    <Viewer project={project} calc={calc} selected={selectedPart} onSelect={setSelectedPart} />
                  </div>
                )}
                {tab === 'parts' && <PartsTab plan={plan} selected={selectedPart} onSelect={setSelectedPart} />}
                {tab === 'cut' && <CutTab plan={plan} project={project} onCut={(c) => update({ ...project, cut: c })} />}
                {tab === 'hardware' && <HardwareTab plan={plan} />}
                {tab === 'machining' && <MachiningTab plan={plan} />}
                {tab === 'assembly' && <AssemblyTab plan={plan} project={project} />}
                {tab === 'offers' && <OffersTab plan={plan} project={project} offers={offers} today={today} onPricing={updatePricing} />}
                {tab === 'quote' && <QuoteTab plan={plan} project={project} onPricing={updatePricing} saved={!dirty && !readOnly} />}
                {tab === 'qc' && <QualityTab plan={plan} project={project} onProject={update} />}
                {tab === 'export' && <ExportTab project={project} dirty={dirty} onSave={save} revisionId={viewing?.id ?? null} />}
                {tab === 'history' && (
                  <HistoryTab revisions={revisions} saved={!dirty && !readOnly} onOpen={openRevision} onRefresh={loadRevisions}
                    onCreate={async (note) => {
                      try { await api(`/api/projects/${project.id}/revisions`, { method: 'POST', json: { note } }); setNotice('Revisión congelada.'); loadRevisions(); } catch (e) { setError(errorMessage(e)); }
                    }} />
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
