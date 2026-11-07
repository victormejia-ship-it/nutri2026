'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { Project } from '@ms/domain';
import { Editor } from '@/components/editor/Editor';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { getDataClient } from '@/lib/data';

function EditorLoader() {
  const id = useSearchParams().get('id');
  const [state, setState] = useState<{ project?: Project | null; error?: string }>({});
  useEffect(() => {
    if (!id) return;
    setState({});
    getDataClient().then((c) => c.getProject(id)).then((project) => setState({ project })).catch((e) => setState({ error: errorMessage(e) }));
  }, [id]);
  if (!id || state.project === null) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-bold">Proyecto no encontrado</h1>
        <p className="mt-2 text-muted">No existe en tu espacio de trabajo.</p>
        <Link href="/" className="mt-4 inline-block text-accent underline">Volver a proyectos</Link>
      </div>
    );
  }
  if (state.error) return <div className="mx-auto max-w-xl py-10"><Alert tone="err">{state.error}</Alert></div>;
  if (!state.project) return <p role="status" className="py-16 text-center text-muted">Cargando proyecto…</p>;
  return <Editor key={state.project.id} initial={state.project} />;
}

export default function EditorPage() {
  return <Suspense fallback={<p role="status" className="py-16 text-center text-muted">Cargando…</p>}><EditorLoader /></Suspense>;
}
