import type { Issue, Project, ProjectCalculation } from '../types';

export const QC_CHECKLIST: { id: string; label: string }[] = [
  { id: 'site', label: 'Confirmar sitio, instalaciones, toma de medidas y condiciones de montaje' },
  { id: 'labels', label: 'Confirmar piezas etiquetadas y cotejo contra lista de corte' },
  { id: 'surface', label: 'Inspeccionar despostillado, superficies, veta y tapacantos' },
  { id: 'dimensions', label: 'Verificar espesores efectivos, escuadras y diagonales' },
  { id: 'stability', label: 'Verificar estabilidad y capacidad de carga del mueble' },
  { id: 'anchors', label: 'Confirmar tornillería, anclajes y fijación antivuelco cuando aplique' },
  { id: 'clearances', label: 'Validar holguras y recorrido de puertas/cajones' },
  { id: 'edges', label: 'Comprobar cantos sin filos expuestos ni adhesivo visible' },
  { id: 'record', label: 'Registrar fotografías y firma de liberación' },
];

export interface DiagonalCheck {
  moduleId: string;
  theoreticalMm: number | null;
  d1Mm: number | null;
  d2Mm: number | null;
  differenceMm: number | null;
  toleranceMm: number;
  result: 'PASA' | 'NO_PASA' | 'SIN_MEDICION';
}

/** Compara diagonales medidas contra la tolerancia configurada (default editable, no norma). */
export function diagonalChecks(project: Project, calc: ProjectCalculation): DiagonalCheck[] {
  const tol = project.inspection.diagonalToleranceMm;
  return calc.modules.map((m) => {
    const rec = project.inspection.diagonals[m.moduleId];
    const d1 = rec?.d1Mm ?? null, d2 = rec?.d2Mm ?? null;
    const diff = d1 !== null && d2 !== null ? Math.round(Math.abs(d1 - d2) * 100) / 100 : null;
    return { moduleId: m.moduleId, theoreticalMm: m.theoreticalDiagonalMm, d1Mm: d1, d2Mm: d2, differenceMm: diff, toleranceMm: tol, result: diff === null ? 'SIN_MEDICION' : diff <= tol ? 'PASA' : 'NO_PASA' };
  });
}

export function qcIssues(project: Project, calc: ProjectCalculation): Issue[] {
  const out: Issue[] = [];
  for (const d of diagonalChecks(project, calc)) {
    if (d.result === 'NO_PASA') out.push({ code: 'DIAGONAL_OUT_OF_TOLERANCE', severity: 'error', moduleId: d.moduleId, message: `Diferencia de diagonales ${d.differenceMm} mm > tolerancia ${d.toleranceMm} mm: corregir escuadra.` });
  }
  const pendingChecks = QC_CHECKLIST.filter((c) => !project.inspection.checklist[c.id]);
  if (pendingChecks.length) out.push({ code: 'QC_CHECKLIST_PENDING', severity: 'info', message: `${pendingChecks.length} punto(s) de inspección sin confirmar.` });
  return out;
}
