'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { IS_FIREBASE } from '@/lib/data';
import { Alert, Button, Field, Panel } from './ui';

interface AuthState { ready: boolean; email: string | null; signOut: () => Promise<void> }
const Ctx = createContext<AuthState>({ ready: true, email: 'demo', signOut: async () => undefined });
export const useAuth = () => useContext(Ctx);

/** En modo Firebase escucha la sesión de Firebase Auth; en modo servidor no hay inicio de sesión en la UI. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: !IS_FIREBASE, email: IS_FIREBASE ? null : 'demo', signOut: async () => undefined });
  useEffect(() => {
    if (!IS_FIREBASE) return;
    let unsub = () => {};
    (async () => {
      const { firebase } = await import('@/lib/data/firebase-app');
      const { onAuthStateChanged, signOut } = await import('firebase/auth');
      const { auth } = firebase();
      unsub = onAuthStateChanged(auth, (u) => setState({ ready: true, email: u?.email ?? null, signOut: () => signOut(auth) }));
    })().catch((e) => { console.error(e); setState({ ready: true, email: null, signOut: async () => undefined }); });
    return () => unsub();
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, email } = useAuth();
  if (!ready) return <p role="status" className="py-16 text-center text-muted">Cargando…</p>;
  if (!email) return <LoginForm />;
  return <>{children}</>;
}

export function UserMenu() {
  const { email, signOut } = useAuth();
  if (!IS_FIREBASE || !email) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="text-muted" data-testid="user-email">{email}</span>
      <Button variant="ghost" onClick={() => signOut()}>Cerrar sesión</Button>
    </span>
  );
}

function translate(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'Correo no válido.',
    'auth/too-many-requests': 'Demasiados intentos; espere unos minutos.',
    'auth/network-request-failed': 'Sin conexión con Firebase.',
  };
  return map[code] ?? `No se pudo completar (${code}).`;
}

function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ tone: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const { firebase } = await import('@/lib/data/firebase-app');
      const a = await import('firebase/auth');
      const { auth } = firebase();
      if (mode === 'login') await a.signInWithEmailAndPassword(auth, email, password);
      else await a.createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setMsg({ tone: 'err', text: translate((err as { code?: string }).code ?? String(err)) });
    } finally { setBusy(false); }
  }
  async function reset() {
    if (!email) { setMsg({ tone: 'err', text: 'Escriba su correo para recuperar la contraseña.' }); return; }
    try {
      const { firebase } = await import('@/lib/data/firebase-app');
      const a = await import('firebase/auth');
      await a.sendPasswordResetEmail(firebase().auth, email);
      setMsg({ tone: 'ok', text: 'Le enviamos un correo para restablecer la contraseña.' });
    } catch (err) { setMsg({ tone: 'err', text: translate((err as { code?: string }).code ?? String(err)) }); }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <Panel title={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}>
        <form onSubmit={submit} className="grid gap-3" aria-label={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}>
          <Field label="Correo" htmlFor="auth-email"><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Contraseña" htmlFor="auth-pass"><input id="auth-pass" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button type="submit" disabled={busy}>{busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</Button>
          <div className="flex justify-between text-[12.5px]">
            <button type="button" className="text-[#bce8f2] underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(null); }}>
              {mode === 'login' ? 'Crear una cuenta nueva' : 'Ya tengo cuenta'}
            </button>
            {mode === 'login' && <button type="button" className="text-[#bce8f2] underline" onClick={reset}>Olvidé mi contraseña</button>}
          </div>
        </form>
        <p className="mt-3 text-[11.5px] text-muted">Cada cuenta tiene sus propios proyectos, revisiones y ofertas de proveedores.</p>
      </Panel>
    </div>
  );
}

export function BackendBadge() {
  const [b, setB] = useState<{ label: string; tone: 'ok' | 'warn' } | null>(null);
  const { email } = useAuth();
  useEffect(() => {
    if (!email) return;
    import('@/lib/data').then((m) => m.getDataClient()).then((c) => c.backendLabel()).then(setB).catch(() => setB(null));
  }, [email]);
  if (!b) return null;
  return <span className={`rounded-full border px-2 py-0.5 font-semibold ${b.tone === 'ok' ? 'border-[#2f6b43] bg-ok-bg text-ok' : 'border-[#907448] bg-warn-bg text-warn'}`}>{b.label}</span>;
}
