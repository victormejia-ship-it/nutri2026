'use client';
import { Alert, Button } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-3 py-10">
      <Alert tone="err">Ocurrió un error al mostrar esta página: {error.message}</Alert>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
