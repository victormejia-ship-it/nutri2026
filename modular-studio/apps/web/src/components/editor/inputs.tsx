'use client';
import { useEffect, useId, useState } from 'react';
import { Field } from '../ui';

/** Entrada numérica que sólo confirma valores finitos; muestra estado inválido sin romper el cálculo. */
export function NumberInput({ label, value, onChange, min, max, step = 1, hint, testId, suffix }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: string; testId?: string; suffix?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => { setText((t) => (Number(t.replace(',', '.')) === value ? t : String(value))); }, [value]);
  const n = Number(text.replace(',', '.'));
  const invalid = text.trim() === '' || !Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max);
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} htmlFor={id} hint={invalid ? `Valor fuera de rango${min !== undefined ? ` (mín. ${min}` : ''}${max !== undefined ? `, máx. ${max})` : min !== undefined ? ')' : ''}` : hint}>
      <input
        id={id} data-testid={testId} inputMode="decimal" type="text" value={text} aria-invalid={invalid}
        className={invalid ? '!border-[#d0705f]' : ''}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value.replace(',', '.'));
          if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(v);
        }}
        onBlur={() => { if (invalid) setText(String(value)); }}
        step={step}
      />
    </Field>
  );
}

export function SelectInput<T extends string>({ label, value, onChange, options, testId, hint }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; testId?: string; hint?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select id={id} data-testid={testId} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function TextInput({ label, value, onChange, testId, maxLength = 160 }: { label: string; value: string; onChange: (v: string) => void; testId?: string; maxLength?: number }) {
  const id = useId();
  return <Field label={label} htmlFor={id}><input id={id} data-testid={testId} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}

export function MoneyInput({ label, cents, onChange, testId }: { label: string; cents: number | null; onChange: (c: number | null) => void; testId?: string }) {
  const id = useId();
  const [text, setText] = useState(cents === null ? '' : (cents / 100).toFixed(2));
  useEffect(() => { setText((t) => {
    const cur = t.trim() === '' ? null : Math.round(Number(t.replace(',', '.')) * 100);
    return cur === cents ? t : cents === null ? '' : (cents / 100).toFixed(2);
  }); }, [cents]);
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} data-testid={testId} inputMode="decimal" placeholder="Pendiente" value={text} onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.trim();
        if (t === '') onChange(null);
        else { const v = Number(t.replace(',', '.')); if (Number.isFinite(v) && v >= 0) onChange(Math.round(v * 100)); }
      }} />
    </div>
  );
}
