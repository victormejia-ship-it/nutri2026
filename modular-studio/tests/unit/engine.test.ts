import { describe, expect, it } from 'vitest';
import fixtures from '../../data/seed/fixtures.json';
import {
  DEFAULT_CATALOG, FAMILIES, calculateModule, calculateProject, createModule, createProject, edgeBandTotals, evenZ, overlapVolume,
  type Catalog, type ModuleSpec, type Project,
} from '@ms/domain';

const cat = DEFAULT_CATALOG;
const NOW = '2026-01-01T00:00:00.000Z';

function boxSpec(o: Partial<ModuleSpec> = {}): ModuleSpec {
  return {
    ...createModule('kitchen_base', cat, 'gab001'),
    widthMm: 800, heightMm: 850, depthMm: 550,
    front: 'open', doorCount: null, shelvesPerBay: 0, backMaterialId: null, baseType: 'none', baseHeightMm: 0, dividerCount: null,
    ...o,
  };
}

function project(mods: ModuleSpec[]): Project {
  const p = createProject({ id: 'p1', name: 'Prueba', familyId: 'kitchen_base', now: NOW }, cat);
  p.modules = mods;
  return p;
}

describe('fixtures del paquete (06_TESTS/fixtures.json)', () => {
  for (const c of fixtures.panelBoxCases) {
    it(c.case, () => {
      const res = calculateModule(boxSpec({
        widthMm: c.input.widthMm, heightMm: c.input.heightMm, depthMm: c.input.depthMm, thicknessMm: c.input.thicknessMm,
        construction: c.input.strategy as ModuleSpec['construction'],
      }), cat);
      if ('error' in c && c.error) {
        expect(res.fabricable).toBe(false);
        expect(res.parts).toHaveLength(0);
        expect(res.issues.map((i) => i.code)).toContain(c.error);
        return;
      }
      for (const e of c.expected ?? []) {
        const part = res.parts.find((p) => p.code === e.id)!;
        expect(part, e.id).toBeDefined();
        expect(part.quantity).toBe(e.qty);
        expect(part.lengthMm).toBe(e.lengthMm);
        expect(part.widthMm).toBe(e.widthMm);
        expect(part.thicknessMm).toBe(e.thicknessMm);
      }
      expect(res.fabricable).toBe(true);
    });
  }

  it('W <= 2T exacto no es fabricable', () => {
    const res = calculateModule(boxSpec({ widthMm: 36 }), cat);
    expect(res.fabricable).toBe(false);
    expect(res.issues[0]!.code).toBe('WIDTH_BELOW_DOUBLE_THICKNESS');
  });

  it('estrategia costados entre tapa y piso', () => {
    const res = calculateModule(boxSpec({ construction: 'sides_between_top_bottom' }), cat);
    const side = res.parts.find((p) => p.code === 'SIDE')!;
    const hor = res.parts.find((p) => p.code === 'HORIZONTAL')!;
    expect(side.lengthMm).toBe(850 - 36);
    expect(hor.lengthMm).toBe(800);
  });
});

describe('motor de caja', () => {
  it('respaldo y frentes reducen la profundidad de caja', () => {
    const res = calculateModule(boxSpec({ backMaterialId: 'hdf3', front: 'doors' }), cat);
    expect(res.carcassDepthMm).toBe(550 - 3 - 18);
    const back = res.parts.find((p) => p.code === 'BACK')!;
    expect([back.lengthMm, back.widthMm, back.thicknessMm]).toEqual([850, 800, 3]);
  });

  it('puertas: medidas con holguras y bisagras en pendiente de validación (sin perforaciones inventadas)', () => {
    const res = calculateModule(boxSpec({ front: 'doors' }), cat);
    const door = res.parts.find((p) => p.code === 'DOOR')!;
    expect(door.quantity).toBe(2);
    expect(door.lengthMm).toBe(846);
    expect(door.widthMm).toBe((800 - 4 - 3) / 2);
    const hinges = res.hardware.find((h) => h.category === 'hinge')!;
    expect(hinges.quantity).toBe(4);
    expect(hinges.validationStatus).toBe('pending_validation');
    const cups = res.machining.filter((m) => m.partId === door.id);
    expect(cups.length).toBe(2);
    for (const op of res.machining) {
      expect(op.validationStatus).not.toBe('verified');
      expect(op.xMm).toBeNull();
      expect(op.diameterMm).toBeNull();
    }
  });

  it('cajones sin corredera: no se calcula caja y queda bloqueado para validación', () => {
    const res = calculateModule(boxSpec({ front: 'drawers', drawerCount: 3 }), cat);
    expect(res.parts.find((p) => p.code === 'DRAWER_FRONT')!.quantity).toBe(3);
    expect(res.parts.find((p) => p.code === 'DRAWER_SIDE')).toBeUndefined();
    expect(res.issues.some((i) => i.code === 'DRAWER_SLIDE_NOT_SELECTED' && i.severity === 'blocker')).toBe(true);
    expect(res.hardware.find((h) => h.category === 'drawer_slide')!.quantity).toBe(3);
  });

  it('cajones con corredera genérica: caja calculada y pendiente de validación', () => {
    const res = calculateModule(boxSpec({ front: 'drawers', drawerCount: 3, slideProductId: 'slide-generic-telescopic' }), cat);
    const side = res.parts.find((p) => p.code === 'DRAWER_SIDE')!;
    expect(side.quantity).toBe(6);
    expect(side.lengthMm).toBe(500); // fondo útil 532 − 10 → 500
    expect(side.validationStatus).toBe('pending_validation');
    const fb = res.parts.find((p) => p.code === 'DRAWER_FB')!;
    expect(fb.lengthMm).toBe(800 - 36 - 25 - 30);
    expect(res.fabricable).toBe(true);
  });

  it('corredera sin holgura en ficha: no inventa la caja', () => {
    const res = calculateModule(boxSpec({ front: 'drawers', drawerCount: 2, slideProductId: 'slide-samet-soclass-350' }), cat);
    expect(res.parts.find((p) => p.code === 'DRAWER_SIDE')).toBeUndefined();
    expect(res.issues.map((i) => i.code)).toContain('DRAWER_SLIDE_PARAMS_MISSING');
  });

  it('divisor automático por luz libre y entrepaños por hueco', () => {
    const res = calculateModule(boxSpec({ widthMm: 1600, shelvesPerBay: 2 }), cat);
    expect(res.parts.find((p) => p.code === 'DIVIDER')!.quantity).toBe(1);
    expect(res.parts.find((p) => p.code === 'SHELF')!.quantity).toBe(4);
  });

  it('IDs estables entre recálculos y únicos', () => {
    const a = calculateModule(boxSpec({ front: 'doors', backMaterialId: 'hdf3', shelvesPerBay: 2 }), cat);
    const b = calculateModule(boxSpec({ front: 'doors', backMaterialId: 'hdf3', shelvesPerBay: 2, widthMm: 780 }), cat);
    expect(a.parts.map((p) => p.id)).toEqual(b.parts.map((p) => p.id));
    expect(new Set(a.parts.map((p) => p.id)).size).toBe(a.parts.length);
    expect(a.parts[0]!.id).toBe('gab001-SIDE');
  });

  it('placements coinciden con cantidades y no hay colisiones en todas las familias', () => {
    for (const f of FAMILIES) {
      for (const front of ['open', 'doors', 'drawers'] as const) {
        const spec = { ...createModule(f.id, cat, 'X'), front, drawerCount: 3, slideProductId: 'slide-generic-telescopic', backMaterialId: f.geometryStrategy === 'desk' ? null : 'hdf3' };
        const res = calculateModule(spec, cat);
        for (const p of res.parts) expect(p.placements.length, `${f.id}/${front}/${p.id}`).toBe(p.quantity);
        expect(res.issues.filter((i) => i.code === 'COLLISION'), `${f.id}/${front}`).toEqual([]);
        for (const p of res.parts) {
          for (const pl of p.placements) {
            const dims = [pl.x1 - pl.x0, pl.y1 - pl.y0, pl.z1 - pl.z0].sort((x, y) => x - y);
            const exp = [p.lengthMm, p.widthMm, p.thicknessMm].sort((x, y) => x - y);
            dims.forEach((v, k) => expect(Math.abs(v - exp[k]!), `${f.id}/${front}/${p.id}: proyección corresponde al BOM`).toBeLessThan(0.02));
          }
        }
      }
    }
  });

  it('colisión intencional detectada', () => {
    expect(overlapVolume({ x0: 0, x1: 10, y0: 0, y1: 10, z0: 0, z1: 10 }, { x0: 5, x1: 15, y0: 5, y1: 15, z0: 5, z1: 15 })).toBe(125);
    expect(overlapVolume({ x0: 0, x1: 10, y0: 0, y1: 10, z0: 0, z1: 10 }, { x0: 10, x1: 15, y0: 0, y1: 10, z0: 0, z1: 10 })).toBe(0);
  });

  it('pieza mayor al tablero genera error', () => {
    const res = calculateModule(boxSpec({ heightMm: 2600 }), cat);
    expect(res.issues.some((i) => i.code === 'PART_EXCEEDS_SHEET')).toBe(true);
    expect(res.fabricable).toBe(false);
  });

  it('evenZ reparte huecos iguales', () => {
    expect(evenZ(0, 100, 1, 10)).toEqual([45]);
    expect(evenZ(0, 100, 0, 10)).toEqual([]);
  });
});

describe('clóset (vertical verificada)', () => {
  it('divisor, maletero, tubo y antivuelco', () => {
    const res = calculateModule(createModule('wardrobe', cat, 'C1'), cat);
    expect(res.parts.find((p) => p.code === 'DIVIDER')!.quantity).toBe(1);
    expect(res.parts.find((p) => p.code === 'SHELF')!.quantity).toBe(2);
    expect(res.hardware.find((h) => h.category === 'hanging_rail')!.quantity).toBeGreaterThan(1);
    expect(res.hardware.find((h) => h.category === 'hanging_rail_support')!.quantity).toBe(4);
    expect(res.issues.some((i) => i.code === 'ANTITIP_REQUIRED')).toBe(true);
    expect(res.parts.find((p) => p.code === 'PLINTH_RAIL')).toBeDefined();
    expect(res.overallHeightMm).toBe(2280);
    expect(res.fabricable).toBe(true);
  });

  it('torre de entrepaños en el último hueco', () => {
    const res = calculateModule({ ...createModule('wardrobe', cat, 'C1'), shelvesPerBay: 4 }, cat);
    expect(res.parts.find((p) => p.code === 'SHELF')!.quantity).toBe(5);
    expect(res.hardware.find((h) => h.category === 'hanging_rail_support')!.quantity).toBe(2);
  });
});

describe('escritorio (vertical verificada)', () => {
  it('cubierta, costados y faldón', () => {
    const res = calculateModule(createModule('desk', cat, 'D1'), cat);
    const top = res.parts.find((p) => p.code === 'DESK_TOP')!;
    expect([top.lengthMm, top.widthMm]).toEqual([1400, 600]);
    expect(res.parts.find((p) => p.code === 'DESK_SIDE')!.lengthMm).toBe(732);
    expect(res.parts.find((p) => p.code === 'DESK_MODESTY')!.widthMm).toBe(280);
    expect(res.fabricable).toBe(true);
  });

  it('bastidor PTR exige validación de cargas', () => {
    const spec = { ...createModule('desk', cat, 'D1'), steel: { enabled: true, profileId: 'ptr1x1c14', legHeightMm: 0, finish: 'powder_coating' as const } };
    const res = calculateModule(spec, cat);
    expect(res.parts.find((p) => p.code === 'DESK_SIDE')).toBeUndefined();
    expect(res.steel[0]!.loadValidationRequired).toBe(true);
    expect(res.steel[0]!.pieces.find((p) => p.label === 'Pata')!.count).toBe(4);
    expect(res.issues.some((i) => i.code === 'STEEL_LOAD_VALIDATION_REQUIRED' && i.severity === 'blocker')).toBe(true);
  });
});

describe('tapacantos', () => {
  it('suma metros por aristas marcadas × cantidad', () => {
    const res = calculateModule(boxSpec({ front: 'doors' }), cat);
    const totals = edgeBandTotals(res.parts, cat, 0, 0);
    // costados L1 850×2 + horizontales L1 764×2 + puertas perímetro (846+398.5)×2×2
    const expected = 850 * 2 + 764 * 2 + (846 + 396.5) * 2 * 2;
    expect(totals[0]!.netLengthMm).toBeCloseTo(expected, 5);
    const withWaste = edgeBandTotals(res.parts, cat, 30, 10)[0]!;
    expect(withWaste.purchaseLengthMm).toBeCloseTo((expected + withWaste.segments * 30) * 1.1, 1);
    expect(withWaste.segments).toBe(2 + 2 + 8);
  });
});

describe('mecanizado verificado (patrón con ficha)', () => {
  it('genera coordenadas y detecta salida de broca y traslapes', () => {
    const custom: Catalog = {
      ...cat,
      machiningPatterns: cat.machiningPatterns.map((p) => p.id === 'hinge-cup-35'
        ? { ...p, validationStatus: 'verified' as const, technicalDatasheetUrl: 'https://example.com/ficha.pdf', holes: [
          { reference: 'from_start' as const, uMm: 100, vMm: 22, diameterMm: 35, depthMm: 16, face: 'A' as const },
          { reference: 'from_start' as const, uMm: 110, vMm: 22, diameterMm: 8, depthMm: 10, face: 'A' as const },
        ] }
        : p),
    };
    const res = calculateModule(boxSpec({ front: 'doors' }), custom);
    const ops = res.machining.filter((m) => m.patternId === 'hinge-cup-35');
    expect(ops.length).toBe(4);
    expect(ops[0]!.xMm).toBe(100);
    expect(ops[2]!.xMm).toBe(746);
    const codes = res.issues.map((i) => i.code);
    expect(codes).toContain('MACHINING_DEPTH_EXCEEDS');
    expect(codes).toContain('MACHINING_HOLE_COLLISION');
  });
});

describe('proyecto', () => {
  it('módulos contiguos, interferencia de apertura y estado de liberación', () => {
    const a = { ...boxSpec({ front: 'doors' }), id: 'M01', label: 'A' };
    const b = { ...boxSpec({ depthMm: 600 }), id: 'M02', label: 'B' };
    const calc = calculateProject(project([a, b]), cat);
    expect(calc.modules[1]!.offsetXMm).toBe(800);
    expect(calc.modules[0]!.offsetYMm).toBe(50);
    expect(calc.issues.some((i) => i.code === 'DOOR_OPENING_INTERFERENCE')).toBe(true);
    expect(calc.releaseStatus).toBe('PENDIENTE_VALIDACION');
  });

  it('error bloquea; aprobación sin evidencia no libera pendientes', () => {
    const p = project([boxSpec({ front: 'doors' })]);
    expect(calculateProject({ ...p, modules: [boxSpec({ widthMm: 20 })] }, cat).releaseStatus).toBe('NO_FABRICABLE');
    expect(calculateProject({ ...p, approval: { approvedBy: 'Ing. X', approvedAt: NOW, validationEvidence: '' } }, cat).releaseStatus).toBe('PENDIENTE_VALIDACION');
    expect(calculateProject({ ...p, approval: { approvedBy: 'Ing. X', approvedAt: NOW, validationEvidence: 'Fichas Samet adjuntas, folio 123' } }, cat).releaseStatus).toBe('LIBERADO_CON_APROBACION');
  });

  it('cálculo determinista', () => {
    const p = project([createModule('wardrobe', cat, 'M01'), createModule('kitchen_base', cat, 'M02')]);
    expect(JSON.stringify(calculateProject(p, cat))).toBe(JSON.stringify(calculateProject(structuredClone(p), cat)));
  });

  it('catálogo con al menos 14 familias y 3 verticales verificadas', () => {
    expect(FAMILIES.length).toBeGreaterThanOrEqual(14);
    expect(FAMILIES.filter((f) => f.status === 'verified_vertical').map((f) => f.id).sort()).toEqual(['desk', 'kitchen_base', 'wardrobe']);
  });
});
