import { Dashboard } from '@/components/Dashboard';
import { CATEGORY_LABELS, FAMILIES } from '@ms/domain';

export default function Home() {
  return <Dashboard families={FAMILIES.map((f) => ({ id: f.id, name: f.name, category: CATEGORY_LABELS[f.category], status: f.status }))} />;
}
