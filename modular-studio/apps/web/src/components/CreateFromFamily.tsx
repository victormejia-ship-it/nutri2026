'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Button } from './ui';

export function CreateFromFamily({ familyId, name }: { familyId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const { project } = await api<{ project: { id: string } }>('/api/projects', { method: 'POST', json: { name: `Nuevo: ${name}`, familyId } });
        router.push(`/proyectos/${project.id}`);
      } catch (e) { alert(errorMessage(e)); setBusy(false); }
    }}>Crear proyecto con esta plantilla</Button>
  );
}
