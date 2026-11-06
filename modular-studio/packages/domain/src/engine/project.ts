import { catalogLookup, type Catalog } from '../catalog';
import {
  CALC_VERSION, SCHEMA_VERSION,
  type EdgeBandTotal, type EdgeName, type HardwareRequirement, type Issue, type ModuleResult, type ModuleSpec, type PanelPart, type Project,
  type ProjectCalculation, type ReleaseStatus,
} from '../types';
import { r2 } from './helpers';
import { calculateModule } from './module';

/** Calcula el proyecto completo. Determinista: misma entrada => misma salida (sin fechas ni azar). */
export function calculateProject(project: Project, catalog: Catalog): ProjectCalculation {
  const issues: Issue[] = [];
  const modules: ModuleResult[] = [];
  const maxDepth = Math.max(0, ...project.modules.map((m) => m.depthMm));
  let x = 0;
  for (const spec of project.modules) {
    let res: ModuleResult;
    try {
      res = calculateModule(spec, catalog, x);
    } catch (e) {
      res = {
        moduleId: spec.id, offsetXMm: x, offsetYMm: 0, fabricable: false, parts: [], hardware: [], machining: [], steel: [],
        issues: [{ code: 'MODULE_CALC_FAILED', severity: 'error', moduleId: spec.id, message: `No se pudo calcular ${spec.label}: ${(e as Error).message}` }],
        theoreticalDiagonalMm: null, carcassDepthMm: null, overallHeightMm: spec.heightMm,
      };
    }
    res.offsetYMm = r2(maxDepth - spec.depthMm);
    modules.push(res);
    x += Number.isFinite(spec.widthMm) ? spec.widthMm : 0;
    if (spec.widthMm > 2400 || spec.heightMm > 2400) {
      issues.push({ code: 'TRANSPORT_SIZE', severity: 'warning', moduleId: spec.id, message: `${spec.label}: dimensión > 2400 mm; verificar formatos de tablero, transporte y acceso a obra; considerar dividir en módulos.` });
    }
  }
  if (project.modules.length === 0) issues.push({ code: 'EMPTY_PROJECT', severity: 'error', message: 'El proyecto no tiene módulos.' });
  issues.push(...adjacencyIssues(project.modules));
  const idSet = new Set<string>();
  for (const m of project.modules) {
    if (idSet.has(m.id)) issues.push({ code: 'DUPLICATE_MODULE_ID', severity: 'error', moduleId: m.id, message: `ID de módulo duplicado: ${m.id}` });
    idSet.add(m.id);
  }

  const parts = modules.flatMap((m) => m.parts);
  const hardware = aggregateHardware(modules.flatMap((m) => m.hardware));
  const allIssues = [...modules.flatMap((m) => m.issues), ...issues];
  const edgeBands = edgeBandTotals(parts, catalog, project.pricing.edgeAllowancePerSegmentMm, project.pricing.edgeWastePct);
  const machining = modules.flatMap((m) => m.machining);

  return {
    calcVersion: CALC_VERSION,
    projectId: project.id,
    modules,
    parts,
    hardware,
    machining,
    steel: modules.flatMap((m) => m.steel),
    edgeBands,
    issues: allIssues,
    releaseStatus: releaseStatus(project, allIssues, machining.some((o) => o.validationStatus !== 'verified')),
    totals: {
      panelCount: parts.reduce((n, p) => n + p.quantity, 0),
      partModels: parts.length,
      panelAreaM2: r2(parts.reduce((n, p) => n + (p.lengthMm * p.widthMm * p.quantity) / 1e6, 0)),
    },
  };
}

function aggregateHardware(list: HardwareRequirement[]): HardwareRequirement[] {
  // Se conserva el detalle por módulo; la agregación por productKey se hace en el presupuesto.
  return list.map((h) => ({ ...h, quantity: r2(h.quantity) }));
}

/** Largo de canto: suma de aristas marcadas × cantidad; luego margen por tramo y merma de rollo. */
export function edgeBandTotals(parts: PanelPart[], catalog: Catalog, allowancePerSegmentMm: number, wastePct: number): EdgeBandTotal[] {
  const L = catalogLookup(catalog);
  const acc = new Map<string, { net: number; segments: number }>();
  for (const p of parts) {
    for (const [edge, bandId] of Object.entries(p.edgeBand) as [EdgeName, string][]) {
      if (!bandId) continue;
      const len = edge === 'L1' || edge === 'L2' ? p.lengthMm : p.widthMm;
      const cur = acc.get(bandId) ?? { net: 0, segments: 0 };
      cur.net += len * p.quantity;
      cur.segments += p.quantity;
      acc.set(bandId, cur);
    }
  }
  return [...acc.entries()].map(([edgeBandId, v]) => ({
    edgeBandId,
    productKey: L.edgeBand(edgeBandId).productKey,
    netLengthMm: r2(v.net),
    segments: v.segments,
    purchaseLengthMm: r2((v.net + v.segments * allowancePerSegmentMm) * (1 + wastePct / 100)),
  }));
}

function adjacencyIssues(mods: ModuleSpec[]): Issue[] {
  const out: Issue[] = [];
  for (let i = 0; i < mods.length; i++) {
    const m = mods[i]!;
    if (m.front === 'open') continue;
    for (const j of [i - 1, i + 1]) {
      const n = mods[j];
      if (!n || n.mount !== m.mount) continue;
      if (n.depthMm > m.depthMm) {
        out.push({
          code: 'DOOR_OPENING_INTERFERENCE', severity: 'warning', moduleId: m.id,
          message: `${m.label}: el módulo vecino ${n.label} sobresale ${n.depthMm - m.depthMm} mm; frentes del lado contiguo pueden no abrir 90°. Usar relleno (filler) o bisagra de apertura amplia.`,
        });
      }
    }
  }
  return out;
}

function releaseStatus(project: Project, issues: Issue[], machiningPending: boolean): ReleaseStatus {
  if (issues.some((i) => i.severity === 'error')) return 'NO_FABRICABLE';
  const needsValidation = machiningPending || issues.some((i) => i.severity === 'blocker');
  if (project.approval && project.approval.approvedBy.trim()) {
    if (!needsValidation || project.approval.validationEvidence.trim().length > 0) return 'LIBERADO_CON_APROBACION';
  }
  return needsValidation ? 'PENDIENTE_VALIDACION' : 'LISTO_PARA_APROBACION';
}

export { SCHEMA_VERSION };
