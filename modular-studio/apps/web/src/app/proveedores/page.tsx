import type { Metadata } from 'next';
import { Suppliers } from '@/components/Suppliers';

export const metadata: Metadata = { title: 'Proveedores y precios' };
export default function Page() { return <Suppliers />; }
