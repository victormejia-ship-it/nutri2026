'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ProjectSummary } from '@ms/domain';
import { api, errorMessage } from '@/lib/api';
import { Alert, Badge, Button, EmptyState, Field, Panel } from './ui';

interface FamilyOpt { id: string; name: string; category: string; status: string }

export function Dashboard({ families }: { families: FamilyOpt[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', familyId: 'kitchen_base', customer: '', site: '' });

  const load = useCallback(async () => {
    try {
      setProjects((await api<{ projects: ProjectSummary[] }>('/api/projects')).projects);
    } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { project } = await api<{ project: { id: string } }>('/api/projects', { method: 'POST', json: form });
      router.push(`/proyectos/${project.id}`);
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }

  async function duplicate(id: string) {
    try { await api('/api/projects', { method: 'POST', json: { sourceId: id } }); await load(); } catch (e) { setError(errorMessage(e)); }
  }
  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}" y todas sus revisiones? Esta acción no se puede deshacer.`)) return;
    try { await api(`/api/projects/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(errorMessage(e)); }
  }
  async function importFile(file: File) {
    setError(null);
    try {
      const data = JSON.parse(await file.text());
      const { project, notes } = await api<{ project: { id: string }; notes: string[] }>('/api/projects', { method: 'POST', json: { import: data } });
      if (notes.length) alert(notes.join('\n'));
      router.push(`/proyectos/${project.id}`);
    } catch (e) { setError(`No se pudo importar: ${errorMessage(e)}`); }
  }

  const groups = [...new Set(families.map((f) => f.category))];
  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[340px_1fr]">
      <Panel title="Nuevo proyecto">
        <form onSubmit={create} className="grid gap-3" aria-label="Crear proyecto">
          <Field label="Nombre del proyecto" htmlFor="np-name"><input id="np-name" required maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cocina depto. 302" /></Field>
          <Field label="Plantilla inicial" htmlFor="np-family">
            <select id="np-family" value={form.familyId} onChange={(e) => setForm({ ...form, familyId: e.target.value })}>
              {groups.map((g) => <optgroup key={g} label={g}>{families.filter((f) => f.category === g).map((f) => <option key={f.id} value={f.id}>{f.name}{f.status === 'verified_vertical' ? ' ✓' : ''}</option>)}</optgroup>)}
            </select>
          </Field>
          <Field label="Cliente" htmlFor="np-customer"><input id="np-customer" maxLength={160} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></Field>
          <Field label="Obra / ubicación" htmlFor="np-site"><input id="np-site" maxLength={240} value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></Field>
          <Button type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear y abrir editor'}</Button>
          <label className="cursor-pointer text-[12px] text-[#bce8f2] underline">
            Importar proyecto JSON (incluye migración del esquema mínimo)
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
        </form>
      </Panel>
      <Panel title="Proyectos" actions={<Link className="text-[12.5px] text-[#bce8f2] underline" href="/catalogo">Ver catálogo de familias</Link>}>
        {error && <div className="mb-3"><Alert tone="err">{error}</Alert></div>}
        {projects === null && !error && <p role="status" className="text-muted">Cargando proyectos…</p>}
        {projects?.length === 0 && <EmptyState title="Aún no hay proyectos">Cree uno desde una plantilla para empezar.</EmptyState>}
        {projects && projects.length > 0 && (
          <ul className="grid gap-2">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/proyectos/${p.id}`} className="font-semibold text-[#cfeff7] hover:underline">{p.name}</Link>
                  <div className="text-[12px] text-muted">{p.customer || 'Sin cliente'} · {p.moduleCount} módulo(s) · actualizado {new Date(p.updatedAt).toLocaleString('es-MX')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="info">{p.revisionCount} revisión(es)</Badge>
                  <Button variant="secondary" onClick={() => duplicate(p.id)} aria-label={`Duplicar ${p.name}`}>Duplicar</Button>
                  <Button variant="danger" onClick={() => remove(p.id, p.name)} aria-label={`Eliminar ${p.name}`}>Eliminar</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
