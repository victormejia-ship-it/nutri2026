'use client';
import { CATEGORY_LABELS, DEFAULT_CATALOG, FAMILIES, catalogLookup, createModule, type ModuleResult, type ModuleSpec } from '@ms/domain';
import { Badge, Button } from '../ui';
import { NumberInput, SelectInput, TextInput } from './inputs';

const L = catalogLookup(DEFAULT_CATALOG);
const boards = DEFAULT_CATALOG.materials.filter((m) => m.kind !== 'back_panel');
const backs = DEFAULT_CATALOG.materials.filter((m) => m.kind === 'back_panel');

export function ModuleList({ modules, results, selected, onSelect, onAdd, onRemove, onMove, onDuplicate }: {
  modules: ModuleSpec[]; results: ModuleResult[]; selected: string | null;
  onSelect: (id: string) => void; onAdd: (familyId: string) => void; onRemove: (id: string) => void; onMove: (id: string, dir: -1 | 1) => void; onDuplicate: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5" aria-label="Módulos del proyecto">
        {modules.map((m, i) => {
          const r = results.find((x) => x.moduleId === m.id);
          const errors = r?.issues.filter((x) => x.severity === 'error').length ?? 0;
          const active = m.id === selected;
          return (
            <li key={m.id} className={`rounded-xl border px-2.5 py-2 ${active ? 'border-accent bg-[#1d3442]' : 'border-line bg-panel-2'}`}>
              <button type="button" className="w-full text-left" onClick={() => onSelect(m.id)} aria-pressed={active} data-testid={`module-${m.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.id} · {m.label}</span>
                  {errors > 0 ? <Badge tone="err">{errors} error(es)</Badge> : <Badge tone="ok">OK</Badge>}
                </div>
                <div className="text-[11.5px] text-muted">{m.widthMm} × {m.heightMm} × {m.depthMm} mm · {L.family(m.familyId).name}</div>
              </button>
              {active && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Button variant="ghost" onClick={() => onMove(m.id, -1)} disabled={i === 0} aria-label="Mover a la izquierda">←</Button>
                  <Button variant="ghost" onClick={() => onMove(m.id, 1)} disabled={i === modules.length - 1} aria-label="Mover a la derecha">→</Button>
                  <Button variant="ghost" onClick={() => onDuplicate(m.id)}>Duplicar</Button>
                  <Button variant="ghost" onClick={() => onRemove(m.id)} disabled={modules.length === 1}>Quitar</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <label className="text-[11.5px] font-semibold text-[#aebdcc]" htmlFor="add-module">Agregar módulo</label>
      <select id="add-module" data-testid="add-module" value="" onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}>
        <option value="">Elegir familia…</option>
        {[...new Set(FAMILIES.map((f) => f.category))].map((c) => (
          <optgroup key={c} label={CATEGORY_LABELS[c]}>{FAMILIES.filter((f) => f.category === c).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>
        ))}
      </select>
    </div>
  );
}

export function ModuleForm({ m, onChange }: { m: ModuleSpec; onChange: (m: ModuleSpec) => void }) {
  const set = <K extends keyof ModuleSpec>(k: K, v: ModuleSpec[K]) => onChange({ ...m, [k]: v });
  const fam = L.family(m.familyId);
  const isDesk = fam.geometryStrategy === 'desk';
  const hinges = DEFAULT_CATALOG.hardware.filter((h) => h.category === 'hinge');
  const slides = DEFAULT_CATALOG.hardware.filter((h) => h.category === 'drawer_slide');
  return (
    <div className="grid gap-3" aria-label={`Configuración de ${m.id}`}>
      <TextInput label="Nombre del módulo" value={m.label} onChange={(v) => set('label', v)} testId="mod-label" maxLength={120} />
      <SelectInput label="Familia" value={m.familyId} onChange={(v) => set('familyId', v)} options={FAMILIES.map((f) => ({ value: f.id, label: f.name }))} testId="mod-family"
        hint={fam.status === 'verified_vertical' ? 'Implementación verificada con pruebas' : fam.status === 'configurable_base_template' ? 'Plantilla sobre caja genérica' : 'Aproximación: requiere motor específico'} />
      <Button variant="secondary" onClick={() => {
        const d = createModule(m.familyId, DEFAULT_CATALOG, m.id, m.label);
        onChange({ ...d, materialId: m.materialId, finishId: m.finishId, edgeBandId: m.edgeBandId });
      }}>Aplicar valores por defecto de la familia</Button>

      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="mb-1 text-[12px] font-bold text-[#cfeff7]">Medidas exteriores</legend>
        <NumberInput label="Ancho" suffix="mm" value={m.widthMm} min={1} max={6000} onChange={(v) => set('widthMm', v)} testId="mod-width" />
        <NumberInput label="Alto" suffix="mm" value={m.heightMm} min={1} max={4000} onChange={(v) => set('heightMm', v)} testId="mod-height" />
        <NumberInput label="Fondo" suffix="mm" value={m.depthMm} min={1} max={2000} onChange={(v) => set('depthMm', v)} testId="mod-depth" />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-[12px] font-bold text-[#cfeff7]">Tablero y cantos</legend>
        <SelectInput label="Tablero" value={m.materialId} onChange={(v) => onChange({ ...m, materialId: v, thicknessMm: L.material(v).thicknessMm })} options={boards.map((b) => ({ value: b.id, label: b.name }))} testId="mod-material" />
        <NumberInput label="Espesor real" suffix="mm" value={m.thicknessMm} min={3} max={60} step={0.1} onChange={(v) => set('thicknessMm', v)} hint="Medir el tablero real" testId="mod-thickness" />
        <SelectInput label="Respaldo" value={m.backMaterialId ?? ''} onChange={(v) => set('backMaterialId', v || null)} options={[{ value: '', label: 'Sin respaldo' }, ...backs.map((b) => ({ value: b.id, label: b.name }))]} testId="mod-back" />
        <SelectInput label="Acabado" value={m.finishId} onChange={(v) => set('finishId', v)} options={DEFAULT_CATALOG.finishes.map((f) => ({ value: f.id, label: f.name }))} testId="mod-finish" />
        <SelectInput label="Tapacanto" value={m.edgeBandId} onChange={(v) => set('edgeBandId', v)} options={DEFAULT_CATALOG.edgeBands.map((f) => ({ value: f.id, label: f.name }))} />
        <SelectInput label="Política de canto" value={m.edgePolicy} onChange={(v) => set('edgePolicy', v)} options={[{ value: 'front_visible_only', label: 'Sólo cantos frontales' }, { value: 'all_visible', label: 'Todos los visibles' }, { value: 'none', label: 'Sin canto' }]} />
      </fieldset>

      {!isDesk && (
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1 text-[12px] font-bold text-[#cfeff7]">Construcción y frentes</legend>
          <SelectInput label="Estrategia de caja" value={m.construction} onChange={(v) => set('construction', v)} options={[{ value: 'top_bottom_between_sides', label: 'Tapa/piso entre costados' }, { value: 'sides_between_top_bottom', label: 'Costados entre tapa/piso' }]} />
          <SelectInput label="Unión" value={m.joinery} onChange={(v) => set('joinery', v)} options={[{ value: 'cam', label: 'Excéntrico + taquete' }, { value: 'dowel', label: 'Taquete' }, { value: 'screw', label: 'Tornillo' }, { value: 'mixed', label: 'Mixta' }]} />
          <SelectInput label="Frente" value={m.front} onChange={(v) => onChange({ ...m, front: v, drawerCount: v === 'drawers' && m.drawerCount === 0 ? 3 : m.drawerCount })} options={[{ value: 'open', label: 'Abierto' }, { value: 'doors', label: 'Puertas' }, { value: 'drawers', label: 'Cajones' }]} testId="mod-front" />
          {m.front === 'doors' && <SelectInput label="Número de puertas" value={String(m.doorCount ?? 'auto')} onChange={(v) => set('doorCount', v === 'auto' ? null : Number(v))} options={[{ value: 'auto', label: 'Automático (≤600 mm)' }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))]} />}
          {m.front === 'drawers' && <NumberInput label="Cajones" value={m.drawerCount} min={1} max={10} onChange={(v) => set('drawerCount', Math.round(v))} testId="mod-drawers" />}
          {m.front !== 'drawers' && <NumberInput label={fam.geometryStrategy === 'wardrobe' ? 'Entrepaños (1 = maletero)' : 'Entrepaños por hueco'} value={m.shelvesPerBay} min={0} max={12} onChange={(v) => set('shelvesPerBay', Math.round(v))} testId="mod-shelves" />}
          <SelectInput label="Divisores" value={String(m.dividerCount ?? 'auto')} onChange={(v) => set('dividerCount', v === 'auto' ? null : Number(v))} options={[{ value: 'auto', label: 'Automático (luz libre)' }, ...[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))]} />
          {m.front === 'doors' && <SelectInput label="Bisagra" value={m.hingeProductId ?? ''} onChange={(v) => set('hingeProductId', v || null)} options={[{ value: '', label: 'Genérica (pendiente de SKU)' }, ...hinges.map((h) => ({ value: h.id, label: h.name }))]} testId="mod-hinge" />}
          {m.front === 'drawers' && <SelectInput label="Corredera" value={m.slideProductId ?? ''} onChange={(v) => set('slideProductId', v || null)} options={[{ value: '', label: 'Sin seleccionar' }, ...slides.map((h) => ({ value: h.id, label: h.name }))]} testId="mod-slide" />}
          {m.front !== 'open' && <NumberInput label="Holgura perimetral" suffix="mm" value={m.revealMm} min={0} max={20} step={0.5} onChange={(v) => set('revealMm', v)} />}
          {m.front !== 'open' && <NumberInput label="Holgura entre frentes" suffix="mm" value={m.frontGapMm} min={0} max={20} step={0.5} onChange={(v) => set('frontGapMm', v)} />}
        </fieldset>
      )}

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-[12px] font-bold text-[#cfeff7]">{isDesk ? 'Soporte' : 'Base y montaje'}</legend>
        {!isDesk && <SelectInput label="Base" value={m.baseType} onChange={(v) => set('baseType', v)} options={[{ value: 'none', label: 'Sin base' }, { value: 'plinth', label: 'Zoclo (bastidor)' }, { value: 'levelers', label: 'Patas niveladoras' }, { value: 'steel_frame', label: 'Bastidor PTR' }]} testId="mod-base" />}
        {!isDesk && m.baseType !== 'none' && <NumberInput label="Altura de base" suffix="mm" value={m.baseHeightMm} min={0} max={400} onChange={(v) => set('baseHeightMm', v)} />}
        {!isDesk && <SelectInput label="Montaje" value={m.mount} onChange={(v) => set('mount', v)} options={[{ value: 'floor', label: 'Piso' }, { value: 'wall', label: 'Colgado a muro' }]} />}
        {isDesk && <SelectInput label="Estructura" value={m.steel.enabled ? 'steel' : 'panel'} onChange={(v) => set('steel', { ...m.steel, enabled: v === 'steel' })} options={[{ value: 'panel', label: 'Costados tipo panel' }, { value: 'steel', label: 'Bastidor de PTR' }]} testId="mod-desk-structure" />}
        {(isDesk ? m.steel.enabled : m.baseType === 'steel_frame') && (
          <>
            <SelectInput label="Perfil" value={m.steel.profileId} onChange={(v) => set('steel', { ...m.steel, profileId: v })} options={DEFAULT_CATALOG.steelProfiles.map((p) => ({ value: p.id, label: p.name }))} />
            <SelectInput label="Acabado metálico" value={m.steel.finish} onChange={(v) => set('steel', { ...m.steel, finish: v })} options={[{ value: 'powder_coating', label: 'Pintura electrostática' }, { value: 'primer', label: 'Primario anticorrosivo' }, { value: 'paint', label: 'Esmalte' }, { value: 'none', label: 'Sin acabado' }]} />
          </>
        )}
      </fieldset>
    </div>
  );
}
