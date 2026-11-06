import type {
  EdgeBandDefinition, FamilyDefinition, FinishDefinition, HardwareProduct, MachiningPattern, MaterialDefinition, SteelProfile, Supplier,
} from '../types';
import { FAMILIES } from './families';
import { GENERIC_HINGE_RULES, HARDWARE, MACHINING_PATTERNS } from './hardware';
import { EDGE_BANDS, FINISHES, MATERIALS, STEEL_PROFILES } from './materials';
import { SUPPLIERS } from './suppliers';

export * from './families';
export * from './hardware';
export * from './materials';
export * from './suppliers';

/** Catálogo inyectable: el motor nunca lee globales, para que sea puro y testeable. */
export interface Catalog {
  families: FamilyDefinition[];
  materials: MaterialDefinition[];
  finishes: FinishDefinition[];
  edgeBands: EdgeBandDefinition[];
  hardware: HardwareProduct[];
  machiningPatterns: MachiningPattern[];
  steelProfiles: SteelProfile[];
  suppliers: Supplier[];
}

export const DEFAULT_CATALOG: Catalog = {
  families: FAMILIES,
  materials: MATERIALS,
  finishes: FINISHES,
  edgeBands: EDGE_BANDS,
  hardware: HARDWARE,
  machiningPatterns: MACHINING_PATTERNS,
  steelProfiles: STEEL_PROFILES,
  suppliers: SUPPLIERS,
};

function finder<T extends { id: string }>(list: T[], kind: string) {
  return (id: string): T => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new CatalogError(`${kind} no encontrado: ${id}`);
    return found;
  };
}

export class CatalogError extends Error {}

export function catalogLookup(c: Catalog) {
  return {
    family: finder(c.families, 'Familia'),
    material: finder(c.materials, 'Material'),
    finish: finder(c.finishes, 'Acabado'),
    edgeBand: finder(c.edgeBands, 'Canto'),
    hardware: finder(c.hardware, 'Herraje'),
    pattern: finder(c.machiningPatterns, 'Patrón de mecanizado'),
    steelProfile: finder(c.steelProfiles, 'Perfil de herrería'),
    maybeHardware: (id: string | null) => (id ? c.hardware.find((h) => h.id === id) ?? null : null),
    hingeRulesFor: (p: HardwareProduct | null) => p?.params?.hingeRules ?? GENERIC_HINGE_RULES,
  };
}

export type CatalogLookup = ReturnType<typeof catalogLookup>;
