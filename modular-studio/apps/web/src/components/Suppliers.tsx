'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CATALOG, OFFER_CSV_COLUMNS, SUPPLIERS, formatMXN, isExpired, netPackCents, type PriceStatus, type SupplierOffer } from '@ms/domain';
import { errorMessage } from '@/lib/api';
import { getDataClient } from '@/lib/data';
import { Alert, Badge, Button, EmptyState, Field, Panel, type Tone } from './ui';

export const PRICE_STATUS_TONE: Record<PriceStatus, Tone> = {
  PUBLICADO_VERIFICADO: 'ok', COTIZADO: 'ok', CAPTURADO_MANUAL: 'info', ESTIMADO: 'warn', PENDIENTE: 'neutral', VENCIDO: 'err',
};

export const PRODUCT_KEYS: { key: string; label: string }[] = [
  ...DEFAULT_CATALOG.materials.map((m) => ({ key: m.productKey, label: m.name })),
  ...DEFAULT_CATALOG.edgeBands.map((m) => ({ key: m.productKey, label: m.name })),
  ...DEFAULT_CATALOG.hardware.map((m) => ({ key: m.productKey, label: m.name })),
  ...DEFAULT_CATALOG.steelProfiles.map((m) => ({ key: m.productKey, label: m.name })),
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  supplierId: 'pajaro_carpintero', productKey: 'board:mel18', sku: '', description: '', packQuantity: '1', purchaseUnit: 'hoja', price: '',
  taxIncluded: 'true', taxRatePct: '16', priceStatus: 'COTIZADO' as PriceStatus, verifiedAt: today(), validUntil: '', sourceUrl: '', quoteReference: '', reliability: 'media', capturedBy: '', notes: '',
};

export function Suppliers() {
  const [offers, setOffers] = useState<SupplierOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [csv, setCsv] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try { setOffers(await (await getDataClient()).listOffers()); } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (offers ?? []).filter((o) => !filter || `${o.supplierId} ${o.productKey} ${o.sku} ${o.description}`.toLowerCase().includes(filter.toLowerCase())), [offers, filter]);

  async function importCsv() {
    setError(null); setMsg(null);
    try {
      const r = await (await getDataClient()).importOffersCsv(csv);
      setMsg(`Importadas ${r.added} oferta(s); ${r.duplicates} duplicada(s) omitida(s).${r.errors.length ? ` Errores: ${r.errors.map((e) => `fila ${e.row}: ${e.message}`).join(' · ')}` : ''}`);
      if (r.added) setCsv('');
      await load();
    } catch (e) { setError(errorMessage(e)); }
  }

  async function capture(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMsg(null);
    const price = form.price.trim() === '' ? null : Math.round(Number(form.price.replace(',', '.')) * 100);
    try {
      await (await getDataClient()).addOffer({
        supplierId: form.supplierId, productKey: form.productKey, sku: form.sku, description: form.description, packQuantity: Number(form.packQuantity), purchaseUnit: form.purchaseUnit,
        priceCents: form.priceStatus === 'PENDIENTE' ? null : price, taxIncluded: form.priceStatus === 'PENDIENTE' ? null : form.taxIncluded === 'true', taxRatePct: form.priceStatus === 'PENDIENTE' ? null : Number(form.taxRatePct),
        priceStatus: form.priceStatus, verifiedAt: form.verifiedAt || null, validUntil: form.validUntil || null, sourceUrl: form.sourceUrl || null, quoteReference: form.quoteReference || null,
        available: null, reliability: form.reliability as SupplierOffer['reliability'], capturedBy: form.capturedBy || null, notes: form.notes,
      });
      setMsg('Oferta registrada.');
      setForm({ ...emptyForm, supplierId: form.supplierId });
      await load();
    } catch (err) { setError(errorMessage(err)); }
  }

  const template = OFFER_CSV_COLUMNS.join(';') + '\npajaro_carpintero;board:mel18;SKU-EJEMPLO;Melamina blanca 18 mm 1220x2440;1;hoja;;;;PENDIENTE;;;https://www.elpajarocarpintero.mx/productos/;;;media;;Solicitar cotización\n';

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <Panel title="Proveedores prioritarios">
        <p className="mb-3 text-[12.5px] text-muted">Sin afiliación, certificación ni colaboración comercial. Prioridad de integración: API autorizada &gt; catálogo CSV/XLSX entregado &gt; captura de cotización &gt; consulta manual a web pública con registro de fuente y fecha. No se hace scraping.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {SUPPLIERS.map((s) => (
            <article key={s.id} className="rounded-xl border border-line bg-panel-2 p-3 text-[12.5px]">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{s.name}</h3><Badge tone={s.verification === 'PUBLIC_CATALOG' ? 'info' : 'warn'}>{s.verification === 'PUBLIC_CATALOG' ? 'Catálogo público' : 'URL por verificar'}</Badge></div>
              <p className="mt-1 text-muted">{s.notes}</p>
              <p className="mt-1">Categorías: {s.categories.join(', ')}</p>
              {s.officialUrl && <p>Oficial: <a className="text-[#bce8f2] underline" href={s.officialUrl} target="_blank" rel="noreferrer noopener">{s.officialUrl}</a></p>}
              {s.candidateUrl && <p>Candidata (sin verificar): <span className="text-muted">{s.candidateUrl}</span></p>}
              <p className="mt-1">Ofertas registradas: {(offers ?? []).filter((o) => o.supplierId === s.id).length}</p>
            </article>
          ))}
        </div>
      </Panel>

      {error && <Alert tone="err">{error}</Alert>}
      {msg && <Alert tone="ok">{msg}</Alert>}

      <Panel title="Ofertas y cotizaciones registradas" actions={<input aria-label="Filtrar ofertas" placeholder="Filtrar por proveedor, clave o SKU" value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-64" />}>
        {offers === null ? <p role="status" className="text-muted">Cargando…</p> : shown.length === 0 ? <EmptyState title="Sin ofertas">Importe un CSV o capture una cotización.</EmptyState> : (
          <div className="max-h-[480px] overflow-auto">
            <table>
              <thead><tr><th>Proveedor</th><th>Clave</th><th>SKU / descripción</th><th className="num">Presentación</th><th className="num">Precio</th><th>IVA</th><th className="num">Neto s/IVA</th><th>Estado</th><th>Fecha / vigencia</th><th>Fuente</th></tr></thead>
              <tbody>
                {shown.map((o) => {
                  const net = netPackCents(o);
                  const expired = isExpired(o, today());
                  return (
                    <tr key={o.id}>
                      <td>{SUPPLIERS.find((s) => s.id === o.supplierId)?.name ?? o.supplierId}</td>
                      <td><code className="text-[11px]">{o.productKey}</code></td>
                      <td><div className="font-semibold">{o.sku}</div><div className="text-muted">{o.description}</div>{o.notes && <div className="text-[11px] text-warn">{o.notes}</div>}</td>
                      <td className="num">{o.packQuantity} / {o.purchaseUnit}</td>
                      <td className="num">{formatMXN(o.priceCents)}</td>
                      <td>{o.taxIncluded === null ? <Badge tone="warn">No definido</Badge> : o.taxIncluded ? `Incluido ${o.taxRatePct ?? '?'} %` : 'Excluido'}</td>
                      <td className="num">{formatMXN(net)}</td>
                      <td><Badge tone={expired ? 'err' : PRICE_STATUS_TONE[o.priceStatus]}>{expired && o.priceStatus !== 'VENCIDO' ? 'VENCIDO (fecha)' : o.priceStatus}</Badge></td>
                      <td className="text-[11.5px]">{o.verifiedAt ?? '—'}{o.validUntil ? ` → ${o.validUntil}` : ''}{o.quoteReference ? <div>Folio {o.quoteReference}</div> : null}</td>
                      <td className="max-w-[180px] truncate">{o.sourceUrl ? <a href={o.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-[#bce8f2] underline">{o.sourceUrl.replace(/^https?:\/\//, '')}</a> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Capturar cotización / precio manual">
          <form onSubmit={capture} className="grid grid-cols-2 gap-3" aria-label="Capturar oferta">
            <Field label="Proveedor" htmlFor="of-sup"><select id="of-sup" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>{SUPPLIERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Clave de producto (requerimiento)" htmlFor="of-key"><select id="of-key" value={form.productKey} onChange={(e) => setForm({ ...form, productKey: e.target.value })}>{PRODUCT_KEYS.map((k) => <option key={k.key} value={k.key}>{k.label} ({k.key})</option>)}</select></Field>
            <Field label="SKU" htmlFor="of-sku"><input id="of-sku" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Descripción" htmlFor="of-desc"><input id="of-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Unidades por presentación" htmlFor="of-pack" hint="Ej. bolsa de 2 bisagras = 2"><input id="of-pack" type="number" min="0.0001" step="any" required value={form.packQuantity} onChange={(e) => setForm({ ...form, packQuantity: e.target.value })} /></Field>
            <Field label="Presentación" htmlFor="of-unit"><input id="of-unit" required value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} /></Field>
            <Field label="Estado del precio" htmlFor="of-status">
              <select id="of-status" value={form.priceStatus} onChange={(e) => setForm({ ...form, priceStatus: e.target.value as PriceStatus })}>
                {(['COTIZADO', 'PUBLICADO_VERIFICADO', 'CAPTURADO_MANUAL', 'ESTIMADO', 'PENDIENTE', 'VENCIDO'] as const).map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Precio por presentación (MXN)" htmlFor="of-price" hint="En blanco = pendiente (nunca $0)"><input id="of-price" inputMode="decimal" disabled={form.priceStatus === 'PENDIENTE'} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="IVA" htmlFor="of-tax"><select id="of-tax" value={form.taxIncluded} onChange={(e) => setForm({ ...form, taxIncluded: e.target.value })}><option value="true">Incluido en el precio</option><option value="false">No incluido (+IVA)</option></select></Field>
            <Field label="Tasa IVA %" htmlFor="of-rate"><input id="of-rate" type="number" min="0" max="100" value={form.taxRatePct} onChange={(e) => setForm({ ...form, taxRatePct: e.target.value })} /></Field>
            <Field label="Fecha de verificación" htmlFor="of-date"><input id="of-date" type="date" value={form.verifiedAt} onChange={(e) => setForm({ ...form, verifiedAt: e.target.value })} /></Field>
            <Field label="Vigencia hasta" htmlFor="of-valid"><input id="of-valid" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
            <Field label="URL de fuente" htmlFor="of-url"><input id="of-url" type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /></Field>
            <Field label="Folio de cotización" htmlFor="of-ref"><input id="of-ref" value={form.quoteReference} onChange={(e) => setForm({ ...form, quoteReference: e.target.value })} /></Field>
            <Field label="Capturado por" htmlFor="of-by"><input id="of-by" value={form.capturedBy} onChange={(e) => setForm({ ...form, capturedBy: e.target.value })} /></Field>
            <Field label="Confiabilidad" htmlFor="of-rel"><select id="of-rel" value={form.reliability} onChange={(e) => setForm({ ...form, reliability: e.target.value })}><option>alta</option><option>media</option><option>baja</option></select></Field>
            <div className="col-span-2"><Field label="Notas" htmlFor="of-notes"><input id="of-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
            <div className="col-span-2"><Button type="submit">Registrar oferta</Button></div>
          </form>
        </Panel>
        <Panel title="Importar CSV de ofertas" actions={<a className="text-[12px] text-[#bce8f2] underline" download="plantilla_ofertas.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + template)}`}>Descargar plantilla</a>}>
          <p className="mb-2 text-[12px] text-muted">Separador «,» o «;» detectado automáticamente. Importes en formato 1,234.50 o 1.234,50. Se valida estado, IVA, fuente y se de-duplica por proveedor + SKU + presentación + fecha. El histórico no se sobrescribe.</p>
          <textarea aria-label="Contenido CSV" rows={12} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={template} className="font-mono text-[11.5px]" />
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border border-[#496072] bg-[#2a3a49] px-3 py-1.5 text-[13px] font-semibold">Elegir archivo…<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} /></label>
            <Button onClick={importCsv} disabled={!csv.trim()}>Importar</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
