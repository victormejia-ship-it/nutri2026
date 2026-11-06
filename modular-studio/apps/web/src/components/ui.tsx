import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const v = {
    primary: 'bg-accent text-accent-ink hover:brightness-110',
    secondary: 'bg-[#2a3a49] text-[#d9e6f1] border border-[#496072] hover:bg-[#33475a]',
    danger: 'bg-[#5a2620] text-[#ffd9d3] border border-[#8a3b31] hover:bg-[#6b2d26]',
    ghost: 'text-[#bce8f2] hover:bg-[#22313e]',
  }[variant];
  return <button type="button" {...p} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${v} ${className}`} />;
}

export function Panel({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-bold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint, htmlFor }: { label: string; children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={htmlFor} className="text-[11.5px] font-semibold text-[#aebdcc]">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

const TONES = {
  ok: 'bg-ok-bg text-ok border-[#2f6b43]',
  warn: 'bg-warn-bg text-warn border-[#907448]',
  err: 'bg-err-bg text-err border-[#8a3b31]',
  info: 'bg-[#1d3140] text-[#bce8f2] border-[#3c6074]',
  neutral: 'bg-[#22303c] text-[#cfdae4] border-[#3a4b5b]',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

export function Alert({ tone = 'warn', children }: { tone?: Tone; children: ReactNode }) {
  return <div role={tone === 'err' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed ${TONES[tone]}`}>{children}</div>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-panel-2 px-3 py-2 min-w-[130px]">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[17px] font-bold">{value}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-2 text-[13px]">{children}</div>}
    </div>
  );
}

export const severityTone = (s: string): Tone => (s === 'error' ? 'err' : s === 'blocker' ? 'warn' : s === 'warning' ? 'warn' : 'info');
export const severityLabel: Record<string, string> = { error: 'Error', blocker: 'Requiere validación', warning: 'Advertencia', info: 'Info' };

export const releaseTone = (s: string): Tone => (s === 'LIBERADO_CON_APROBACION' ? 'ok' : s === 'NO_FABRICABLE' ? 'err' : s === 'PENDIENTE_VALIDACION' ? 'warn' : 'info');
export const releaseLabel: Record<string, string> = {
  NO_FABRICABLE: 'No fabricable',
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  LISTO_PARA_APROBACION: 'Listo para aprobación',
  LIBERADO_CON_APROBACION: 'Liberado con aprobación',
};
export const quoteTone = (s: string): Tone => (s === 'COMPLETO' ? 'ok' : s === 'SIMULACION' ? 'info' : 'warn');
