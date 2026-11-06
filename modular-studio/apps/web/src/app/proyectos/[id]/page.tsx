import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Editor } from '@/components/editor/Editor';
import { getRepository } from '@/server/repo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Editor' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Páginas de UI en modo demo usan el workspace local; en modo token la UI requiere integrar sesión (pendiente).
  const ws = process.env.DEMO_WORKSPACE_ID ?? 'demo';
  const project = await (await getRepository()).getProject(ws, id);
  if (!project) notFound();
  return <Editor key={project.id} initial={project} />;
}
