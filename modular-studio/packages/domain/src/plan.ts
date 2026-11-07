import type { Catalog } from './catalog';
import { nestParts, nestSteel, type MaterialNesting, type SteelNesting } from './engine/nesting';
import { calculateProject } from './engine/project';
import { qcIssues } from './engine/quality';
import { buildQuote } from './pricing/quote';
import type { Project, ProjectCalculation, Quote, SupplierOffer } from './types';

export interface ManufacturingPlan {
  calc: ProjectCalculation;
  nesting: MaterialNesting[];
  steel: SteelNesting[];
  quote: Quote;
}

/**
 * Punto de entrada único: el mismo motor corre en navegador (vista previa) y servidor
 * (cotización/exportación). `today`/`generatedAt` se inyectan para mantener determinismo.
 */
export function planProject(project: Project, catalog: Catalog, offers: SupplierOffer[], today: string, generatedAt: string): ManufacturingPlan {
  const calc = calculateProject(project, catalog);
  const qc = qcIssues(project, calc);
  if (qc.some((i) => i.severity === 'error')) calc.releaseStatus = 'NO_FABRICABLE';
  calc.issues.push(...qc);
  const nesting = nestParts(calc.parts, catalog, project.cut);
  const steel = nestSteel(calc.steel, catalog, 3, project.pricing.steelWastePct);
  const quote = buildQuote(project, calc, nesting, steel, catalog, offers, today, generatedAt);
  return { calc, nesting, steel, quote };
}
