import type { ModuleSpec, Project, ProjectCalculation } from '../types';

export interface AssemblyStep { id: string; title: string; detail: string; dependsOn: string[]; pending?: boolean }

/** Secuencia constructiva derivada del cálculo (no texto fijo por familia). */
export function assemblySteps(spec: ModuleSpec, calc: ProjectCalculation): AssemblyStep[] {
  const mod = calc.modules.find((m) => m.moduleId === spec.id);
  const codes = new Set(mod?.parts.map((p) => p.code));
  const has = (c: string) => codes.has(c);
  const s: AssemblyStep[] = [];
  const add = (id: string, title: string, detail: string, dependsOn: string[], pending = false) => s.push({ id, title, detail, dependsOn, pending });

  add('S01', 'Validar sitio y material', 'Medidas de sitio, interferencias, espesor REAL del tablero, sentido de veta y aprovechamiento de tableros.', []);
  add('S02', 'Cortar y etiquetar', 'Cortar a medida nominal con la compensación del sistema de canto; etiquetar cada pieza con su ID.', ['S01']);
  add('S03', 'Cantear', 'Aplicar canto en las aristas L1/L2/A1/A2 indicadas; comprobar ancho/espesor terminado con calibrador.', ['S02']);
  add('S04', 'Mecanizar', 'Perforar SÓLO con plantilla validada y ficha del herraje elegido. Operaciones pendientes de ficha: no perforar.', ['S03'], (mod?.machining ?? []).some((o) => o.validationStatus !== 'verified'));
  if (spec.familyId === 'desk' || has('DESK_TOP')) {
    if (has('DESK_SIDE')) add('S05', 'Montar costados y faldón', 'Unir costados tipo panel con faldón; comprobar escuadra.', ['S04']);
    if (mod?.steel.length) add('S05', 'Fabricar bastidor metálico', 'Cortar PTR, soldar, limpiar y aplicar acabado. Requiere validación estructural.', ['S04'], true);
    add('S06', 'Fijar cubierta', 'Fijar cubierta; comprobar rigidez, estabilidad y flecha.', ['S05']);
    add('S07', 'Inspección y liberación', 'Inspección dimensional, estabilidad, acabado y registro.', ['S06']);
    return s;
  }
  add('S05', 'Prearmar caja a escuadra', 'Unir costados, tapa y piso con prensas usando el sistema constructivo elegido.', ['S04']);
  if (has('DIVIDER')) add('S06', 'Instalar divisores', 'Fijar divisores verticales; comprobar paralelismo y separación.', ['S05']);
  add('S07', 'Medir diagonales y fijar respaldo', `Medir ambas diagonales (teórica ${mod?.theoreticalDiagonalMm ?? '—'} mm), corregir y fijar ${has('BACK') ? 'el respaldo sobrepuesto' : 'refuerzos de escuadra (sin respaldo)'}.`, [has('DIVIDER') ? 'S06' : 'S05']);
  if (has('PLINTH_RAIL') || mod?.steel.length || spec.baseType === 'levelers') add('S08', 'Base', spec.baseType === 'levelers' ? 'Instalar patas niveladoras.' : spec.baseType === 'plinth' ? 'Armar bastidor de zoclo y fijarlo a la caja.' : 'Montar bastidor metálico (validación estructural requerida).', ['S07'], spec.baseType === 'steel_frame');
  if (has('SHELF')) add('S09', 'Entrepaños / tubo', 'Colocar soportes y entrepaños; instalar tubo de colgar si aplica.', ['S07']);
  if (spec.front === 'drawers') {
    if (has('DRAWER_SIDE')) add('S10', 'Armar cajas de cajón', 'Armar cajas a escuadra según corredera seleccionada.', ['S04'], true);
    else add('S10', 'PENDIENTE: caja de cajón', 'Seleccionar corredera con ficha y calcular la caja de cajón antes de fabricar.', ['S04'], true);
    add('S11', 'Instalar correderas y frentes', 'Montar correderas según ficha; presentar y regular frentes.', ['S07', 'S10'], true);
  }
  if (spec.front === 'doors') add('S11', 'Instalar puertas', 'Bisagras exactas según ficha (cargas, solapes, despejes); regular holguras.', ['S07'], true);
  if (spec.mount === 'wall' || calc.hardware.some((h) => h.moduleId === spec.id && h.category === 'wall_anchor')) add('S12', 'Anclar a muro', 'Instalar colgadores/antivuelco según tipo de muro; validar carga.', ['S07'], true);
  add('S13', 'Inspección y liberación', 'Liberar sólo después de inspección dimensional, de seguridad, funcionamiento y acabado.', s.map((x) => x.id).slice(-1));
  return s;
}

const mmId = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');
const mmLabel = (s: string) => s.replace(/"/g, "'");

/** Diagrama Mermaid de dependencias pieza → subconjunto → pasos. */
export function mermaidDiagram(project: Project, calc: ProjectCalculation): string {
  const out = ['flowchart TD'];
  for (const spec of project.modules) {
    const mod = calc.modules.find((m) => m.moduleId === spec.id);
    if (!mod) continue;
    const m = mmId(spec.id);
    out.push(`  subgraph ${m}["${mmLabel(`${spec.id} · ${spec.label}`)}"]`);
    out.push(`    ${m}_CORE["Caja / núcleo"]`, `    ${m}_FRONT["Frentes y accesorios"]`);
    for (const p of mod.parts) {
      const group = p.role === 'front' || p.role === 'drawer_box' ? 'FRONT' : 'CORE';
      out.push(`    ${mmId(p.id)}["${mmLabel(`${p.code} ×${p.quantity}`)}"] --> ${m}_${group}`);
    }
    const steps = assemblySteps(spec, calc);
    for (const st of steps) out.push(`    ${m}_${st.id}["${mmLabel(`${st.id} ${st.title}`)}${st.pending ? ' ⚠' : ''}"]`);
    for (const st of steps) for (const d of st.dependsOn) out.push(`    ${m}_${d} --> ${m}_${st.id}`);
    out.push(`    ${m}_CORE --> ${m}_S05`);
    out.push(`    ${m}_FRONT --> ${m}_${steps.at(-1)?.id ?? 'S13'}`);
    out.push('  end');
  }
  return out.join('\n');
}
