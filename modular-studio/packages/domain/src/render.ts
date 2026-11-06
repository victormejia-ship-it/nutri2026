/**
 * Interfaz para un servicio OPCIONAL de render fotorrealista.
 * Un render de inspiración NO es un plano de fabricación; el SVG paramétrico es la fuente técnica.
 * No se incluye proveedor ni API key: se configura del lado servidor si se integra.
 */
export type RenderKind = 'inspiracion_visual' | 'render_geometrico_fiel';

export interface RenderRequest { projectId: string; moduleId: string; kind: RenderKind; prompt?: string; geometrySvg?: string }
export interface RenderResult { status: 'no_configurado' | 'en_cola' | 'listo' | 'error'; kind: RenderKind; imageUrl: string | null; disclaimer: string }

export interface RenderProvider { readonly name: string; render(req: RenderRequest): Promise<RenderResult> }

export const NoopRenderProvider: RenderProvider = {
  name: 'none',
  async render(req) {
    return { status: 'no_configurado', kind: req.kind, imageUrl: null, disclaimer: 'Servicio de render no configurado. El render no sustituye planos ni despiece.' };
  },
};
