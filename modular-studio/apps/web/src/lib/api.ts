'use client';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly issues?: { path: string; message: string }[]) { super(message); }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Error ${res.status}`, (data as { issues?: { path: string; message: string }[] }).issues);
  return data as T;
}

/** Descarga un archivo generado por el servidor (POST /api/exports/:format). */
export async function downloadExport(format: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`/api/exports/${format}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Error ${res.status}`);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `export-${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.issues?.length ? `${e.message}: ${e.issues.map((i) => `${i.path} ${i.message}`).join('; ')}` : e.message;
  return e instanceof Error ? e.message : String(e);
}
