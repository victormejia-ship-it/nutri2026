import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthGate, AuthProvider, BackendBadge, UserMenu } from '@/components/Auth';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Modular Studio', template: '%s · Modular Studio' },
  description: 'Diseño paramétrico, despiece, presupuesto y fabricación de muebles modulares (mm · MXN).',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#10151c' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen font-sans">
        <AuthProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accent-ink">Saltar al contenido</a>
        <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#18212b] px-4 py-3 sm:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[19px] font-extrabold tracking-tight">MODULAR <span className="text-[#60c6db]">STUDIO</span></Link>
            <nav aria-label="Principal" className="flex gap-1 text-[13px]">
              <Link className="rounded-lg px-3 py-1.5 hover:bg-[#22313e]" href="/">Proyectos</Link>
              <Link className="rounded-lg px-3 py-1.5 hover:bg-[#22313e]" href="/catalogo">Catálogo</Link>
              <Link className="rounded-lg px-3 py-1.5 hover:bg-[#22313e]" href="/proveedores">Proveedores y precios</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-[11.5px]">
            <BackendBadge />
            <UserMenu />
            <span className="text-muted">mm · MXN · es-MX</span>
          </div>
        </header>
        <main id="main" className="px-3 py-4 sm:px-6"><AuthGate>{children}</AuthGate></main>
        <footer className="no-print px-6 pb-6 pt-2 text-center text-[11.5px] text-muted">
          Medidas nominales en mm; cantos sin compensar salvo política explícita. Las listas no sustituyen cálculo estructural, planos de instalación ni fichas de herrajes. Sin afiliación con proveedores listados.
        </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
