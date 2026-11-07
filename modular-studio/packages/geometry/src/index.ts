/**
 * Proyección SVG paramétrica. Traduce las posiciones (placements) del BOM a polígonos 2D.
 * Nunca altera el BOM: cada polígono proviene de una pieza con su ID.
 * Es un esquema axonométrico/ortogonal 2D, NO un modelo CAD 3D ni un plano CNC.
 */
import { catalogLookup, type Box3, type Catalog, type PanelPart, type Project, type ProjectCalculation } from '@ms/domain';

export type ViewKind = 'iso' | 'front' | 'side' | 'top';

export interface SceneOptions {
  view: ViewKind;
  exploded: boolean;
  explodeMm?: number;
  showIds: boolean;
  hideFronts: boolean;
  selectedPartId?: string | null;
  width?: number;
  height?: number;
  title?: string;
}

export type Pt = [number, number];

export interface ScenePolygon {
  key: string;
  partId: string;
  moduleId: string;
  role: string;
  points: Pt[];
  fill: string;
  stroke: string;
  selected: boolean;
}
export interface SceneLine { x1: number; y1: number; x2: number; y2: number; kind: 'dim' | 'ext' }
export interface SceneLabel { x: number; y: number; text: string; kind: 'dim' | 'id' | 'title' | 'subtitle'; anchor: 'start' | 'middle' | 'end' }

export interface Scene {
  width: number;
  height: number;
  polygons: ScenePolygon[];
  lines: SceneLine[];
  labels: SceneLabel[];
  ariaLabel: string;
}

interface Solid { key: string; partId: string; moduleId: string; role: string; b: Box3 }

const C30 = Math.cos(Math.PI / 6);

function project3(view: ViewKind, x: number, y: number, z: number): Pt {
  switch (view) {
    case 'iso': return [(x + y) * C30, (x - y) * 0.5 - z];
    case 'front': return [x, -z];
    case 'side': return [y, -z];
    case 'top': return [x, -y];
  }
}

function faces(view: ViewKind, b: Box3): { pts: [number, number, number][]; face: 'top' | 'front' | 'side' }[] {
  const { x0, x1, y0, y1, z0, z1 } = b;
  if (view === 'front') return [{ face: 'front', pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] }];
  if (view === 'side') return [{ face: 'side', pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] }];
  if (view === 'top') return [{ face: 'top', pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] }];
  return [
    { face: 'front', pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { face: 'side', pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
    { face: 'top', pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
  ];
}

/** A está detrás de B (se dibuja antes) para la cámara de la vista. */
function behind(view: ViewKind, a: Box3, b: Box3): boolean {
  const e = 1e-6;
  switch (view) {
    case 'iso': return a.x1 <= b.x0 + e || a.y0 >= b.y1 - e || a.z1 <= b.z0 + e;
    case 'front': return a.y0 >= b.y1 - e;
    case 'side': return a.x1 <= b.x0 + e;
    case 'top': return a.z1 <= b.z0 + e;
  }
}

const depthKey = (view: ViewKind, b: Box3) => {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
  return view === 'iso' ? cx - cy + cz : view === 'front' ? -cy : view === 'side' ? cx : cz;
};

/** Orden del pintor por relaciones de separación entre cajas (topológico, determinista). */
export function paintOrder(view: ViewKind, solids: Solid[]): Solid[] {
  const n = solids.length;
  const indeg = new Array<number>(n).fill(0);
  const out: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ab = behind(view, solids[i]!.b, solids[j]!.b);
      const ba = behind(view, solids[j]!.b, solids[i]!.b);
      if (ab && !ba) { out[i]!.push(j); indeg[j]!++; }
      else if (ba && !ab) { out[j]!.push(i); indeg[i]!++; }
    }
  }
  const order: Solid[] = [];
  const done = new Array<boolean>(n).fill(false);
  const keyOf = (i: number) => depthKey(view, solids[i]!.b);
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || keyOf(i) < keyOf(pick))) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || keyOf(i) < keyOf(pick))) pick = i; // ciclo: desempate
    done[pick] = true;
    order.push(solids[pick]!);
    for (const j of out[pick]!) indeg[j]!--;
  }
  return order;
}

function explodeBox(b: Box3, center: { x: number; y: number; z: number }, d: number): Box3 {
  const ext = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0];
  const axis = ext.indexOf(Math.min(...ext));
  const c = [(b.x0 + b.x1) / 2 - center.x, (b.y0 + b.y1) / 2 - center.y, (b.z0 + b.z1) / 2 - center.z];
  const s = Math.sign(c[axis]!) || 1;
  const off = [0, 0, 0];
  off[axis] = s * d;
  return { x0: b.x0 + off[0]!, x1: b.x1 + off[0]!, y0: b.y0 + off[1]!, y1: b.y1 + off[1]!, z0: b.z0 + off[2]!, z1: b.z1 + off[2]! };
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function colorsFor(part: { role: string } | null, finish: { top: string; front: string; side: string }) {
  switch (part?.role) {
    case 'back': return { top: '#b9a17f', front: '#a38b69', side: '#8a7454' };
    case 'drawer_box': return { top: '#e2cfa6', front: '#cdb78c', side: '#b09a70' };
    case 'plinth': return { top: shade(finish.top, -0.25), front: shade(finish.front, -0.25), side: shade(finish.side, -0.25) };
    case 'front': return { top: shade(finish.top, 0.08), front: shade(finish.front, 0.08), side: shade(finish.side, 0.08) };
    case 'steel': return { top: '#7d8a95', front: '#5f6b75', side: '#46515a' };
    default: return finish;
  }
}

/** Sólidos de herrería esquemáticos derivados de las piezas de acero (no CAD). */
function steelSolids(project: Project, calc: ProjectCalculation): Solid[] {
  const out: Solid[] = [];
  for (const m of calc.modules) {
    const spec = project.modules.find((s) => s.id === m.moduleId);
    if (!spec) continue;
    for (const req of m.steel) {
      const sec = parseFloat(req.sectionSpec) || 25.4;
      const leg = req.pieces.find((p) => p.label === 'Pata');
      if (!leg) continue;
      const desk = req.id.endsWith('STEEL-DESK');
      const inset = desk ? 50 : 0;
      const W = spec.widthMm, D = desk ? spec.depthMm : (m.carcassDepthMm ?? spec.depthMm);
      const y0 = desk ? 0 : (spec.front === 'open' ? 0 : spec.thicknessMm);
      const xs = [inset, W - inset - sec], ys = [y0 + inset, y0 + D - inset - sec];
      let k = 0;
      for (const x of xs) for (const y of ys) out.push({ key: `${req.id}-L${++k}`, partId: req.id, moduleId: m.moduleId, role: 'steel', b: { x0: x, x1: x + sec, y0: y, y1: y + sec, z0: 0, z1: leg.lengthMm } });
      const zt = leg.lengthMm;
      out.push({ key: `${req.id}-RF`, partId: req.id, moduleId: m.moduleId, role: 'steel', b: { x0: inset + sec, x1: W - inset - sec, y0: ys[0]!, y1: ys[0]! + sec, z0: zt - sec, z1: zt } });
      out.push({ key: `${req.id}-RB`, partId: req.id, moduleId: m.moduleId, role: 'steel', b: { x0: inset + sec, x1: W - inset - sec, y0: ys[1]!, y1: ys[1]! + sec, z0: zt - sec, z1: zt } });
    }
  }
  return out;
}

export function buildScene(project: Project, calc: ProjectCalculation, catalog: Catalog, opts: SceneOptions): Scene {
  const L = catalogLookup(catalog);
  const width = opts.width ?? 900, height = opts.height ?? 640;
  const view = opts.view;
  const partsById = new Map<string, PanelPart>(calc.parts.map((p) => [p.id, p]));
  const solids: Solid[] = [];
  calc.modules.forEach((m, mi) => {
    const spec = project.modules.find((s) => s.id === m.moduleId);
    const parts = m.parts.filter((p) => !(opts.hideFronts && p.role === 'front'));
    const all = m.parts.flatMap((p) => p.placements);
    const center = all.length
      ? { x: (Math.min(...all.map((b) => b.x0)) + Math.max(...all.map((b) => b.x1))) / 2, y: (Math.min(...all.map((b) => b.y0)) + Math.max(...all.map((b) => b.y1))) / 2, z: (Math.min(...all.map((b) => b.z0)) + Math.max(...all.map((b) => b.z1))) / 2 }
      : { x: 0, y: 0, z: 0 };
    const d = opts.exploded ? (opts.explodeMm ?? Math.max(60, (spec?.widthMm ?? 800) * 0.12)) : 0;
    // En despiece separado los módulos también se separan entre sí para no encimarse.
    const dx = m.offsetXMm + (opts.exploded ? mi * 2.5 * (opts.explodeMm ?? 120) : 0);
    for (const p of parts) {
      p.placements.forEach((pl, i) => {
        const b0 = opts.exploded ? explodeBox(pl, center, d) : pl;
        const b = { x0: b0.x0 + dx, x1: b0.x1 + dx, y0: b0.y0 + m.offsetYMm, y1: b0.y1 + m.offsetYMm, z0: b0.z0, z1: b0.z1 };
        solids.push({ key: `${p.id}#${i + 1}`, partId: p.id, moduleId: m.moduleId, role: p.role, b });
      });
    }
  });
  for (const s of steelSolids(project, calc)) {
    const m = calc.modules.find((x) => x.moduleId === s.moduleId)!;
    solids.push({ ...s, b: { ...s.b, x0: s.b.x0 + m.offsetXMm, x1: s.b.x1 + m.offsetXMm, y0: s.b.y0 + m.offsetYMm, y1: s.b.y1 + m.offsetYMm } });
  }

  // Extensión total para cotas (sin explosión)
  const real = calc.modules.flatMap((m) => m.parts.flatMap((p) => p.placements.map((b) => ({ ...b, x0: b.x0 + m.offsetXMm, x1: b.x1 + m.offsetXMm, y0: b.y0 + m.offsetYMm, y1: b.y1 + m.offsetYMm }))));
  const ext = real.length
    ? { x0: Math.min(...real.map((b) => b.x0)), x1: Math.max(...real.map((b) => b.x1)), y0: Math.min(...real.map((b) => b.y0)), y1: Math.max(...real.map((b) => b.y1)), z0: Math.min(0, ...real.map((b) => b.z0)), z1: Math.max(...real.map((b) => b.z1)) }
    : { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };
  const span = Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0, ext.z1 - ext.z0, 1);
  const off = span * 0.09;

  type RawLine = { a: [number, number, number]; b: [number, number, number]; text: string };
  const dims: RawLine[] = [];
  const W = Math.round((ext.x1 - ext.x0) * 10) / 10, D = Math.round((ext.y1 - ext.y0) * 10) / 10, H = Math.round((ext.z1 - ext.z0) * 10) / 10;
  if (view === 'iso' || view === 'front' || view === 'top') dims.push({ a: [ext.x0, ext.y0 - off, ext.z0], b: [ext.x1, ext.y0 - off, ext.z0], text: `${W} mm · ANCHO` });
  if (view === 'iso' || view === 'front') dims.push({ a: [ext.x0 - off, ext.y0, ext.z0], b: [ext.x0 - off, ext.y0, ext.z1], text: `${H} mm · ALTO` });
  if (view === 'side') dims.push({ a: [ext.x1, ext.y0 - off, ext.z0], b: [ext.x1, ext.y0 - off, ext.z1], text: `${H} mm · ALTO` });
  if (view === 'iso') dims.push({ a: [ext.x1 + off, ext.y0, ext.z0], b: [ext.x1 + off, ext.y1, ext.z0], text: `${D} mm · FONDO` });
  if (view === 'side') dims.push({ a: [ext.x1, ext.y0, ext.z0 - off], b: [ext.x1, ext.y1, ext.z0 - off], text: `${D} mm · FONDO` });
  if (view === 'top') dims.push({ a: [ext.x1 + off, ext.y0, ext.z1], b: [ext.x1 + off, ext.y1, ext.z1], text: `${D} mm · FONDO` });
  // Cotas por módulo sólo en vista frontal (en isométrico se enciman con la cota total).
  if (calc.modules.length > 1 && !opts.exploded && view === 'front') {
    for (const m of calc.modules) {
      const spec = project.modules.find((s) => s.id === m.moduleId);
      if (!spec) continue;
      const z = ext.z1 + off * 0.5;
      dims.push({ a: [m.offsetXMm, ext.y0 - off * 0.5, z], b: [m.offsetXMm + spec.widthMm, ext.y0 - off * 0.5, z], text: `${spec.id} ${spec.widthMm}` });
    }
  }

  // Proyección y ajuste al viewBox
  const ordered = paintOrder(view, solids);
  const rawPolys: { s: Solid; face: 'top' | 'front' | 'side'; pts: Pt[] }[] = [];
  for (const s of ordered) for (const f of faces(view, s.b)) rawPolys.push({ s, face: f.face, pts: f.pts.map(([x, y, z]) => project3(view, x, y, z)) });
  const rawDims = dims.map((d) => ({ ...d, pa: project3(view, ...d.a), pb: project3(view, ...d.b) }));
  const allPts = [...rawPolys.flatMap((p) => p.pts), ...rawDims.flatMap((d) => [d.pa, d.pb])];
  const minX = Math.min(...allPts.map((p) => p[0])), maxX = Math.max(...allPts.map((p) => p[0]));
  const minY = Math.min(...allPts.map((p) => p[1])), maxY = Math.max(...allPts.map((p) => p[1]));
  const margin = 70, top = 80;
  const sc = Math.min((width - 2 * margin) / Math.max(maxX - minX, 1), (height - top - margin) / Math.max(maxY - minY, 1));
  const ox = margin + ((width - 2 * margin) - (maxX - minX) * sc) / 2 - minX * sc;
  const oy = top + ((height - top - margin) - (maxY - minY) * sc) / 2 - minY * sc;
  const T = (p: Pt): Pt => [Math.round((ox + p[0] * sc) * 10) / 10, Math.round((oy + p[1] * sc) * 10) / 10];

  const polygons: ScenePolygon[] = rawPolys.map(({ s, face, pts }) => {
    const part = partsById.get(s.partId) ?? null;
    const finish = L.finish(part?.finishId ?? project.modules.find((m) => m.id === s.moduleId)?.finishId ?? 'grafito');
    const c = colorsFor(part ?? { role: s.role }, finish.colors);
    const selected = opts.selectedPartId === s.partId;
    return {
      key: `${s.key}-${face}`, partId: s.partId, moduleId: s.moduleId, role: s.role, points: pts.map(T),
      fill: selected ? shade(c[face], 0.35) : c[face], stroke: selected ? '#ffbe3d' : '#90a7b8', selected,
    };
  });

  const lines: SceneLine[] = [];
  const labels: SceneLabel[] = [];
  for (const d of rawDims) {
    const a = T(d.pa), b = T(d.pb);
    lines.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], kind: 'dim' });
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const vertical = Math.abs(a[0] - b[0]) < Math.abs(a[1] - b[1]) * 0.3;
    labels.push({ x: vertical ? mx - 10 : mx, y: vertical ? my : my - 10, text: d.text, kind: 'dim', anchor: vertical ? 'end' : 'middle' });
  }
  if (opts.showIds) {
    const seen = new Set<string>();
    for (const s of ordered) {
      if (s.role === 'steel' && seen.has(s.partId)) continue;
      seen.add(s.partId);
      const c = project3(view, (s.b.x0 + s.b.x1) / 2, view === 'front' ? s.b.y0 : (s.b.y0 + s.b.y1) / 2, (s.b.z0 + s.b.z1) / 2);
      const p = T(c);
      const part = partsById.get(s.partId);
      labels.push({ x: p[0], y: p[1], text: part ? `${part.code}${part.quantity > 1 ? `·${s.key.split('#')[1]}` : ''}` : 'PTR', kind: 'id', anchor: 'middle' });
    }
  }
  labels.unshift(
    { x: 24, y: 34, text: opts.title ?? project.name, kind: 'title', anchor: 'start' },
    { x: 24, y: 56, text: `${({ iso: 'Isométrico', front: 'Vista frontal', side: 'Vista lateral derecha', top: 'Planta' } as const)[view]} esquemático · cotas en mm${opts.exploded ? ' · despiece separado' : ''}`, kind: 'subtitle', anchor: 'start' },
  );
  return { width, height, polygons, lines, labels, ariaLabel: `${project.name}: vista ${view} acotada en milímetros` };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** SVG autónomo (exportación). El editor React usa la misma escena. */
export function sceneToSvg(scene: Scene, theme: 'dark' | 'light' = 'dark'): string {
  const bg = theme === 'dark' ? '#14202a' : '#ffffff';
  const dim = theme === 'dark' ? '#ffbe66' : '#b25e00';
  const txt = theme === 'dark' ? '#e8edf4' : '#1b2630';
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}" role="img" aria-label="${esc(scene.ariaLabel)}" font-family="Inter, system-ui, sans-serif">`);
  parts.push(`<title>${esc(scene.ariaLabel)}</title>`);
  parts.push(`<defs><marker id="ms-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8" fill="none" stroke="${dim}" stroke-width="1.2"/></marker></defs>`);
  parts.push(`<rect width="100%" height="100%" fill="${bg}"/>`);
  for (const p of scene.polygons) parts.push(`<polygon data-part-id="${esc(p.partId)}" points="${p.points.map((x) => x.join(',')).join(' ')}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.selected ? 2.4 : 1}" stroke-linejoin="round"/>`);
  for (const l of scene.lines) parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${dim}" stroke-width="1.3" marker-start="url(#ms-arrow)" marker-end="url(#ms-arrow)"/>`);
  for (const t of scene.labels) {
    const style = t.kind === 'title' ? `font-size="18" fill="${txt}" font-weight="700"` : t.kind === 'subtitle' ? `font-size="12" fill="${txt}" opacity="0.75"` : t.kind === 'dim' ? `font-size="14" font-weight="700" fill="${dim}" stroke="${bg}" stroke-width="3.5" paint-order="stroke"` : `font-size="10.5" fill="#ffffff" stroke="#0b1218" stroke-width="3" paint-order="stroke"`;
    parts.push(`<text x="${t.x}" y="${t.y}" text-anchor="${t.anchor}" ${style}>${esc(t.text)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Mapa de corte (SVG) a partir del acomodo del optimizador
// ---------------------------------------------------------------------------

export interface CutSheetInput {
  materialName: string;
  sheet: { lengthMm: number; widthMm: number; trimMarginMm: number };
  index: number;
  utilization: number;
  placements: { partId: string; label: string; instance: number; x: number; y: number; w: number; h: number; rotated: boolean }[];
}

export function cutSheetSvg(s: CutSheetInput, width = 820, fluid = false): string {
  const sc = (width - 40) / s.sheet.lengthMm;
  const h = s.sheet.widthMm * sc + 70;
  const out: string[] = [];
  const size = fluid ? 'width="100%" style="display:block;height:auto"' : `width="${width}" height="${Math.round(h)}"`;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${Math.round(h)}" ${size} role="img" aria-label="Mapa de corte ${esc(s.materialName)} tablero ${s.index}" font-family="Inter, system-ui, sans-serif">`);
  out.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  out.push(`<text x="20" y="22" font-size="14" font-weight="700" fill="#1b2630">${esc(s.materialName)} · Tablero ${s.index} · ${s.sheet.lengthMm} × ${s.sheet.widthMm} mm · aprovechamiento ${(s.utilization * 100).toFixed(1)} %</text>`);
  out.push(`<text x="20" y="40" font-size="11" fill="#55636f">Acomodo guillotina (layout_factible). Medidas en mm. La veta del tablero corre a lo largo (horizontal). ↻ = pieza girada.</text>`);
  const X = (v: number) => 20 + v * sc, Y = (v: number) => 50 + v * sc;
  out.push(`<rect x="20" y="50" width="${(s.sheet.lengthMm * sc).toFixed(1)}" height="${(s.sheet.widthMm * sc).toFixed(1)}" fill="#f3efe6" stroke="#6b5b45"/>`);
  for (const p of s.placements) {
    out.push(`<rect data-part-id="${esc(p.partId)}" x="${X(p.x).toFixed(1)}" y="${Y(p.y).toFixed(1)}" width="${(p.w * sc).toFixed(1)}" height="${(p.h * sc).toFixed(1)}" fill="#cfe6ee" stroke="#2f6f86" stroke-width="0.8"/>`);
    const fs = Math.max(6, Math.min(11, p.h * sc * 0.28, (p.w * sc) / 9));
    out.push(`<text x="${X(p.x + p.w / 2).toFixed(1)}" y="${Y(p.y + p.h / 2).toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="#0f2f3a">${esc(`${p.label}${p.rotated ? ' ↻' : ''} ${p.w}×${p.h}`)}</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
