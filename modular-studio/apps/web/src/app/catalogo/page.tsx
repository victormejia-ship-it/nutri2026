import type { Metadata } from 'next';
import { CATEGORY_LABELS, DEFAULT_CATALOG, FAMILIES, FAMILY_STATUS_LABELS } from '@ms/domain';
import { Badge, Panel } from '@/components/ui';
import { CreateFromFamily } from '@/components/CreateFromFamily';

export const metadata: Metadata = { title: 'Catálogo' };

const tone = { verified_vertical: 'ok', configurable_base_template: 'info', template_requires_engine_validation: 'warn' } as const;

export default function Catalog() {
  const cats = [...new Set(FAMILIES.map((f) => f.category))];
  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <Panel title={`Catálogo de familias (${FAMILIES.length})`}>
        <p className="text-[13px] text-muted">El catálogo es extensible (packages/domain/src/catalog). Cada familia declara su estrategia geométrica y su estado de validación; el editor no tiene casos fijos por familia.</p>
        <div className="mt-2 flex flex-wrap gap-2">{Object.entries(FAMILY_STATUS_LABELS).map(([k, v]) => <Badge key={k} tone={tone[k as keyof typeof tone]}>{v}</Badge>)}</div>
      </Panel>
      {cats.map((c) => (
        <Panel key={c} title={CATEGORY_LABELS[c]}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FAMILIES.filter((f) => f.category === c).map((f) => (
              <article key={f.id} className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{f.name}</h3>
                  <Badge tone={tone[f.status]}>{f.status === 'verified_vertical' ? 'Verificada' : f.status === 'configurable_base_template' ? 'Plantilla' : 'Aproximada'}</Badge>
                </div>
                <p className="text-[12.5px] text-muted">{f.description}</p>
                <p className="text-[12px]">Por defecto: {f.defaults.widthMm} × {f.defaults.heightMm} × {f.defaults.depthMm} mm · estrategia <code>{f.geometryStrategy}</code></p>
                {f.pendingRules.length > 0 && <ul className="list-disc pl-5 text-[11.5px] text-warn">{f.pendingRules.map((r) => <li key={r}>{r}</li>)}</ul>}
                <div className="mt-auto"><CreateFromFamily familyId={f.id} name={f.name} /></div>
              </article>
            ))}
          </div>
        </Panel>
      ))}
      <Panel title="Materiales, cantos y herrería">
        <div className="grid gap-4 md:grid-cols-3 text-[12.5px]">
          <div><h3 className="mb-1 font-semibold">Tableros</h3><ul className="space-y-0.5">{DEFAULT_CATALOG.materials.map((m) => <li key={m.id}>{m.name} {m.sheet ? `· ${m.sheet.lengthMm}×${m.sheet.widthMm}` : '· sin formato'}</li>)}</ul></div>
          <div><h3 className="mb-1 font-semibold">Cantos</h3><ul className="space-y-0.5">{DEFAULT_CATALOG.edgeBands.map((m) => <li key={m.id}>{m.name}</li>)}</ul></div>
          <div><h3 className="mb-1 font-semibold">Perfiles de herrería</h3><ul className="space-y-0.5">{DEFAULT_CATALOG.steelProfiles.map((m) => <li key={m.id}>{m.name} · barra {m.barLengthMm / 1000} m · {m.kgPerM === null ? 'kg/m pendiente de ficha' : `${m.kgPerM} kg/m`}</li>)}</ul></div>
        </div>
        <p className="mt-3 text-[12px] text-muted">Formatos comerciales de ejemplo: validar por SKU. Los precios no forman parte del catálogo: se registran como ofertas con fuente y fecha.</p>
      </Panel>
    </div>
  );
}
